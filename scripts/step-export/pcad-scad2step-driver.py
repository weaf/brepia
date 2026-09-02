"""Brepia compatibility driver for the pinned scad123d STEP provider.

The provider remains pinned. This driver contains two narrowly scoped
compatibility fallbacks:

1. Non-planar polyhedron faces that OCCT cannot construct analytically are
   meshed only for that subtree.
2. Explicit asset-backed projects requested with mesh_scope='hoist' are
   rendered by OpenSCAD from the original project entrypoint, preserving
   relative project/asset paths instead of scad123d's temporary CSG directory.
"""

import importlib
import subprocess
import tempfile
import warnings
from pathlib import Path

from build123d import Mesher
from scad123d.errors import MeshFallbackWarning, OpenSCADRunError
from scad123d.openscad import require_openscad, scad_literal

scad_build = importlib.import_module("scad123d.build")
scad_cli = importlib.import_module("scad123d.cli")

_original_build = scad_build._build
_original_import_scad = scad_cli.import_scad


def _brepia_build(node, options):
    try:
        return _original_build(node, options)
    except ValueError as error:
        if (
            node.name == "polyhedron"
            and "wires not planar" in str(error).lower()
        ):
            return scad_build._fallback(
                node,
                options,
                "polyhedron contains a non-planar face",
            )
        raise


def _hoisted_project_mesh(
    path,
    *,
    timeout,
    overrides,
):
    source_path = Path(path).resolve()
    binary = require_openscad()

    with tempfile.TemporaryDirectory(prefix="brepia-step-hoist-") as temp_dir:
        output_path = Path(temp_dir) / "project.3mf"

        command = [
            str(binary),
            "-o",
            str(output_path),
        ]

        for key, value in overrides.items():
            command.extend(["-D", f"{key}={scad_literal(value)}"])

        command.append(str(source_path))

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise OpenSCADRunError(
                f"OpenSCAD project mesh fallback timed out after {timeout}s."
            ) from error

        if result.returncode != 0:
            raise OpenSCADRunError(
                "OpenSCAD project mesh fallback failed.\n"
                f"  command: {' '.join(command)}\n"
                f"  stderr: {result.stderr.strip()[:2000]}"
            )

        # OpenSCAD can exit 0 while silently dropping a missing import.
        # A validated/materialized Brepia project must never accept that as
        # a successful STEP conversion.
        missing_reference_lines = [
            line.strip()
            for line in result.stderr.splitlines()
            if "can't open" in line.lower()
        ]
        if missing_reference_lines:
            raise OpenSCADRunError(
                "OpenSCAD could not resolve a project reference during "
                "STEP mesh fallback:\n"
                + "\n".join(missing_reference_lines[:20])
            )

        if not output_path.is_file():
            raise OpenSCADRunError(
                "OpenSCAD project mesh fallback produced no 3MF output."
            )

        shapes = Mesher().read(str(output_path))

    if not shapes:
        raise OpenSCADRunError(
            "OpenSCAD project mesh fallback produced no geometry."
        )

    result_shape = shapes[0]
    for extra in shapes[1:]:
        result_shape = result_shape + extra

    if not result_shape.label:
        result_shape.label = source_path.stem

    return result_shape


def _brepia_import_scad(
    path,
    *,
    facet_threshold=scad_cli.DEFAULT_FACET_THRESHOLD,
    mesh_scope="minimal",
    timeout=600,
    heal=True,
    **overrides,
):
    if mesh_scope != "hoist":
        return _original_import_scad(
            path,
            facet_threshold=facet_threshold,
            mesh_scope=mesh_scope,
            timeout=timeout,
            heal=heal,
            **overrides,
        )

    warnings.warn(
        "scad123d: project contains explicit mesh/file assets; "
        "rendered from the original OpenSCAD project entrypoint so relative "
        "asset references remain authoritative. Analytic face selectors and "
        "fillets are unavailable on this exported mesh.",
        MeshFallbackWarning,
        stacklevel=2,
    )

    return _hoisted_project_mesh(
        path,
        timeout=timeout,
        overrides=overrides,
    )


scad_build._build = _brepia_build
scad_cli.import_scad = _brepia_import_scad

raise SystemExit(scad_cli.main())
