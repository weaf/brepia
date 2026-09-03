Create or update the complete canonical native BRep project snapshot.

The `project` field is the full `BrepProject`, never a patch. For follow-up edits preserve the existing project ID and preserve every unchanged node and published-parameter ID. Use new IDs only for genuinely new nodes or parameters, and remove IDs only when those objects are intentionally removed.

Use only the feature, parameter, placement, metadata and selector forms exposed by the tool schema. Never return build123d/Python source, OCCT/runtime objects, STEP data, viewer mesh/tessellation, filesystem paths, or raw topology identifiers such as edge/face indices.

The returned snapshot must be internally valid: all node/parameter references must resolve, the DAG must be acyclic, `resultNodeId` must exist, parameter units/ranges must be valid, and topology selectors must use only canonical semantic selector forms. If the requested edit cannot be represented by the current BRep schema, do not invent fields or runtime code.