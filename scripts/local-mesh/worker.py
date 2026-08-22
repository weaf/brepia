#!/usr/bin/env python3
"""One-model-at-a-time inference worker for pCAD Creative mode.

The gateway launches this file with the Python interpreter belonging to the
selected backend environment. Heavy model imports therefore stay isolated and
VRAM is released by terminating the worker when the user switches backend.
"""

from __future__ import annotations

import argparse
import base64
import gc
import io
import os
import sys
import tempfile
from contextlib import nullcontext
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image


class GenerateRequest(BaseModel):
    model: str
    prompt: str | None = None
    images: list[str] = Field(default_factory=list)
    topology: str | None = None
    polygonCount: int | None = None
    outputFormat: str = "glb"


class Runtime:
    def __init__(self, model_id: str, repo: Path) -> None:
        self.model_id = model_id
        self.repo = repo
        self.pipeline: Any = None
        self.pipeline_kind: str | None = None
        self.aux: dict[str, Any] = {}

    @staticmethod
    def _empty_cuda_cache() -> None:
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass

    def unload(self) -> None:
        self.pipeline = None
        self.pipeline_kind = None
        self.aux.clear()
        gc.collect()
        self._empty_cuda_cache()

    @staticmethod
    def first_image(request: GenerateRequest) -> Image.Image:
        if not request.images:
            raise HTTPException(status_code=400, detail="This backend requires a reference image")
        return decode_image(request.images[0])

    def generate(self, request: GenerateRequest) -> bytes:
        if request.outputFormat.lower() != "glb":
            raise HTTPException(status_code=400, detail="Local pCAD mesh workers currently output GLB")

        if self.model_id == "local/trellis-v1":
            return self.generate_trellis(request)
        if self.model_id == "local/hunyuan3d-2":
            return self.generate_hunyuan2(request)
        if self.model_id == "local/hunyuan3d-2.1":
            return self.generate_hunyuan21(request)
        if self.model_id == "local/stable-fast-3d":
            return self.generate_sf3d(request)
        raise HTTPException(status_code=400, detail=f"Unsupported worker model: {self.model_id}")

    def generate_trellis(self, request: GenerateRequest) -> bytes:
        os.environ.setdefault("ATTN_BACKEND", "xformers")
        os.environ.setdefault("SPCONV_ALGO", "native")
        ensure_path(self.repo)

        from trellis.utils import postprocessing_utils

        desired = "image" if request.images else "text"
        if desired == "text" and not request.prompt:
            raise HTTPException(status_code=400, detail="TRELLIS text-to-3D requires a prompt")

        if self.pipeline is None or self.pipeline_kind != desired:
            self.unload()
            if desired == "image":
                from trellis.pipelines import TrellisImageTo3DPipeline

                self.pipeline = TrellisImageTo3DPipeline.from_pretrained(
                    "microsoft/TRELLIS-image-large"
                )
            else:
                from trellis.pipelines import TrellisTextTo3DPipeline

                self.pipeline = TrellisTextTo3DPipeline.from_pretrained(
                    "microsoft/TRELLIS-text-xlarge"
                )
            self.pipeline.cuda()
            self.pipeline_kind = desired

        if desired == "image":
            outputs = self.pipeline.run(self.first_image(request), seed=1)
        else:
            outputs = self.pipeline.run(request.prompt, seed=1)

        glb = postprocessing_utils.to_glb(
            outputs["gaussian"][0],
            outputs["mesh"][0],
            simplify=0.95,
            texture_size=1024,
        )
        return export_glb(glb)

    def generate_hunyuan2(self, request: GenerateRequest) -> bytes:
        ensure_path(self.repo)
        image = self.first_image(request)
        if self.pipeline is None:
            from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                "tencent/Hunyuan3D-2",
                subfolder="hunyuan3d-dit-v2-0",
                variant="fp16",
            )
            self.pipeline_kind = "image"

        mesh = self.pipeline(image=image)[0]
        return export_glb(mesh)

    def generate_hunyuan21(self, request: GenerateRequest) -> bytes:
        ensure_path(self.repo)
        ensure_path(self.repo / "hy3dshape")
        image = self.first_image(request)
        if self.pipeline is None:
            from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline

            self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                "tencent/Hunyuan3D-2.1",
                subfolder="hunyuan3d-dit-v2-1",
            )
            self.pipeline_kind = "image"

        # Shape-only is intentional for the initial pCAD integration. Official
        # Hunyuan3D-2.1 documents ~10 GB for shape, ~21 GB for paint and ~29 GB
        # with both resident. Keeping paint out makes this reliable on 24 GB.
        mesh = self.pipeline(image=image)[0]
        return export_glb(mesh)

    def generate_sf3d(self, request: GenerateRequest) -> bytes:
        ensure_path(self.repo)
        image = self.first_image(request).convert("RGBA")

        import rembg
        import torch
        from sf3d.system import SF3D
        from sf3d.utils import get_device, remove_background, resize_foreground

        if self.pipeline is None:
            self.pipeline = SF3D.from_pretrained(
                "stabilityai/stable-fast-3d",
                config_name="config.yaml",
                weight_name="model.safetensors",
            )
            device = get_device()
            if not torch.cuda.is_available():
                device = "cpu"
            self.aux["device"] = device
            self.pipeline.to(device)
            self.pipeline.eval()
            self.aux["rembg_session"] = rembg.new_session()
            self.pipeline_kind = "image"

        image = remove_background(image, self.aux["rembg_session"])
        image = resize_foreground(image, 0.85)
        device = self.aux["device"]
        remesh = {
            "quads": "quad",
            "polys": "triangle",
        }.get(request.topology or "", "none")
        vertex_count = request.polygonCount if request.polygonCount and request.polygonCount > 0 else -1

        with torch.no_grad():
            autocast = (
                torch.autocast(device_type="cuda", dtype=torch.bfloat16)
                if "cuda" in device
                else nullcontext()
            )
            with autocast:
                mesh, _ = self.pipeline.run_image(
                    [image],
                    bake_resolution=1024,
                    remesh=remesh,
                    vertex_count=vertex_count,
                )
        return export_glb(mesh, include_normals=True)


def ensure_path(path: Path) -> None:
    value = str(path.resolve())
    if value not in sys.path:
        sys.path.insert(0, value)


def decode_image(value: str) -> Image.Image:
    try:
        if value.startswith("data:"):
            _, encoded = value.split(",", 1)
            raw = base64.b64decode(encoded)
        else:
            raw = base64.b64decode(value)
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid reference image: {exc}") from exc


def export_glb(mesh: Any, *, include_normals: bool = False) -> bytes:
    with tempfile.TemporaryDirectory(prefix="pcad-mesh-worker-") as directory:
        path = Path(directory) / "mesh.glb"
        kwargs = {"include_normals": True} if include_normals else {}
        mesh.export(path, **kwargs)
        data = path.read_bytes()
    if len(data) < 20:
        raise RuntimeError("Backend produced an empty GLB")
    return data


def build_app(runtime: Runtime) -> FastAPI:
    app = FastAPI(title=f"pCAD mesh worker: {runtime.model_id}")

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "model": runtime.model_id,
            "loaded": runtime.pipeline is not None,
        }

    @app.post("/v1/generate")
    async def generate(request: GenerateRequest) -> Response:
        if request.model != runtime.model_id:
            raise HTTPException(
                status_code=409,
                detail=f"Worker is {runtime.model_id}, request asked for {request.model}",
            )
        try:
            data = runtime.generate(request)
        except HTTPException:
            raise
        except Exception as exc:
            import traceback

            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return Response(content=data, media_type="model/gltf-binary")

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8190)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo = Path(args.repo).expanduser().resolve()
    if not repo.is_dir():
        raise SystemExit(f"Backend repository is missing: {repo}")
    os.chdir(repo)

    import uvicorn

    runtime = Runtime(args.model, repo)
    uvicorn.run(build_app(runtime), host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
