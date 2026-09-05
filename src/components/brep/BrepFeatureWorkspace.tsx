import { type ReactNode, useMemo, useState } from 'react';
import {
  BrepFeatureWorkspaceContext,
  type BrepWorkspaceView,
} from '@/components/brep/brepFeatureWorkspaceContext';

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
