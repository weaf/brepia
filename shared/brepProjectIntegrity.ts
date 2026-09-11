import {
  normalizeBrepProject,
  type BrepNode,
  type BrepProject,
  type BrepScalar,
  type BrepVector3,
} from './brepProject.ts';
import {
  brepNodeScalarParameterReferences,
  brepScalarParameterReferences,
} from './brepScalar.ts';

export type BrepParameterEffectiveness =
  | 'effective'
  | 'semantic-only'
  | 'orphan-only'
  | 'unused';

export type BrepProjectIntegrityAnalysis = {
  /** Dependency closure rooted at the canonical primary result. */
  resultReachableNodeIds: string[];
  /** Dependency closure rooted at project-object geometry roles. */
  roleReachableNodeIds: string[];
  /** Union of primary-result and role reachability. */
  authoritativeReachableNodeIds: string[];
  /** Feature nodes that cannot influence any authoritative geometry output. */
  orphanNodeIds: string[];
  parameterClassifications: Readonly<Record<string, BrepParameterEffectiveness>>;
  effectiveParameterIds: string[];
  semanticOnlyParameterIds: string[];
  orphanOnlyParameterIds: string[];
  unusedParameterIds: string[];
};

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
}

function nodeDependencies(node: BrepNode): string[] {
  switch (node.type) {
    case 'box':
    case 'cylinder':
      return [];
    case 'transform':
    case 'mirror':
    case 'fillet':
      return [node.input];
    case 'subtract':
      return [node.base, ...node.tools];
    case 'union':
    case 'intersect':
      return node.inputs;
  }
}

function appendScalarParameters(
  parameters: Set<string>,
  scalar: BrepScalar,
): void {
  for (const parameter of brepScalarParameterReferences(scalar)) {
    parameters.add(parameter);
  }
}

function appendVectorParameters(
  parameters: Set<string>,
  vector: BrepVector3 | undefined,
): void {
  if (!vector) return;
  for (const scalar of vector) appendScalarParameters(parameters, scalar);
}

function semanticParameterReferences(project: BrepProject): Set<string> {
  const parameters = new Set<string>();
  appendVectorParameters(parameters, project.placement.origin);
  appendVectorParameters(parameters, project.placement.xAxis);
  appendVectorParameters(parameters, project.placement.yAxis);
  for (const point of project.projectObject?.points ?? []) {
    appendVectorParameters(parameters, point.position);
    appendVectorParameters(parameters, point.direction);
  }
  return parameters;
}

function reachableNodeIds(
  project: BrepProject,
  roots: readonly string[],
): Set<string> {
  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));
  const reachable = new Set<string>();
  const pending = [...roots];

  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || reachable.has(nodeId)) continue;
    const node = nodesById.get(nodeId);
    if (!node) continue;
    reachable.add(nodeId);
    pending.push(...nodeDependencies(node));
  }

  return reachable;
}

function parameterReferencesForNodes(
  project: BrepProject,
  nodeIds: ReadonlySet<string>,
): Set<string> {
  const parameters = new Set<string>();
  for (const node of project.nodes) {
    if (!nodeIds.has(node.id)) continue;
    for (const parameterId of brepNodeScalarParameterReferences(node)) {
      parameters.add(parameterId);
    }
  }
  return parameters;
}

/**
 * Deterministically classify canonical graph reachability and published
 * parameter effectiveness without changing schema validity. This is a shared
 * analysis boundary: legacy/manual/imported v1 projects remain valid canonical
 * snapshots even when this analysis reports graph-integrity diagnostics.
 *
 * A parameter is effective when it influences a feature in the dependency
 * closure of resultNodeId or an explicit project-object geometry role,
 * including references nested inside M1 scalar expressions. References from
 * placement and semantic points are classified as semantic-only when the
 * parameter is not referenced by any feature node. Parameters referenced by
 * orphan feature nodes remain orphan-only even when they are also referenced
 * by semantic data, because they still expose a disconnected geometry
 * dependency. Parameters with no references are unused.
 */
export function analyzeBrepProjectIntegrity(
  projectInput: unknown,
): BrepProjectIntegrityAnalysis {
  const project = normalizeBrepProject(projectInput);
  const resultReachable = reachableNodeIds(project, [project.resultNodeId]);
  const roleRoots = [
    project.projectObject?.footprintNodeId,
    project.projectObject?.clearanceEnvelopeNodeId,
    project.projectObject?.maintenanceEnvelopeNodeId,
  ].filter((nodeId): nodeId is string => Boolean(nodeId));
  const roleReachable = reachableNodeIds(project, roleRoots);
  const authoritativeReachable = new Set([
    ...resultReachable,
    ...roleReachable,
  ]);
  const orphanNodeIds = sorted(
    project.nodes
      .map((node) => node.id)
      .filter((nodeId) => !authoritativeReachable.has(nodeId)),
  );
  const orphanNodes = new Set(orphanNodeIds);

  const authoritativeParameters = parameterReferencesForNodes(
    project,
    authoritativeReachable,
  );
  const orphanParameters = parameterReferencesForNodes(project, orphanNodes);
  const semanticParameters = semanticParameterReferences(project);

  const parameterClassifications: Record<string, BrepParameterEffectiveness> = {};
  const effectiveParameterIds: string[] = [];
  const semanticOnlyParameterIds: string[] = [];
  const orphanOnlyParameterIds: string[] = [];
  const unusedParameterIds: string[] = [];

  for (const parameter of project.parameters) {
    let classification: BrepParameterEffectiveness;
    if (authoritativeParameters.has(parameter.id)) {
      classification = 'effective';
      effectiveParameterIds.push(parameter.id);
    } else if (orphanParameters.has(parameter.id)) {
      classification = 'orphan-only';
      orphanOnlyParameterIds.push(parameter.id);
    } else if (semanticParameters.has(parameter.id)) {
      classification = 'semantic-only';
      semanticOnlyParameterIds.push(parameter.id);
    } else {
      classification = 'unused';
      unusedParameterIds.push(parameter.id);
    }
    parameterClassifications[parameter.id] = classification;
  }

  return {
    resultReachableNodeIds: sorted(resultReachable),
    roleReachableNodeIds: sorted(roleReachable),
    authoritativeReachableNodeIds: sorted(authoritativeReachable),
    orphanNodeIds,
    parameterClassifications,
    effectiveParameterIds: sorted(effectiveParameterIds),
    semanticOnlyParameterIds: sorted(semanticOnlyParameterIds),
    orphanOnlyParameterIds: sorted(orphanOnlyParameterIds),
    unusedParameterIds: sorted(unusedParameterIds),
  };
}
