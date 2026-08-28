#!/usr/bin/env python3
"""pCAD local Creative mesh gateway.

The gateway is intentionally lightweight and never imports torch. It owns one
backend worker process at a time. Before a local 3D job it can also ask
llama-swap to unload any resident LLM/VLM workers, allowing both stacks to share
one GPU. The 3D worker is stopped again before the result is returned so the
next llama-swap request can reload its model on demand.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field


MODEL_LAYOUT: dict[str, tuple[str, str]] = {
    "local/trellis-v1": ("trellis", "TRELLIS"),
    "local/hunyuan3d-2": ("hunyuan3d-2", "Hunyuan3D-2"),
    "local/hunyuan3d-2.1": ("hunyuan3d-2.1", "Hunyuan3D-2.1"),
}

WORKER_HOST = "127.0.0.1"
WORKER_PORT = 8190
WORKER_URL = f"http://{WORKER_HOST}:{WORKER_PORT}"
WORKER_START_TIMEOUT = 45.0
WORKER_STOP_TIMEOUT = 15.0
GENERATION_TIMEOUT = 30.0 * 60.0


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def payload_has_running_models(payload: Any) -> bool:
    """Accept the common /running response shapes without coupling to one version."""
    if payload is None:
        return False
    if isinstance(payload, bool):
        return payload
    if isinstance(payload, (int, float)):
        return payload > 0
    if isinstance(payload, str):
        return bool(payload.strip())
    if isinstance(payload, (list, tuple, set)):
        return len(payload) > 0
    if isinstance(payload, dict):
        for key in ("running", "models", "data"):
            if key in payload:
                return payload_has_running_models(payload[key])
        return len(payload) > 0
    return bool(payload)


class GenerateRequest(BaseModel):
    model: str
    prompt: str | None = None
    images: list[str] = Field(default_factory=list)
    topology: str | None = None
    polygonCount: int | None = None
    outputFormat: str = "glb"


class LlamaSwapArbiter:
    """Coordinate the local 3D stack with a separately running llama-swap."""

    VALID_MODES = {"off", "auto", "required"}

    def __init__(self) -> None:
        mode = os.environ.get("PCAD_GPU_ARBITRATION", "auto").strip().lower()
        if mode not in self.VALID_MODES:
            raise RuntimeError(
                "PCAD_GPU_ARBITRATION must be one of: off, auto, required"
            )
        self.mode = mode
        self.base_url = os.environ.get(
            "PCAD_LLAMA_SWAP_URL", "http://127.0.0.1:9292"
        ).rstrip("/")
        self.timeout = float(os.environ.get("PCAD_LLAMA_SWAP_UNLOAD_TIMEOUT", "90"))
        self.api_key = os.environ.get("PCAD_LLAMA_SWAP_API_KEY", "").strip()
        self.connected: bool | None = None
        self.last_running: Any = None
        self.last_action = "not-run"
        self.last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return self.mode != "off"

    def headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        return {"Authorization": f"Bearer {self.api_key}"}

    async def _get_running(self, client: httpx.AsyncClient) -> Any:
        response = await client.get(
            f"{self.base_url}/running",
            headers=self.headers(),
        )
        response.raise_for_status()
        try:
            return response.json()
        except ValueError:
            text = response.text.strip()
            return text if text else []

    async def prepare_for_mesh(self) -> None:
        if not self.enabled:
            self.last_action = "disabled"
            self.last_error = None
            return

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                running = await self._get_running(client)
        except Exception as exc:
            self.connected = False
            self.last_running = None
            self.last_error = str(exc)
            if self.mode == "required":
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "GPU arbitration requires llama-swap, but it is not reachable at "
                        f"{self.base_url}: {exc}"
                    ),
                ) from exc
            # auto means pCAD is also valid on machines that do not run llama-swap.
            self.last_action = "llama-swap-unavailable"
            return

        self.connected = True
        self.last_running = running
        self.last_error = None
        if not payload_has_running_models(running):
            self.last_action = "already-free"
            return

        try:
            async with httpx.AsyncClient(timeout=max(10.0, self.timeout)) as client:
                response = await client.post(
                    f"{self.base_url}/api/models/unload",
                    headers=self.headers(),
                )
                response.raise_for_status()

                deadline = time.monotonic() + self.timeout
                while time.monotonic() < deadline:
                    await asyncio.sleep(0.5)
                    running = await self._get_running(client)
                    self.last_running = running
                    if not payload_has_running_models(running):
                        self.last_action = "unloaded-llama-swap"
                        # Give the NVIDIA driver a moment to release the old CUDA
                        # context before importing a large Python model stack.
                        await asyncio.sleep(0.75)
                        return
        except Exception as exc:
            self.last_error = str(exc)
            raise HTTPException(
                status_code=503,
                detail=f"Could not unload llama-swap models before local 3D generation: {exc}",
            ) from exc

        self.last_error = "timed out waiting for /running to become empty"
        raise HTTPException(
            status_code=503,
            detail=(
                "Timed out waiting for llama-swap to release the GPU after "
                f"{self.timeout:.0f}s"
            ),
        )

    def status(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "llamaSwapUrl": self.base_url,
            "connected": self.connected,
            "lastAction": self.last_action,
            "lastRunning": self.last_running,
            "lastError": self.last_error,
        }


class WorkerManager:
    def __init__(self, home: Path, arbiter: LlamaSwapArbiter | None = None) -> None:
        self.home = home
        self.runtime_dir = home / "runtime"
        self.logs_dir = home / "logs"
        self.process: subprocess.Popen[bytes] | None = None
        self.process_log: Any = None
        self.active_model: str | None = None
        self.lock = asyncio.Lock()
        self.arbiter = arbiter or LlamaSwapArbiter()
        # Keeping a PyTorch worker resident conflicts with the normal pCAD flow:
        # after create_mesh returns, the Creative agent usually needs its LLM
        # again. Default to cold workers so llama-swap can immediately reload.
        self.keep_warm = env_bool("PCAD_MESH_KEEP_WARM", False)

    def paths(self, model: str) -> tuple[Path, Path]:
        if model not in MODEL_LAYOUT:
            raise ValueError(f"Unknown local mesh backend: {model}")
        env_name, repo_name = MODEL_LAYOUT[model]
        return self.home / "envs" / env_name, self.home / "repos" / repo_name

    def installed(self, model: str) -> bool:
        env_dir, repo_dir = self.paths(model)
        return (env_dir / "bin" / "python").is_file() and repo_dir.is_dir()

    def model_status(self, model: str) -> dict[str, Any]:
        installed = self.installed(model)
        return {
            "installed": installed,
            "available": installed,
            "active": self.active_model == model and self.process is not None and self.process.poll() is None,
        }

    async def stop_worker(self) -> None:
        process = self.process
        self.process = None
        self.active_model = None
        if process is None:
            self._close_log()
            return
        if process.poll() is None:
            try:
                process.send_signal(signal.SIGTERM)
                await asyncio.to_thread(process.wait, WORKER_STOP_TIMEOUT)
            except (subprocess.TimeoutExpired, ProcessLookupError):
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                await asyncio.to_thread(process.wait)
        self._close_log()
        # CUDA contexts normally disappear immediately at process exit. A short
        # delay avoids racing a new context with driver cleanup on consumer GPUs.
        await asyncio.sleep(0.75)

    def _close_log(self) -> None:
        if self.process_log is not None:
            try:
                self.process_log.close()
            except Exception:
                pass
            self.process_log = None

    async def ensure_worker(self, model: str) -> None:
        if model not in MODEL_LAYOUT:
            raise HTTPException(status_code=400, detail=f"Unknown local mesh backend: {model}")
        if not self.installed(model):
            raise HTTPException(
                status_code=503,
                detail=f"{model} is not installed; run scripts/install-local-mesh-backends.sh",
            )

        if (
            self.active_model == model
            and self.process is not None
            and self.process.poll() is None
        ):
            return

        await self.stop_worker()
        env_dir, repo_dir = self.paths(model)
        python = env_dir / "bin" / "python"
        worker = self.runtime_dir / "worker.py"
        if not worker.is_file():
            raise HTTPException(status_code=503, detail=f"Runtime worker is missing: {worker}")

        self.logs_dir.mkdir(parents=True, exist_ok=True)
        safe_name = model.replace("/", "-").replace(".", "-")
        log_path = self.logs_dir / f"worker-{safe_name}.log"
        self.process_log = open(log_path, "ab", buffering=0)
        environment = os.environ.copy()
        environment.setdefault("HF_HOME", str(self.home / "cache" / "huggingface"))
        environment["PYTHONUNBUFFERED"] = "1"
        environment.setdefault("TOKENIZERS_PARALLELISM", "false")

        self.process = subprocess.Popen(
            [
                str(python),
                str(worker),
                "--model",
                model,
                "--repo",
                str(repo_dir),
                "--host",
                WORKER_HOST,
                "--port",
                str(WORKER_PORT),
            ],
            cwd=repo_dir,
            env=environment,
            stdout=self.process_log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        self.active_model = model

        deadline = time.monotonic() + WORKER_START_TIMEOUT
        last_error = "worker did not answer"
        async with httpx.AsyncClient(timeout=2.0) as client:
            while time.monotonic() < deadline:
                if self.process.poll() is not None:
                    code = self.process.returncode
                    await self.stop_worker()
                    raise HTTPException(
                        status_code=503,
                        detail=f"{model} worker exited during startup (code {code}); see {log_path}",
                    )
                try:
                    response = await client.get(f"{WORKER_URL}/health")
                    if response.is_success:
                        return
                    last_error = f"HTTP {response.status_code}"
                except Exception as exc:
                    last_error = str(exc)
                await asyncio.sleep(0.5)

        await self.stop_worker()
        raise HTTPException(
            status_code=503,
            detail=f"Timed out starting {model}: {last_error}; see {log_path}",
        )

    async def generate(self, request: GenerateRequest) -> bytes:
        # A single lock serializes both llama-swap eviction and mesh inference.
        # This is an explicit one-GPU policy, not an accidental queue.
        async with self.lock:
            await self.arbiter.prepare_for_mesh()
            try:
                await self.ensure_worker(request.model)
                try:
                    async with httpx.AsyncClient(timeout=GENERATION_TIMEOUT) as client:
                        response = await client.post(
                            f"{WORKER_URL}/v1/generate",
                            json=request.model_dump(exclude_none=True),
                        )
                except httpx.TimeoutException as exc:
                    raise HTTPException(status_code=504, detail="Local mesh generation timed out") from exc
                except Exception as exc:
                    raise HTTPException(status_code=502, detail=f"Local mesh worker request failed: {exc}") from exc

                if not response.is_success:
                    try:
                        payload = response.json()
                        detail = payload.get("detail") or payload.get("error") or response.text
                    except Exception:
                        detail = response.text
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"{request.model}: {detail}",
                    )
                if len(response.content) < 20:
                    raise HTTPException(status_code=502, detail="Local mesh worker returned an empty GLB")
                return response.content
            finally:
                if not self.keep_warm:
                    await self.stop_worker()


def build_app(manager: WorkerManager) -> FastAPI:
    app = FastAPI(title="pCAD local mesh gateway")

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "activeModel": manager.active_model,
            "keepWarm": manager.keep_warm,
            "arbitration": manager.arbiter.status(),
            "models": {model: manager.model_status(model) for model in MODEL_LAYOUT},
        }

    @app.post("/v1/generate")
    async def generate(request: GenerateRequest) -> Response:
        if request.model not in MODEL_LAYOUT:
            raise HTTPException(status_code=400, detail=f"Unknown local mesh backend: {request.model}")
        data = await manager.generate(request)
        return Response(content=data, media_type="model/gltf-binary")

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await manager.stop_worker()

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8180)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    home = Path(
        os.environ.get("PCAD_MESH_HOME", "~/.local/share/pcad-mesh")
    ).expanduser().resolve()
    home.mkdir(parents=True, exist_ok=True)

    import uvicorn

    uvicorn.run(build_app(WorkerManager(home)), host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
