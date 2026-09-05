import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

export const BREP_GRAPH_WORKSPACE_TARGET_ID = 'brep-graph-workspace-target';

export type BrepWorkspaceView = 'model' | 'graph';

type BrepFeatureWorkspaceContextValue = {
  view: BrepWorkspaceView;
  setView: (view: BrepWorkspaceView) => void;
};

const BrepFeatureWorkspaceContext =
  createContext<BrepFeatureWorkspaceContextValue | null>(null);

export function BrepFeatureWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [view, setView] = useState<BrepWorkspaceView>('model');
  const value = useMemo(() => ({ view, setView }), [view]);

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
