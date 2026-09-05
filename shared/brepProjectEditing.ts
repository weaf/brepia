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
    throw new Error('Phase 4A node editing cannot rename stable BRep node IDs.');
  }
  if (nextNode.type !== currentNode.type) {
    throw new Error('Phase 4A node editing cannot change BRep node type.');
  }

  return normalizeBrepProject({
    ...project,
    nodes: project.nodes.map((node) =>
      node.id === nodeId ? nextNode : node,
    ),
  });
}
