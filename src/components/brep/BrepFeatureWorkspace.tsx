import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { BrepProject } from '@shared/brepProject';

export type BrepWorkspaceView = 'model' | 'graph';

type EditRequest = {
  nodeId: string;
  nonce: number;
};

type BrepFeatureWorkspaceContextValue = {
  view: BrepWorkspaceView;
  setView: (view: BrepWorkspaceView) => void;
  selectedNodeId: string | null;
  selectNode: (nodeId: string) => void;
  editRequest: EditRequest | null;
  requestEditNode: (nodeId: string) => void;
  clearEditRequest: (nonce: number) => void;
};

const BrepFeatureWorkspaceContext =
  createContext<BrepFeatureWorkspaceContextValue | null>(null);

export function BrepFeatureWorkspaceProvider({
  project,
  children,
}: {
  project: BrepProject;
  children: ReactNode;
}) {
  const [view, setView] = useState<BrepWorkspaceView>('model');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    project.resultNodeId || project.nodes[0]?.id || null,
  );
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [editNonce, setEditNonce] = useState(0);

  useEffect(() => {
    if (
      selectedNodeId &&
      project.nodes.some((node) => node.id === selectedNodeId)
    ) {
      return;
    }
    setSelectedNodeId(project.resultNodeId || project.nodes[0]?.id || null);
  }, [project.nodes, project.resultNodeId, selectedNodeId]);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const requestEditNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setEditNonce((current) => {
      const nonce = current + 1;
      setEditRequest({ nodeId, nonce });
      return nonce;
    });
  }, []);

  const clearEditRequest = useCallback((nonce: number) => {
    setEditRequest((current) =>
      current?.nonce === nonce ? null : current,
    );
  }, []);

  const value = useMemo<BrepFeatureWorkspaceContextValue>(
    () => ({
      view,
      setView,
      selectedNodeId,
      selectNode,
      editRequest,
      requestEditNode,
      clearEditRequest,
    }),
    [
      clearEditRequest,
      editRequest,
      requestEditNode,
      selectNode,
      selectedNodeId,
      view,
    ],
  );

  return (
    <BrepFeatureWorkspaceContext.Provider value={value}>
      {children}
    </BrepFeatureWorkspaceContext.Provider>
  );
}

export function useBrepFeatureWorkspace(): BrepFeatureWorkspaceContextValue {
  const value = useContext(BrepFeatureWorkspaceContext);
  if (!value) {
    throw new Error(
      'BRep feature workspace controls require BrepFeatureWorkspaceProvider.',
    );
  }
  return value;
}
