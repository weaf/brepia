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
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileCode2,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { BrepFeatureEditor } from '@/components/brep/BrepFeatureEditor';
import { BrepProjectDefinitionEditor } from '@/components/brep/BrepProjectDefinitionEditor';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/useIsMobile';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/services/api';
import { exportBrepStep } from '@/services/brepStepExport';
import { downloadSTEPFile } from '@/utils/downloadUtils';
import type { BrepNode, BrepProject } from '@shared/brepProject';
import { replaceExistingBrepProjectNode } from '@shared/brepProjectEditing';
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

type BrepDownloadFormat = 'step' | 'brep';

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
  sourceSaving: boolean;
  sourceEditingDisabled: boolean;
  exporting: boolean;
  reEvaluate: () => void;
  saveParameters: () => Promise<void>;
  saveFeatureNode: (node: BrepNode) => Promise<void>;
  saveProjectSource: (project: BrepProject) => Promise<void>;
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
  sourceEditingDisabled = false,
  onParameterValuesCommit,
  onProjectSourceCommit,
  onSelectRevision,
  onRestoreRevision,
  onDeleteRevision,
  children,
}: {
  project: BrepProject;
  packageTitle?: string;
  revisions: BrepEditorRevision[];
  activeRevisionId?: string;
  sourceEditingDisabled?: boolean;
  onParameterValuesCommit: (values: BrepParameterValues) => Promise<void>;
  onProjectSourceCommit: (project: BrepProject) => Promise<void>;
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
  const [sourceSaving, setSourceSaving] = useState(false);
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

  const setParameterValue = useCallback(
    (id: string, value: number) => {
      if (sourceSaving) return;
      setValues((current) => ({ ...current, [id]: value }));
    },
    [sourceSaving],
  );

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
    if (!dirty || saving || sourceSaving) return;
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
  }, [dirty, onParameterValuesCommit, saving, sourceSaving, values]);

  const saveFeatureNode = useCallback(
    async (nextNode: BrepNode) => {
      if (sourceEditingDisabled) {
        throw new Error(
          'BRep feature editing is disabled while the current AI turn is streaming.',
        );
      }
      if (dirty) {
        throw new Error(
          'Save or discard the parameter preview before editing a BRep feature.',
        );
      }
      if (saving || sourceSaving || exporting || revisionActionId) {
        throw new Error('Another BRep project update is already in progress.');
      }

      const nextProject = replaceExistingBrepProjectNode(
        project,
        nextNode.id,
        nextNode,
      );
      setSourceSaving(true);
      setError(null);
      try {
        await onProjectSourceCommit(nextProject);
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : 'Could not persist BRep feature revision.';
        if (mountedRef.current) setError(message);
        throw reason instanceof Error ? reason : new Error(message);
      } finally {
        if (mountedRef.current) setSourceSaving(false);
      }
    },
    [
      dirty,
      exporting,
      onProjectSourceCommit,
      project,
      revisionActionId,
      saving,
      sourceEditingDisabled,
      sourceSaving,
    ],
  );

  const saveProjectSource = useCallback(
    async (nextProject: BrepProject) => {
      if (sourceEditingDisabled) {
        throw new Error(
          'BRep structural editing is disabled while the current AI turn is streaming.',
        );
      }
      if (dirty) {
        throw new Error(
          'Save or discard the parameter preview before changing BRep project structure.',
        );
      }
      if (saving || sourceSaving || exporting || revisionActionId) {
        throw new Error('Another BRep project update is already in progress.');
      }

      setSourceSaving(true);
      setError(null);
      try {
        await onProjectSourceCommit(nextProject);
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : 'Could not persist BRep structural revision.';
        if (mountedRef.current) setError(message);
        throw reason instanceof Error ? reason : new Error(message);
      } finally {
        if (mountedRef.current) setSourceSaving(false);
      }
    },
    [
      dirty,
      exporting,
      onProjectSourceCommit,
      revisionActionId,
      saving,
      sourceEditingDisabled,
      sourceSaving,
    ],
  );

  const exportStep = useCallback(async () => {
    if (exporting || loading || saving || sourceSaving) return;
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
  }, [exporting, loading, project, saving, sourceSaving, values]);

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
      if (revisionActionId || sourceSaving) return;
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
    [revisionActionId, sourceSaving],
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
      sourceSaving,
      sourceEditingDisabled,
      exporting,
      reEvaluate,
      saveParameters,
      saveFeatureNode,
      saveProjectSource,
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
      saveFeatureNode,
      saveParameters,
      saveProjectSource,
      saving,
      setParameterValue,
      sourceEditingDisabled,
      sourceSaving,
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

function BrepProjectFilesPanel() {
  const { project, dirty } = useBrepProjectEditor();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!isMobile);
  const [dialogOpen, setDialogOpen] = useState(false);
  const sourceJson = useMemo(() => JSON.stringify(project, null, 2), [project]);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  return (
    <>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="border-b border-adam-neutral-700/60 pb-4"
      >
        <CollapsibleTrigger
          aria-label={`${open ? 'Collapse' : 'Expand'} BRep project files`}
          className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-xs font-semibold text-adam-text-primary transition-colors focus:outline-none"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span>Project files</span>
            <span className="text-[10px] text-adam-neutral-400">1</span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-adam-neutral-400 transition-all duration-200 group-hover:text-adam-text-primary ${open ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-2 text-[10px] text-adam-neutral-400">
            1 canonical source file
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-adam-neutral-300 transition-colors hover:bg-adam-neutral-800 hover:text-adam-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-adam-neutral-500"
          >
            <FileCode2 className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono">
              project.brep.json
            </span>
            <span className="shrink-0 rounded-full border border-adam-neutral-600 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-adam-neutral-300">
              Canonical
            </span>
          </button>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-4 bg-adam-bg-secondary-dark p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex min-w-0 items-center gap-2 text-adam-text-primary">
              <FileCode2 className="h-4 w-4 shrink-0" />
              <span className="truncate font-mono text-sm sm:text-base">
                project.brep.json
              </span>
            </DialogTitle>
            <DialogDescription className="text-adam-neutral-400">
              Canonical BRep source for the active immutable revision.
              {dirty
                ? ' Unsaved parameter preview values are intentionally not written into this JSON until you save a parameter revision.'
                : ' The JSON is read-only here so source changes continue through validated BRep revisions.'}
            </DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="Canonical BRep project JSON"
            value={sourceJson}
            readOnly
            spellCheck={false}
            className="min-h-[55dvh] w-full resize-none overflow-auto whitespace-pre rounded-md border border-adam-neutral-700 bg-adam-background-1 p-3 font-mono text-xs leading-5 text-adam-text-primary outline-none"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RevisionHistory() {
  const {
    revisions,
    activeRevisionId,
    revisionActionId,
    sourceSaving,
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
      className="border-t border-adam-neutral-700/60 pt-3"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-xs font-semibold text-adam-text-primary transition-colors focus:outline-none"
        >
          <span className="flex items-center gap-2">
            Revision history
            <span className="text-[10px] text-adam-neutral-400">
              {revisions.length}
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-adam-neutral-400 transition-all duration-200 group-hover:text-adam-text-primary ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 max-h-[220px] space-y-1 overflow-y-auto pr-1">
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
                  className="min-w-0 flex-1 justify-start px-2 text-xs"
                  disabled={active || !!revisionActionId || sourceSaving}
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
                  className="text-xs"
                  disabled={!!revisionActionId || sourceSaving}
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
                      disabled={active || !!revisionActionId || sourceSaving}
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

function BrepExportBar() {
  const {
    dirty,
    saving,
    sourceSaving,
    loading,
    exporting,
    exportStep,
    exportProjectPackage,
  } = useBrepProjectEditor();
  const [selectedFormat, setSelectedFormat] =
    useState<BrepDownloadFormat>('step');

  const stepAvailable = !saving && !sourceSaving && !loading && !exporting;
  const brepAvailable = !dirty && !saving && !sourceSaving;
  const selectedAvailable =
    selectedFormat === 'step' ? stepAvailable : brepAvailable;

  const handleDownload = () => {
    if (selectedFormat === 'step') {
      void exportStep();
      return;
    }
    exportProjectPackage();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-adam-neutral-700 px-4 py-4 lg:gap-4 lg:px-6 lg:py-6">
      <div className="flex">
        <Button
          type="button"
          onClick={handleDownload}
          disabled={!selectedAvailable}
          aria-label={`download ${selectedFormat.toUpperCase()} file`}
          className="h-11 flex-1 rounded-r-none bg-adam-neutral-50 text-adam-neutral-800 hover:bg-adam-neutral-100 hover:text-adam-neutral-900 lg:h-12"
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting && selectedFormat === 'step'
            ? 'EXPORTING…'
            : selectedFormat.toUpperCase()}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label="select BRep download format"
              className="h-11 w-11 rounded-l-none border-l border-adam-neutral-300 bg-adam-neutral-50 p-0 text-adam-neutral-800 hover:bg-adam-neutral-100 hover:text-adam-neutral-900 lg:h-12 lg:w-12"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border-none bg-adam-neutral-800 shadow-md"
          >
            <DropdownMenuItem
              onClick={() => setSelectedFormat('step')}
              disabled={!stepAvailable}
              className="cursor-pointer text-adam-text-primary"
            >
              <span className="text-sm">.STEP</span>
              <span className="ml-3 text-xs text-adam-text-primary/60">
                Native CAD exchange
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSelectedFormat('brep')}
              disabled={!brepAvailable}
              className="cursor-pointer text-adam-text-primary"
            >
              <span className="text-sm">.BREP JSON</span>
              <span className="ml-3 text-xs text-adam-text-primary/60">
                Canonical Brepia project
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {dirty ? (
        <p className="text-[10px] text-adam-neutral-400">
          Save the parameter draft before exporting the canonical BRep project
          package. STEP can still export the current preview values.
        </p>
      ) : null}
    </div>
  );
}

export function BrepProjectParametersPanel() {
  const {
    project,
    values,
    setParameterValue,
    error,
    dirty,
    saving,
    sourceSaving,
    sourceEditingDisabled,
    exporting,
    activeRevisionId,
    revisionActionId,
    reEvaluate,
    saveParameters,
    saveFeatureNode,
    saveProjectSource,
  } = useBrepProjectEditor();
  const [parametersOpen, setParametersOpen] = useState(true);
  const featureEditingDisabled =
    sourceEditingDisabled ||
    dirty ||
    saving ||
    sourceSaving ||
    exporting ||
    Boolean(revisionActionId);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-gray-200/20 bg-adam-bg-secondary-dark text-adam-text-primary dark:border-gray-800">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-adam-neutral-700 bg-gradient-to-r from-adam-bg-secondary-dark to-adam-bg-secondary-dark/95 px-4 py-3 lg:h-14 lg:px-6 lg:py-6">
        <span className="text-base font-semibold tracking-tight text-adam-text-primary lg:text-lg">
          Parameters
        </span>
        <Button
          type="button"
          variant="ghost"
          title="Re-evaluate native BRep preview"
          aria-label="Re-evaluate native BRep preview"
          className="h-8 w-8 rounded-full p-0 text-adam-text-primary transition-colors [@media(hover:hover)]:hover:bg-adam-neutral-950 [@media(hover:hover)]:hover:text-adam-neutral-10"
          onClick={reEvaluate}
          disabled={saving || sourceSaving || exporting}
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden">
        <ScrollArea className="flex-1 px-4 py-4 lg:px-6 lg:py-6">
          <div className="mb-4 lg:mb-6">
            <BrepProjectFilesPanel />
          </div>

          <div className="mb-4 border-b border-adam-neutral-700/60 pb-4 lg:mb-6">
            <BrepProjectDefinitionEditor
              key={`definition:${activeRevisionId ?? project.id}`}
              project={project}
              disabled={featureEditingDisabled}
              saving={sourceSaving}
              onSaveProject={saveProjectSource}
            />
          </div>

          <Collapsible open={parametersOpen} onOpenChange={setParametersOpen}>
            <CollapsibleTrigger
              aria-label={`${parametersOpen ? 'Collapse' : 'Expand'} BRep parameters`}
              className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-xs font-semibold text-adam-text-primary transition-colors focus:outline-none"
            >
              <span className="flex items-center gap-2">
                Dimensions
                <span className="text-[10px] text-adam-neutral-400">
                  {project.parameters.length}
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-adam-neutral-400 transition-all duration-200 group-hover:text-adam-text-primary ${parametersOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 flex flex-col gap-3">
                {project.parameters.map((parameter) => (
                  <label
                    className="grid grid-cols-[minmax(0,1fr)_92px_28px] items-center gap-2 text-xs"
                    key={parameter.id}
                  >
                    <span className="min-w-0 truncate text-adam-neutral-300">
                      {parameter.label}
                    </span>
                    <input
                      className="h-9 w-full rounded-lg border border-adam-neutral-700 bg-adam-neutral-900 px-2 text-adam-text-primary outline-none focus:border-adam-blue-dark"
                      type="number"
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      value={values[parameter.id]}
                      disabled={saving || sourceSaving || exporting}
                      onChange={(event) =>
                        setParameterValue(
                          parameter.id,
                          Number(event.target.value),
                        )
                      }
                    />
                    <span className="truncate text-[10px] text-adam-neutral-400">
                      {parameter.unit}
                    </span>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="mt-4 lg:mt-6">
            <Button
              type="button"
              className="w-full"
              disabled={!dirty || saving || sourceSaving}
              onClick={() => void saveParameters()}
            >
              {saving
                ? 'Saving parameter revision…'
                : dirty
                  ? 'Save parameter revision'
                  : 'Parameters saved'}
            </Button>
            <p className="mt-2 text-[10px] text-adam-neutral-400">
              Parameter changes update the native preview immediately. Save only
              when you want a new immutable source revision.
            </p>
          </div>

          <div className="mt-4 border-t border-adam-neutral-700/60 pt-4 lg:mt-6">
            <BrepFeatureEditor
              key={activeRevisionId ?? project.id}
              project={project}
              disabled={featureEditingDisabled}
              saving={sourceSaving}
              onSaveNode={saveFeatureNode}
              onSaveProject={saveProjectSource}
            />
            {sourceEditingDisabled ? (
              <p className="mt-2 text-[10px] text-adam-neutral-500">
                Feature editing is disabled while the current AI turn is
                streaming.
              </p>
            ) : null}
          </div>

          <div className="mt-4 lg:mt-6">
            <RevisionHistory />
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-destructive p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </ScrollArea>

        <BrepExportBar />
      </div>
    </div>
  );
}
