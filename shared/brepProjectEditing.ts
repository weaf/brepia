import {
  normalizeBrepProject,
  type BrepNode,
  type BrepProject,
} from './brepProject.ts';

export function brepNodeDependencies(node: BrepNode): string[] {
  switch (node.type) {
    case 'box':
    case 'cylinder':
      return [];
    case 'transform':
    case 'fillet':
      return [node.input];
    case 'subtract':
      return [node.base, ...node.tools];
  }
}

export function brepNodeConsumers(
  project: BrepProject,
  nodeId: string,
): string[] {
  return project.nodes
    .filter((node) => brepNodeDependencies(node).includes(nodeId))
    .map((node) => node.id);
}

export function suggestBrepNodeId(
  project: BrepProject,
  type: BrepNode['type'],
): string {
  const existing = new Set(project.nodes.map((node) => node.id));
  if (!existing.has(type)) return type;
  for (let index = 2; index <= project.nodes.length + 2; index += 1) {
    const candidate = `${type}${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error(`Could not suggest a unique BRep node ID for ${type}.`);
}

/**
 * Phase 4A edits the fields of an existing semantic feature while keeping its
 * stable identity and node type. The complete project is normalized again so
 * reference, parameter-unit and DAG validation stays centralized in the
 * canonical BrepProject contract.
 */
export function replaceExistingBrepProjectNode(
  project: BrepProject,
  nodeId: string,
  nextNode: BrepNode,
): BrepProject {
  const currentNode = project.nodes.find((node) => node.id === nodeId);
  if (!currentNode) {
    throw new Error(`BRep node ${nodeId} does not exist in the current project.`);
  }
  if (nextNode.id !== nodeId) {
    throw new Error('Existing BRep node IDs are stable and cannot be renamed.');
  }
  if (nextNode.type !== currentNode.type) {
    throw new Error('Existing BRep node types cannot be changed in place.');
  }

  return normalizeBrepProject({
    ...project,
    nodes: project.nodes.map((node) =>
      node.id === nodeId ? nextNode : node,
    ),
  });
}

/** Add one new semantic node while preserving every existing stable node ID. */
export function addBrepProjectNode(
  project: BrepProject,
  node: BrepNode,
): BrepProject {
  if (project.nodes.some((current) => current.id === node.id)) {
    throw new Error(`BRep node ID ${node.id} already exists.`);
  }
  return normalizeBrepProject({
    ...project,
    nodes: [...project.nodes, node],
  });
}

/** Select an existing semantic node as the canonical project result. */
export function setBrepProjectResultNode(
  project: BrepProject,
  nodeId: string,
): BrepProject {
  if (!project.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`BRep result node ${nodeId} does not exist.`);
  }
  if (project.resultNodeId === nodeId) return normalizeBrepProject(project);
  return normalizeBrepProject({ ...project, resultNodeId: nodeId });
}

/**
 * Delete exactly one unreferenced, non-result node. Phase 4C intentionally
 * performs no implicit cascading rewrites; consumers/result authority must be
 * changed explicitly before a destructive delete is permitted.
 */
export function deleteBrepProjectNode(
  project: BrepProject,
  nodeId: string,
): BrepProject {
  if (!project.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`BRep node ${nodeId} does not exist in the current project.`);
  }
  if (project.resultNodeId === nodeId) {
    throw new Error(
      `BRep node ${nodeId} is the current result. Select another result before deleting it.`,
    );
  }
  const consumers = brepNodeConsumers(project, nodeId);
  if (consumers.length > 0) {
    throw new Error(
      `BRep node ${nodeId} is still used by ${consumers.join(', ')}. Rewire those consumers before deleting it.`,
    );
  }
  if (project.nodes.length <= 1) {
    throw new Error('A BRep project must keep at least one node.');
  }

  return normalizeBrepProject({
    ...project,
    nodes: project.nodes.filter((node) => node.id !== nodeId),
  });
}
