"""Constrained build123d evaluator. Input is normalized Brepia JSON, never user Python."""
import json
import sys
from pathlib import Path

import rhino3dm
from build123d import Box, Cylinder, Location, export_step

PROVIDER = {"id": "build123d-occt", "providerVersion": "0.3.0", "kernelVersion": "build123d-0.11.1/OCCT-7.9.3.1"}
THREEDM_VERSION = 8
THREEDM_EXACT_STEP_NAME = "brepia-primary.step"


def scalar(value, parameters):
    return parameters[value["parameter"]] if isinstance(value, dict) else value


def vector(value, parameters):
    return tuple(scalar(item, parameters) for item in value)


def cross(left, right):
    return (
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    )


def resolved_placement(placement, parameters):
    origin = vector(placement["origin"], parameters)
    x_axis = vector(placement["xAxis"], parameters)
    y_axis = vector(placement["yAxis"], parameters)
    return {"origin": origin, "xAxis": x_axis, "yAxis": y_axis, "zAxis": cross(x_axis, y_axis)}


def resolved_point(point, parameters):
    result = {
        "id": point["id"],
        "kind": point["kind"],
        "position": vector(point["position"], parameters),
    }
    if "direction" in point:
        result["direction"] = vector(point["direction"], parameters)
    if "label" in point:
        result["label"] = point["label"]
    return result


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


def compact_json(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def set_user_strings(attributes, values):
    for key, value in values.items():
        if value is None:
            continue
        attributes.SetUserString(key, value if isinstance(value, str) else compact_json(value))


def rhino_mesh(viewer_mesh):
    target = rhino3dm.Mesh()
    positions = viewer_mesh["positions"]
    indices = viewer_mesh["indices"]
    for index in range(0, len(positions), 3):
        target.Vertices.Add(positions[index], positions[index + 1], positions[index + 2])
    for index in range(0, len(indices), 3):
        target.Faces.AddFace(indices[index], indices[index + 1], indices[index + 2])
    return target


def write_3dm(project, result, step_path, three_dm_path):
    model = rhino3dm.File3dm()
    model.Settings.ModelUnitSystem = rhino3dm.UnitSystem.Millimeters

    placement = result["projectObject"]["placement"]
    metadata = result["projectObject"].get("metadata")
    definition = project.get("projectObject") or {}
    role_node_ids = {
        "footprint": definition.get("footprintNodeId"),
        "clearanceEnvelope": definition.get("clearanceEnvelopeNodeId"),
        "maintenanceEnvelope": definition.get("maintenanceEnvelopeNodeId"),
    }
    semantic_contract = {
        "roles": {key: value for key, value in role_node_ids.items() if value},
        "points": result["projectObject"]["points"],
    }
    document_strings = {
        "brepia.schemaVersion": str(project["schemaVersion"]),
        "brepia.projectId": project["id"],
        "brepia.resultNodeId": project["resultNodeId"],
        "brepia.provider": compact_json(PROVIDER),
        "brepia.units": project["units"],
        "brepia.geometryRepresentation": "tessellated-mesh",
        "brepia.exactPrimaryArtifact": f"embedded:{THREEDM_EXACT_STEP_NAME}",
        "brepia.placement": compact_json(placement),
        "brepia.projectObject": compact_json(semantic_contract),
    }
    if metadata is not None:
        document_strings["brepia.metadata"] = compact_json(metadata)
    for key, value in document_strings.items():
        model.Strings.SetString(key, value)

    bodies = {body["id"]: body for body in result["bodies"]}
    for body in result["projectObject"]["geometry"].values():
        bodies[body["id"]] = body

    roles_by_node = {project["resultNodeId"]: ["result"]}
    for role, node_id in role_node_ids.items():
        if node_id:
            roles_by_node.setdefault(node_id, []).append(role)

    for node_id, roles in roles_by_node.items():
        body = bodies[node_id]
        attributes = rhino3dm.ObjectAttributes()
        attributes.Name = node_id
        set_user_strings(
            attributes,
            {
                "brepia.projectId": project["id"],
                "brepia.nodeId": node_id,
                "brepia.roles": roles,
                "brepia.representation": "tessellated-mesh",
            },
        )
        model.Objects.AddMesh(rhino_mesh(body["viewerMesh"]), attributes)

    for point in result["projectObject"]["points"]:
        attributes = rhino3dm.ObjectAttributes()
        attributes.Name = point["id"]
        set_user_strings(
            attributes,
            {
                "brepia.projectId": project["id"],
                "brepia.pointId": point["id"],
                "brepia.kind": point["kind"],
                "brepia.label": point.get("label"),
                "brepia.direction": point.get("direction"),
            },
        )
        x, y, z = point["position"]
        model.Objects.AddPoint(x, y, z, attributes)

    embedded = rhino3dm.EmbeddedFile.Read(str(step_path))
    if embedded is None:
        raise ValueError("3dm_export_failed: could not embed exact primary STEP")
    embedded.Filename = THREEDM_EXACT_STEP_NAME
    model.EmbeddedFiles.Add(embedded)

    if not model.Write(str(three_dm_path), THREEDM_VERSION):
        raise ValueError("3dm_export_failed: rhino3dm could not write model.3dm")

    # Fail closed inside the native sandbox too: independently re-open the
    # written document, verify the core semantic contract and prove that the
    # embedded exact STEP survives the 3DM serialization round trip.
    check = rhino3dm.File3dm.Read(str(three_dm_path))
    if check is None:
        raise ValueError("3dm_export_failed: rhino3dm could not re-open model.3dm")
    if check.Settings.ModelUnitSystem != rhino3dm.UnitSystem.Millimeters:
        raise ValueError("3dm_export_failed: model units are not millimetres")
    if check.Strings["brepia.projectId"] != project["id"]:
        raise ValueError("3dm_export_failed: project identity did not round trip")
    if check.Strings["brepia.placement"] != compact_json(placement):
        raise ValueError("3dm_export_failed: placement did not round trip")
    if len(check.EmbeddedFiles) != 1:
        raise ValueError("3dm_export_failed: exact STEP embedding did not round trip")
    embedded_check = check.EmbeddedFiles[0]
    if embedded_check.Filename != THREEDM_EXACT_STEP_NAME:
        raise ValueError("3dm_export_failed: embedded STEP identity did not round trip")
    extracted_step = three_dm_path.with_suffix(".embedded.step")
    if not embedded_check.Write(str(extracted_step)):
        raise ValueError("3dm_export_failed: embedded STEP could not be extracted")
    try:
        if b"ISO-10303-21" not in extracted_step.read_bytes()[:128]:
            raise ValueError("3dm_export_failed: embedded exact STEP is invalid")
    finally:
        extracted_step.unlink(missing_ok=True)


def evaluate(request):
    project = request["project"]
    parameters = request["parameterValues"]
    shapes = {}
    body_payloads = {}
    nodes = {node["id"]: node for node in project["nodes"]}

    def evaluate_node(node_id):
        if node_id in shapes:
            return shapes[node_id]
        node = nodes[node_id]
        kind = node["type"]
        if kind == "box": shape = Box(scalar(node["width"], parameters), scalar(node["depth"], parameters), scalar(node["height"], parameters))
        elif kind == "cylinder": shape = Cylinder(scalar(node["radius"], parameters), scalar(node["height"], parameters))
        elif kind == "transform":
            shape = evaluate_node(node["input"])
            translation = vector(node.get("translate", [0, 0, 0]), parameters)
            rotation = vector(node.get("rotateDeg", [0, 0, 0]), parameters)
            shape = shape.moved(Location(translation, rotation))
        elif kind == "subtract":
            shape = evaluate_node(node["base"])
            for tool in node["tools"]: shape = shape - evaluate_node(tool)
        elif kind == "fillet":
            input_shape = evaluate_node(node["input"])
            shape = input_shape.fillet(scalar(node["radius"], parameters), axis_edges(input_shape, node["selector"]["axis"]))
        else: raise ValueError(f"unsupported_operation: {kind}")
        shapes[node_id] = shape
        return shape

    def evaluated_body(node_id):
        if node_id in body_payloads:
            return body_payloads[node_id]
        shape = evaluate_node(node_id)
        payload = {"id": node_id, "bounds": bounds(shape), "viewerMesh": mesh(shape, node_id)}
        body_payloads[node_id] = payload
        return payload

    result_id = project["resultNodeId"]
    result = evaluate_node(result_id)
    primary_body = evaluated_body(result_id)

    definition = project.get("projectObject") or {}
    geometry = {}
    role_fields = (
        ("footprint", "footprintNodeId"),
        ("clearanceEnvelope", "clearanceEnvelopeNodeId"),
        ("maintenanceEnvelope", "maintenanceEnvelopeNodeId"),
    )
    for role, field in role_fields:
        node_id = definition.get(field)
        if node_id:
            geometry[role] = evaluated_body(node_id)

    project_object = {
        "placement": resolved_placement(project["placement"], parameters),
        "geometry": geometry,
        "points": [resolved_point(point, parameters) for point in definition.get("points", [])],
    }
    if "metadata" in project:
        project_object["metadata"] = project["metadata"]

    return result, {
        "status": "success",
        "provider": PROVIDER,
        "projectId": project["id"],
        "resultNodeId": result_id,
        "bodies": [primary_body],
        "bounds": primary_body["bounds"],
        "projectObject": project_object,
        "warnings": [],
        "exactExport": {"format": "step", "available": True},
    }


if __name__ == "__main__":
    try:
        request = json.loads(Path(sys.argv[1]).read_text())
        output = Path(sys.argv[2]); output.mkdir(parents=True, exist_ok=True)
        shape, result = evaluate(request)
        step_path = output / "model.step"
        export_step(shape, step_path)
        write_3dm(request["project"], result, step_path, output / "model.3dm")
        (output / "result.json").write_text(json.dumps(result, separators=(",", ":")))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
