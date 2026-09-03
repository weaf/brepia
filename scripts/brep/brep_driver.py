"""Constrained build123d evaluator. Input is normalized Brepia JSON, never user Python."""
import json
import sys
from pathlib import Path

from build123d import Box, Cylinder, Location, Rotation, export_step

PROVIDER = {"id": "build123d-occt", "providerVersion": "0.1.0", "kernelVersion": "build123d-0.8.0"}

def scalar(value, parameters):
    return parameters[value["parameter"]] if isinstance(value, dict) else value

def vector(value, parameters):
    return tuple(scalar(item, parameters) for item in value)

def bounds(shape):
    box = shape.bounding_box()
    return {"min": [box.min.X, box.min.Y, box.min.Z], "max": [box.max.X, box.max.Y, box.max.Z]}

def mesh(shape, body_id):
    vertices, triangles = shape.tessellate(0.25)
    positions = [coordinate for vertex in vertices for coordinate in (vertex.X, vertex.Y, vertex.Z)]
    indices = [index for triangle in triangles for index in triangle]
    # build123d tessellation does not guarantee normals. Browser consumers can
    # compute them; this bounded neutral payload explicitly represents that.
    return {"bodyId": body_id, "positions": positions, "normals": [0.0] * len(positions), "indices": indices}

def axis_edges(shape, axis):
    wanted = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1)}[axis]
    selected = []
    for edge in shape.edges():
        tangent = edge.tangent_at(0.5)
        length = (tangent.X ** 2 + tangent.Y ** 2 + tangent.Z ** 2) ** 0.5
        if length and abs(abs(tangent.X / length) - wanted[0]) < 1e-6 and abs(abs(tangent.Y / length) - wanted[1]) < 1e-6 and abs(abs(tangent.Z / length) - wanted[2]) < 1e-6:
            selected.append(edge)
    if not selected:
        raise ValueError(f"ambiguous_selection: no edges parallel to {axis}")
    return selected

def evaluate(request):
    project = request["project"]
    parameters = request["parameterValues"]
    shapes = {}
    for node in project["nodes"]:
        kind = node["type"]
        if kind == "box": shape = Box(scalar(node["width"], parameters), scalar(node["depth"], parameters), scalar(node["height"], parameters))
        elif kind == "cylinder": shape = Cylinder(scalar(node["radius"], parameters), scalar(node["height"], parameters))
        elif kind == "transform":
            shape = shapes[node["input"]]
            translation = vector(node.get("translate", [0, 0, 0]), parameters)
            rotation = vector(node.get("rotateDeg", [0, 0, 0]), parameters)
            shape = shape.moved(Location(translation, Rotation(*rotation)))
        elif kind == "subtract":
            shape = shapes[node["base"]]
            for tool in node["tools"]: shape = shape - shapes[tool]
        elif kind == "fillet":
            shape = shapes[node["input"]].fillet(scalar(node["radius"], parameters), axis_edges(shapes[node["input"]], node["selector"]["axis"]))
        else: raise ValueError(f"unsupported_operation: {kind}")
        shapes[node["id"]] = shape
    result_id = project["resultNodeId"]
    result = shapes[result_id]
    result_bounds = bounds(result)
    return result, {"status": "success", "provider": PROVIDER, "projectId": project["id"], "resultNodeId": result_id, "bodies": [{"id": result_id, "bounds": result_bounds, "viewerMesh": mesh(result, result_id)}], "bounds": result_bounds, "warnings": [], "exactExport": {"format": "step", "available": True}}

if __name__ == "__main__":
    try:
        request = json.loads(Path(sys.argv[1]).read_text())
        output = Path(sys.argv[2]); output.mkdir(parents=True, exist_ok=True)
        shape, result = evaluate(request)
        export_step(shape, output / "model.step")
        (output / "result.json").write_text(json.dumps(result, separators=(",", ":")))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
