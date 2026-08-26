#!/usr/bin/env python3
"""Inspect a generated STEP file with the same build123d/OCP stack as scad123d."""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

# build123d imports ezdxf, which otherwise tries to create this cache lazily and
# emits a harmless warning in the read-only inspection container. /tmp is a
# dedicated writable tmpfs for this process, so create the cache root first.
Path("/tmp/.cache/ezdxf").mkdir(parents=True, exist_ok=True)

from build123d import import_step  # noqa: E402


def parse_triplet(value: str) -> tuple[float, float, float]:
    parts = value.split(",")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("expected X,Y,Z")
    try:
        return tuple(float(part) for part in parts)  # type: ignore[return-value]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected numeric X,Y,Z") from exc


def parse_surface_requirement(value: str) -> tuple[str, int]:
    name, separator, count = value.partition("=")
    name = name.strip().upper()
    if not name:
        raise argparse.ArgumentTypeError("surface name cannot be empty")
    if not separator:
        return name, 1
    try:
        minimum = int(count)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("surface count must be an integer") from exc
    if minimum < 0:
        raise argparse.ArgumentTypeError("surface count must be >= 0")
    return name, minimum


def iter_tree(node):
    yield node
    for child in getattr(node, "children", ()) or ():
        yield from iter_tree(child)


def solid_shells_closed(solids) -> bool:
    """Return whether every imported solid is bounded by closed shells.

    build123d's Shape.is_manifold intentionally uses an edge-to-face ancestor
    count (two faces per edge). That is useful diagnostics for many B-Reps but
    reports False for valid periodic one-face solids such as a sphere, whose
    seam edge belongs to the same face twice. For a STEP watertightness gate,
    OCCT validity plus closed TopoDS shells is the appropriate invariant.
    """

    if not solids:
        return False
    for solid in solids:
        shells = list(solid.shells())
        if not shells or any(not shell.wrapped.Closed() for shell in shells):
            return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("step", type=Path)
    parser.add_argument("--expect-solids", type=int)
    parser.add_argument("--min-solids", type=int, default=1)
    parser.add_argument("--min-faces", type=int, default=1)
    parser.add_argument("--expect-bbox", type=parse_triplet)
    parser.add_argument("--bbox-tol", type=float, default=0.02)
    parser.add_argument(
        "--require-surface",
        type=parse_surface_requirement,
        action="append",
        default=[],
        metavar="TYPE[=COUNT]",
    )
    parser.add_argument(
        "--forbid-surface",
        action="append",
        default=[],
        metavar="TYPE",
    )
    parser.add_argument("--min-colored-nodes", type=int, default=0)
    # Kept for corpus-test.sh compatibility. The default topology gate now
    # means valid solids bounded by closed shells rather than build123d's
    # stricter edge-ancestor manifold heuristic.
    parser.add_argument("--skip-manifold", action="store_true")
    args = parser.parse_args()

    if not args.step.is_file():
        print(f"STEP inspector: missing file: {args.step}", file=sys.stderr)
        return 2

    shape = import_step(args.step)
    solids = list(shape.solids())
    faces = list(shape.faces())
    edges = list(shape.edges())
    bbox = shape.bounding_box()

    surface_types = Counter(face.geom_type.name.upper() for face in faces)
    edge_types = Counter(edge.geom_type.name.upper() for edge in edges)
    nodes = list(iter_tree(shape))
    colored_nodes = sum(
        1 for node in nodes if getattr(node, "color", None) is not None
    )
    labels = sorted(
        {
            str(label)
            for node in nodes
            if (label := getattr(node, "label", ""))
        }
    )

    valid = bool(solids) and all(solid.is_valid for solid in solids)
    closed_shells = solid_shells_closed(solids)
    # Preserve this as diagnostics only. It is expected to be False for some
    # valid analytic periodic solids (notably a one-face sphere).
    edge_manifold = bool(solids) and all(solid.is_manifold for solid in solids)
    bbox_size = [bbox.size.X, bbox.size.Y, bbox.size.Z]

    summary = {
        "valid": valid,
        "closed_shells": closed_shells,
        "edge_manifold": edge_manifold,
        "solids": len(solids),
        "faces": len(faces),
        "edges": len(edges),
        "bbox_size": [round(value, 6) for value in bbox_size],
        "surface_types": dict(sorted(surface_types.items())),
        "edge_types": dict(sorted(edge_types.items())),
        "colored_nodes": colored_nodes,
        "labels": labels,
    }
    print(json.dumps(summary, sort_keys=True))

    failures: list[str] = []
    if not valid:
        failures.append("OpenCascade reports an invalid solid")
    if not args.skip_manifold and not closed_shells:
        failures.append("OpenCascade reports an open solid shell")
    if args.expect_solids is not None and len(solids) != args.expect_solids:
        failures.append(f"expected {args.expect_solids} solids, got {len(solids)}")
    if len(solids) < args.min_solids:
        failures.append(
            f"expected at least {args.min_solids} solids, got {len(solids)}"
        )
    if len(faces) < args.min_faces:
        failures.append(f"expected at least {args.min_faces} faces, got {len(faces)}")

    if args.expect_bbox is not None:
        for axis, actual, expected in zip("XYZ", bbox_size, args.expect_bbox):
            if not math.isclose(
                actual, expected, rel_tol=0.0, abs_tol=args.bbox_tol
            ):
                failures.append(
                    f"bbox {axis} expected {expected:g}, got {actual:.6g} "
                    f"(tol {args.bbox_tol:g})"
                )

    for surface_name, minimum in args.require_surface:
        actual = surface_types.get(surface_name, 0)
        if actual < minimum:
            failures.append(
                f"expected at least {minimum} {surface_name} surface(s), got {actual}"
            )

    for surface_name in args.forbid_surface:
        normalized = surface_name.strip().upper()
        actual = surface_types.get(normalized, 0)
        if actual:
            failures.append(
                f"forbidden surface {normalized} present {actual} time(s)"
            )

    if colored_nodes < args.min_colored_nodes:
        failures.append(
            f"expected at least {args.min_colored_nodes} colored assembly node(s), "
            f"got {colored_nodes}"
        )

    if failures:
        for failure in failures:
            print(f"STEP inspector FAIL: {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
