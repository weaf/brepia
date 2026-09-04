import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { ChevronDown, Trash2 } from 'lucide-react';
import { ThreeScene } from '@/components/viewer/ThreeScene';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/services/api';
import { exportBrepStep } from '@/services/brepStepExport';
import { downloadSTEPFile } from '@/utils/downloadUtils';
import type { BrepProject } from '@shared/brepProject';
import {
  createBrepProjectPackage,
  serializeBrepProjectPackage,
} from '@shared/brepProjectPackage';
import type {
  BrepEvaluationSuccess,
  BrepParameterValues,
} from '@shared/brepProvider';

const BREP_EVALUATION_DEBOUNCE_MS = 120;
// The accepted native server defaults to one evaluator slot. Serialize native
// preview work across editor remounts so an immutable revision change cannot
// race the Podman request from the previous source snapshot.
let browserBrepEditorEvaluationQueue: Promise<void> = Promise.resolve();

export type BrepEditorRevision = {
  id: string;
  label: string;
};

type BrepProjectEditorContextValue = {
  project: BrepProject;
  packageTitle?: string;
  values: BrepParameterValues;
  setParameterValue: (id: string, value: number) => void;
  result: BrepEvaluationSuccess | null;
  loading: boolean;
  error: string | null;
  dirty: boolean;
  saving: boolean;
  exporting: boolean;
  reEvaluate: () => void;
  saveParameters: () => Promise<void>;
  exportStep: () => Promise<void>;
  exportProjectPackage: () => void;
  revisions: BrepEditorRevision[];
  activeRevisionId?: string;
  revisionActionId: string | null;
  selectRevision: (id: string) => Promise<void>;
  restoreRevision: (id: string) => Promise<void>;
  deleteRevision: (id: string) => Promise<void>;
};

const BrepProjectEditorContext =
  createContext<BrepProjectEditorContextValue | null>(null);

function useBrepProjectEditor() {
  const value = useContext(BrepProjectEditorContext);
  if (!value) {
    throw new Error(
      'BRep project editor panels require BrepProjectEditorProvider.',
    );
  }
  return value;
}

function projectParameterValues(project: BrepProject): BrepParameterValues {
  return Object.fromEntries(
    project.parameters.map((parameter) => [parameter.id, parameter.default]),
  );
}

function parameterValuesEqual(
  left: BrepParameterValues,
  right: BrepParameterValues,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

function geometryFromResult(
  result: BrepEvaluationSuccess,
): BufferGeometry | null {
  const mesh = result.bodies[0]?.viewerMesh;
  if (!mesh) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(mesh.positions), 3),
  );
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function BrepProjectEditorProvider({
  project,
  packageTitle,
  revisions,
  activeRevisionId,
  onParameterValuesCommit,
  onSelectRevision,
  onRestoreRevision,
  onDeleteRevision,
  children,
}: {
  project: BrepProject;
  packageTitle?: string;
  revisions: BrepEditorRevision[];
  activeRevisionId?: string;
  onParameterValuesCommit: (values: BrepParameterValues) => Promise<void>;
  onSelectRevision: (id: string) => Promise<void>;
  onRestoreRevision: (id: string) => Promise<void>;
  onDeleteRevision: (id: string) => Promise<void>;
  children: ReactNode;
}) {
  const initialValues = useMemo(
    () => projectParameterValues(project),
    [project],
  );
  const [values, setValues] = useState<BrepParameterValues>(initialValues);
  const [savedValues, setSavedValues] =
    useState<BrepParameterValues>(initialValues);
  const [result, setResult] = useState<BrepEvaluationSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [evaluationNonce, setEvaluationNonce] = useState(0);
  const [revisionActionId, setRevisionActionId] = useState<string | null>(null);
  const evaluationVersionRef = useRef(0);
  const mountedRef = useRef(true);
  const sourceRevisionRef = useRef(activeRevisionId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      evaluationVersionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    // Query invalidation can reconstruct an equivalent project object while the
    // same source revision stays active. Preserve unsaved local preview values
    // across those harmless refetches; reset only when source authority really
    // moves to another immutable revision.
    if (sourceRevisionRef.current === activeRevisionId) return;
    sourceRevisionRef.current = activeRevisionId;
    const nextValues = projectParameterValues(project);
    evaluationVersionRef.current += 1;
    setValues(nextValues);
    setSavedValues(nextValues);
    setResult(null);
    setError(null);
  }, [activeRevisionId, project]);

  const setParameterValue = useCallback((id: string, value: number) => {
    setValues((current) => ({ ...current, [id]: value }));
  }, []);

  const dirty = useMemo(
    () => !parameterValuesEqual(values, savedValues),
    [savedValues, values],
  );

  useEffect(() => {
    const version = evaluationVersionRef.current + 1;
    evaluationVersionRef.current = version;
    const requestProject = project;
    const requestValues = { ...values };

    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      browserBrepEditorEvaluationQueue = browserBrepEditorEvaluationQueue
        .catch(() => undefined)
        .then(async () => {
          if (!mountedRef.current || version !== evaluationVersionRef.current) {
            return;
          }

          try {
            const token = (await supabase.auth.getSession()).data.session
              ?.access_token;
            const response = await fetch(apiUrl('brep/evaluate'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                project: requestProject,
                parameterValues: requestValues,
              }),
            });
            const payload: unknown = await response.json();
            if (
              !response.ok ||
              !payload ||
              typeof payload !== 'object' ||
              !('status' in payload) ||
              payload.status !== 'success'
            ) {
              const detail =
                payload &&
                typeof payload === 'object' &&
                'error' in payload &&
                typeof payload.error === 'string'
                  ? payload.error
                  : `BRep evaluation failed (${response.status}).`;
              throw new Error(detail);
            }
            if (
              mountedRef.current &&
              version === evaluationVersionRef.current
            ) {
              setResult(payload as BrepEvaluationSuccess);
            }
          } catch (reason) {
            if (
              mountedRef.current &&
              version === evaluationVersionRef.current
            ) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'BRep evaluation failed.',
              );
            }
          } finally {
            if (
              mountedRef.current &&
              version === evaluationVersionRef.current
            ) {
              setLoading(false);
            }
          }
        });
    }, BREP_EVALUATION_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [evaluationNonce, project, values]);

  const reEvaluate = useCallback(() => {
    setEvaluationNonce((current) => current + 1);
  }, []);

  const saveParameters = useCallback(async () => {
    if (!dirty || saving) return;
    const nextValues = { ...values };
    setSaving(true);
    setError(null);
    try {
      await onParameterValuesCommit(nextValues);
      if (mountedRef.current) setSavedValues(nextValues);
    } catch (reason) {
      if (mountedRef.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not persist BRep parameter revision.',
        );
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [dirty, onParameterValuesCommit, saving, values]);

  const exportStep = useCallback(async () => {
    if (exporting || loading || saving) return;
    setExporting(true);
    setError(null);
    try {
      const step = await exportBrepStep(project, values);
      downloadSTEPFile(step);
    } catch (reason) {
      if (mountedRef.current) {
        setError(
          reason instanceof Error ? reason.message : 'BRep STEP export failed.',
        );
      }
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  }, [exporting, loading, project, saving, values]);

  const exportProjectPackage = useCallback(() => {
    const title = packageTitle ?? project.name;
    const text = serializeBrepProjectPackage(
      createBrepProjectPackage({
        title,
        source: { kind: 'brep', source: project },
      }),
    );
    const url = URL.createObjectURL(
      new Blob([text], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'brep-project'}.brepia-brep.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [packageTitle, project]);

  const runRevisionAction = useCallback(
    async (id: string, action: (id: string) => Promise<void>) => {
      if (revisionActionId) return;
      setRevisionActionId(id);
      setError(null);
      try {
        await action(id);
      } catch (reason) {
        if (mountedRef.current) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not update BRep revision history.',
          );
        }
      } finally {
        if (mountedRef.current) setRevisionActionId(null);
      }
    },
    [revisionActionId],
  );

  const value = useMemo<BrepProjectEditorContextValue>(
    () => ({
      project,
      packageTitle,
      values,
      setParameterValue,
      result,
      loading,
      error,
      dirty,
      saving,
      exporting,
      reEvaluate,
      saveParameters,
      exportStep,
      exportProjectPackage,
      revisions,
      activeRevisionId,
      revisionActionId,
      selectRevision: (id) => runRevisionAction(id, onSelectRevision),
      restoreRevision: (id) => runRevisionAction(id, onRestoreRevision),
      deleteRevision: (id) => runRevisionAction(id, onDeleteRevision),
    }),
    [
      activeRevisionId,
      dirty,
      error,
      exportProjectPackage,
      exportStep,
      exporting,
      loading,
      onDeleteRevision,
      onRestoreRevision,
      onSelectRevision,
      packageTitle,
      project,
      reEvaluate,
      result,
      revisionActionId,
      revisions,
      runRevisionAction,
      saveParameters,
      saving,
      setParameterValue,
      values,
    ],
  );

  return (
    <BrepProjectEditorContext.Provider value={value}>
      {children}
    </BrepProjectEditorContext.Provider>
  );
}

export function BrepProjectViewerPanel({
  isMobile = false,
}: {
  isMobile?: boolean;
}) {
  const { result, loading, error } = useBrepProjectEditor();
  const geometry = useMemo(
    () => (result ? geometryFromResult(result) : null),
    [result],
  );

  useEffect(() => {
    return () => geometry?.dispose();
  }, [geometry]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-adam-neutral-700">
      {geometry ? (
        <ThreeScene
          geometry={geometry}
          color="#00A6FF"
          isMobile={isMobile}
          backgroundColor={isMobile ? '#212121' : undefined}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-adam-text-secondary">
          {loading ? 'Preparing native BRep…' : 'No BRep geometry available.'}
        </div>
      )}
      {loading && geometry ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
          Updating preview…
        </div>
      ) : null}
      {error ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-destructive bg-adam-bg-secondary-dark/95 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function RevisionHistory() {
  const {
    revisions,
    activeRevisionId,
    revisionActionId,
    selectRevision,
    restoreRevision,
    deleteRevision,
  } = useBrepProjectEditor();
  const [open, setOpen] = useState(false);
  const orderedRevisions = useMemo(() => [...revisions].reverse(), [revisions]);

  if (revisions.length === 0) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-t border-adam-neutral-700 pt-3"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left text-sm font-medium text-adam-text-primary hover:text-white"
        >
          <span>Revision history · {revisions.length}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 max-h-[220px] space-y-1 overflow-y-auto pr-1">
          {orderedRevisions.map((revision) => {
            const active = revision.id === activeRevisionId;
            const busy = revisionActionId === revision.id;
            return (
              <div
                key={revision.id}
                className="flex items-center gap-1 rounded-lg border border-adam-neutral-700 bg-adam-neutral-900/40 p-1"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-w-0 flex-1 justify-start px-2"
                  disabled={active || !!revisionActionId}
                  onClick={() => void selectRevision(revision.id)}
                >
                  <span className="truncate">
                    {revision.label}
                    {active ? ' · Active' : ''}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!!revisionActionId}
                  onClick={() => void restoreRevision(revision.id)}
                >
                  {busy ? 'Working…' : 'Restore'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-adam-text-tertiary hover:text-destructive"
                      aria-label={`Delete ${revision.label}`}
                      disabled={active || !!revisionActionId}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {revision.label}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the revision from the project revision list.
                        Its immutable lineage record is retained internally so
                        historical AI branches and retries cannot be corrupted.
                        The active revision cannot be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => void deleteRevision(revision.id)}
                      >
                        Delete revision
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BrepProjectParametersPanel() {
  const {
    project,
    values,
    setParameterValue,
    loading,
    error,
    dirty,
    saving,
    exporting,
    reEvaluate,
    saveParameters,
    exportStep,
    exportProjectPackage,
  } = useBrepProjectEditor();

  return (
    <div className="flex h-full min-h-0 flex-col bg-adam-bg-secondary-dark text-adam-text-primary">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Parameters</h2>
          <p className="mt-1 text-xs text-adam-text-tertiary">
            Changes update the native preview immediately. Save when you want to
            create a new source revision.
          </p>
        </div>

        <div className="space-y-3">
          {project.parameters.map((parameter) => (
            <label className="block text-sm" key={parameter.id}>
              <span className="text-adam-text-secondary">
                {parameter.label} ({parameter.unit})
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-adam-neutral-700 bg-adam-neutral-900 px-3 py-2 text-adam-text-primary outline-none focus:border-adam-blue-dark"
                type="number"
                min={parameter.min}
                max={parameter.max}
                step={parameter.step}
                value={values[parameter.id]}
                disabled={saving || exporting}
                onChange={(event) =>
                  setParameterValue(parameter.id, Number(event.target.value))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          <Button
            type="button"
            className="w-full"
            disabled={!dirty || saving}
            onClick={() => void saveParameters()}
          >
            {saving
              ? 'Saving parameter revision…'
              : dirty
                ? 'Save parameter revision'
                : 'Parameters saved'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || saving || exporting}
              onClick={reEvaluate}
            >
              Re-evaluate
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || saving || exporting}
              onClick={() => void exportStep()}
            >
              {exporting ? 'Exporting…' : 'Export STEP'}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={dirty || saving}
            onClick={exportProjectPackage}
          >
            Export BRep project
          </Button>
          {dirty ? (
            <p className="text-xs text-adam-text-tertiary">
              Save the draft before exporting the canonical BRep project package.
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <RevisionHistory />
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
