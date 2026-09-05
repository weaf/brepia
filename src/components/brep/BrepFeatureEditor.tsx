import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, GitBranch, Pencil, Plus } from 'lucide-react';
import { BrepDependencyGraph } from '@/components/brep/BrepDependencyGraph';
import { Button } from '@/components/ui/button';
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
import type {
  BrepNode,
  BrepParameterUnit,
  BrepProject,
  BrepScalar,
  BrepVector3,
} from '@shared/brepProject';
import {
  addBrepProjectNode,
  brepNodeDependencies,
  deleteBrepProjectNode,
  setBrepProjectResultNode,
  suggestBrepNodeId,
} from '@shared/brepProjectEditing';

const LITERAL_VALUE = '__literal__';
const fieldClass =
  'h-9 w-full rounded-lg border border-adam-neutral-700 bg-adam-neutral-900 px-2 text-xs text-adam-text-primary outline-none focus:border-adam-blue-dark disabled:cursor-not-allowed disabled:opacity-60';
const NODE_TYPES: BrepNode['type'][] = [
  'box',
  'cylinder',
  'transform',
  'subtract',
  'fillet',
];

function cloneNode(node: BrepNode): BrepNode {
  return JSON.parse(JSON.stringify(node)) as BrepNode;
}

function nodeTypeLabel(type: BrepNode['type']): string {
  switch (type) {
    case 'box':
      return 'Box';
    case 'cylinder':
      return 'Cylinder';
    case 'transform':
      return 'Transform';
    case 'subtract':
      return 'Subtract';
    case 'fillet':
      return 'Fillet';
  }
}

function preferredInputNodeId(
  project: BrepProject,
  selectedNodeId: string | null,
): string {
  if (
    selectedNodeId &&
    project.nodes.some((node) => node.id === selectedNodeId)
  ) {
    return selectedNodeId;
  }
  if (project.nodes.some((node) => node.id === project.resultNodeId)) {
    return project.resultNodeId;
  }
  const first = project.nodes[0]?.id;
  if (!first) throw new Error('A BRep project must contain an existing feature.');
  return first;
}

function createNodeDraft(
  project: BrepProject,
  type: BrepNode['type'],
  id: string,
  selectedNodeId: string | null,
): BrepNode {
  const input = preferredInputNodeId(project, selectedNodeId);
  switch (type) {
    case 'box':
      return { id, type, width: 100, depth: 100, height: 100 };
    case 'cylinder':
      return { id, type, radius: 25, height: 100 };
    case 'transform':
      return { id, type, input, translate: [0, 0, 0] };
    case 'fillet':
      return {
        id,
        type,
        input,
        radius: 5,
        selector: { kind: 'parallelToAxis', axis: 'z' },
      };
    case 'subtract': {
      const tool = project.nodes.find((node) => node.id !== input)?.id;
      if (!tool) {
        throw new Error(
          'Subtract creation requires at least two existing BRep features.',
        );
      }
      return { id, type, base: input, tools: [tool] };
    }
  }
}

function ScalarField({
  label,
  value,
  unit,
  project,
  disabled,
  onChange,
}: {
  label: string;
  value: BrepScalar;
  unit: BrepParameterUnit;
  project: BrepProject;
  disabled: boolean;
  onChange: (value: BrepScalar) => void;
}) {
  const compatibleParameters = useMemo(
    () => project.parameters.filter((parameter) => parameter.unit === unit),
    [project.parameters, unit],
  );
  const selected =
    typeof value === 'number' ? LITERAL_VALUE : `parameter:${value.parameter}`;

  return (
    <label className="grid gap-1.5 text-xs text-adam-neutral-300">
      <span>{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
        <select
          className={fieldClass}
          value={selected}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value === LITERAL_VALUE) {
              if (typeof value === 'number') return;
              const parameter = project.parameters.find(
                (candidate) => candidate.id === value.parameter,
              );
              onChange(parameter?.default ?? 0);
              return;
            }
            onChange({
              parameter: event.target.value.replace(/^parameter:/, ''),
            });
          }}
        >
          <option value={LITERAL_VALUE}>Literal value</option>
          {compatibleParameters.map((parameter) => (
            <option key={parameter.id} value={`parameter:${parameter.id}`}>
              {parameter.label} · {parameter.id}
            </option>
          ))}
        </select>
        {typeof value === 'number' ? (
          <input
            className={fieldClass}
            type="number"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        ) : (
          <div className="flex h-9 items-center rounded-lg border border-adam-neutral-800 bg-adam-neutral-950/50 px-2 font-mono text-[11px] text-adam-neutral-400">
            {value.parameter}
          </div>
        )}
      </div>
    </label>
  );
}

function VectorField({
  label,
  value,
  unit,
  project,
  disabled,
  onChange,
}: {
  label: string;
  value: BrepVector3;
  unit: BrepParameterUnit;
  project: BrepProject;
  disabled: boolean;
  onChange: (value: BrepVector3) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium text-adam-neutral-300">{label}</div>
      {(['X', 'Y', 'Z'] as const).map((axis, index) => (
        <ScalarField
          key={axis}
          label={axis}
          value={value[index]}
          unit={unit}
          project={project}
          disabled={disabled}
          onChange={(nextScalar) => {
            const next = [...value] as BrepVector3;
            next[index] = nextScalar;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function NodeReferenceField({
  label,
  value,
  project,
  nodeId,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  project: BrepProject;
  nodeId: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-adam-neutral-300">
      <span>{label}</span>
      <select
        className={fieldClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {project.nodes
          .filter((node) => node.id !== nodeId)
          .map((node) => (
            <option key={node.id} value={node.id}>
              {node.id} · {node.type}
            </option>
          ))}
      </select>
    </label>
  );
}

function NodeEditorFields({
  node,
  project,
  disabled,
  onChange,
}: {
  node: BrepNode;
  project: BrepProject;
  disabled: boolean;
  onChange: (node: BrepNode) => void;
}) {
  switch (node.type) {
    case 'box':
      return (
        <div className="grid gap-4">
          <ScalarField
            label="Width"
            value={node.width}
            unit="mm"
            project={project}
            disabled={disabled}
            onChange={(width) => onChange({ ...node, width })}
          />
          <ScalarField
            label="Depth"
            value={node.depth}
            unit="mm"
            project={project}
            disabled={disabled}
            onChange={(depth) => onChange({ ...node, depth })}
          />
          <ScalarField
            label="Height"
            value={node.height}
            unit="mm"
            project={project}
            disabled={disabled}
            onChange={(height) => onChange({ ...node, height })}
          />
        </div>
      );

    case 'cylinder':
      return (
        <div className="grid gap-4">
          <ScalarField
            label="Radius"
            value={node.radius}
            unit="mm"
            project={project}
            disabled={disabled}
            onChange={(radius) => onChange({ ...node, radius })}
          />
          <ScalarField
            label="Height"
            value={node.height}
            unit="mm"
            project={project}
            disabled={disabled}
            onChange={(height) => onChange({ ...node, height })}
          />
        </div>
      );

    case 'transform':
      return (
        <div className="grid gap-5">
          <NodeReferenceField
            label="Input node"
            value={node.input}
            project={project}
            nodeId={node.id}
            disabled={disabled}
            onChange={(input) => onChange({ ...node, input })}
          />

          <label className="flex items-center gap-2 text-xs text-adam-neutral-300">
            <input
              type="checkbox"
              checked={Boolean(node.translate)}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...node,
                  translate: event.target.checked
                    ? (node.translate ?? [0, 0, 0])
                    : undefined,
                })
              }
            />
            Translate
          </label>
          {node.translate ? (
            <VectorField
              label="Translation"
              value={node.translate}
              unit="mm"
              project={project}
              disabled={disabled}
              onChange={(translate) => onChange({ ...node, translate })}
            />
          ) : null}

          <label className="flex items-center gap-2 text-xs text-adam-neutral-300">
            <input
              type="checkbox"
              checked={Boolean(node.rotateDeg)}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...node,
                  rotateDeg: event.target.checked
                    ? (node.rotateDeg ?? [0, 0, 0])
                    : undefined,
                })
              }
            />
            Rotate
          </label>
          {node.rotateDeg ? (
            <VectorField
              label="Rotation"
              value={node.rotateDeg}
              unit="deg"
              project={project}
              disabled={disabled}
              onChange={(rotateDeg) => onChange({ ...node, rotateDeg })}
            />
          ) : null}
        </div>
      );

    case 'subtract':
      return (
        <div className="grid gap-5">
          <NodeReferenceField
            label="Base node"
            value={node.base}
            project={project}
            nodeId={node.id}
            disabled={disabled}
            onChange={(base) => onChange({ ...node, base })}
          />
          <div className="grid gap-2">
            <div className="text-xs text-adam-neutral-300">Tool nodes</div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-adam-neutral-800 bg-adam-neutral-950/40 p-2">
              {project.nodes
                .filter((candidate) => candidate.id !== node.id)
                .map((candidate) => {
                  const checked = node.tools.includes(candidate.id);
                  return (
                    <label
                      key={candidate.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-adam-neutral-300 hover:bg-adam-neutral-900"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => {
                          const tools = event.target.checked
                            ? [...node.tools, candidate.id]
                            : node.tools.filter((id) => id !== candidate.id);
                          onChange({ ...node, tools });
                        }}
                      />
                      <span className="font-mono">{candidate.id}</span>
                      <span className="text-adam-neutral-500">
                        {candidate.type}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>
      );

    case 'fillet':
      return (
        <div className="grid gap-4">
          <NodeReferenceField
            label="Input node"
            value={node.input}
            project={project}
            nodeId={node.id}
            disabled={disabled}
            onChange={(input) => onChange({ ...node, input })}
          />
          <ScalarField
            label="Radius"
            value={node.radius}
            unit="mm"
            project={project}
            disabled={disabled}
            onChange={(radius) => onChange({ ...node, radius })}
          />
          <label className="grid gap-1.5 text-xs text-adam-neutral-300">
            <span>Parallel edge axis</span>
            <select
              className={fieldClass}
              value={node.selector.axis}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...node,
                  selector: {
                    kind: 'parallelToAxis',
                    axis: event.target.value as 'x' | 'y' | 'z',
                  },
                })
              }
            >
              <option value="x">X axis</option>
              <option value="y">Y axis</option>
              <option value="z">Z axis</option>
            </select>
          </label>
        </div>
      );
  }
}

export function BrepFeatureEditor({
  project,
  disabled,
  saving,
  onSaveNode,
  onSaveProject,
}: {
  project: BrepProject;
  disabled: boolean;
  saving: boolean;
  onSaveNode: (node: BrepNode) => Promise<void>;
  onSaveProject: (project: BrepProject) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<BrepNode | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<BrepNode | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [structuralError, setStructuralError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    project.resultNodeId || project.nodes[0]?.id || null,
  );

  useEffect(() => {
    if (
      selectedNodeId &&
      project.nodes.some((node) => node.id === selectedNodeId)
    ) {
      return;
    }
    setSelectedNodeId(project.resultNodeId || project.nodes[0]?.id || null);
  }, [project.nodes, project.resultNodeId, selectedNodeId]);

  const editNode = (node: BrepNode) => {
    setSelectedNodeId(node.id);
    if (disabled || saving) return;
    setDraft(cloneNode(node));
    setLocalError(null);
    setDialogOpen(true);
  };

  const editNodeById = (nodeId: string) => {
    const node = project.nodes.find((candidate) => candidate.id === nodeId);
    if (node) editNode(node);
  };

  const save = async () => {
    if (!draft || saving) return;
    setLocalError(null);
    try {
      await onSaveNode(draft);
      setSelectedNodeId(draft.id);
      setDialogOpen(false);
      setDraft(null);
    } catch (reason) {
      setLocalError(
        reason instanceof Error
          ? reason.message
          : 'Could not save the BRep feature revision.',
      );
    }
  };

  const openCreateDialog = () => {
    if (disabled || saving) return;
    try {
      const type: BrepNode['type'] = 'box';
      const id = suggestBrepNodeId(project, type);
      setCreateDraft(createNodeDraft(project, type, id, selectedNodeId));
      setCreateError(null);
      setCreateDialogOpen(true);
    } catch (reason) {
      setStructuralError(
        reason instanceof Error ? reason.message : 'Could not create a feature draft.',
      );
    }
  };

  const changeCreateType = (type: BrepNode['type']) => {
    if (!createDraft) return;
    try {
      setCreateDraft(
        createNodeDraft(project, type, createDraft.id, selectedNodeId),
      );
      setCreateError(null);
    } catch (reason) {
      setCreateError(
        reason instanceof Error ? reason.message : 'Could not change feature type.',
      );
    }
  };

  const createFeature = async () => {
    if (!createDraft || saving) return;
    setCreateError(null);
    try {
      const nextProject = addBrepProjectNode(project, createDraft);
      await onSaveProject(nextProject);
      setSelectedNodeId(createDraft.id);
      setCreateDialogOpen(false);
      setCreateDraft(null);
    } catch (reason) {
      setCreateError(
        reason instanceof Error
          ? reason.message
          : 'Could not save the new BRep feature.',
      );
    }
  };

  const setResultNode = async (nodeId: string) => {
    if (disabled || saving) return;
    setStructuralError(null);
    try {
      await onSaveProject(setBrepProjectResultNode(project, nodeId));
      setSelectedNodeId(nodeId);
    } catch (reason) {
      setStructuralError(
        reason instanceof Error
          ? reason.message
          : 'Could not change the BRep result node.',
      );
    }
  };

  const deleteNode = async (nodeId: string) => {
    if (disabled || saving) return;
    setStructuralError(null);
    try {
      await onSaveProject(deleteBrepProjectNode(project, nodeId));
    } catch (reason) {
      setStructuralError(
        reason instanceof Error
          ? reason.message
          : 'Could not delete the BRep feature.',
      );
    }
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger
            aria-label={`${open ? 'Collapse' : 'Expand'} BRep features`}
            className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md py-1 text-xs font-semibold text-adam-text-primary transition-colors focus:outline-none"
          >
            <span className="flex items-center gap-2">
              Features
              <span className="text-[10px] text-adam-neutral-400">
                {project.nodes.length}
              </span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-adam-neutral-400 transition-all duration-200 group-hover:text-adam-text-primary ${open ? 'rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || saving}
            onClick={openCreateDialog}
            aria-label="Add BRep feature"
            className="h-7 shrink-0 px-2 text-[10px]"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        <CollapsibleContent>
          <div className="mt-3">
            <BrepDependencyGraph
              project={project}
              selectedNodeId={selectedNodeId}
              editingDisabled={disabled || saving}
              onSelectNode={setSelectedNodeId}
              onEditNode={editNodeById}
              onSetResultNode={setResultNode}
              onDeleteNode={deleteNode}
            />
          </div>

          {structuralError ? (
            <div className="mt-3 rounded-lg border border-destructive p-2.5 text-xs text-destructive">
              {structuralError}
            </div>
          ) : null}

          <div className="mt-3 space-y-1.5 border-t border-adam-neutral-800 pt-3">
            {project.nodes.map((node, index) => {
              const dependencies = brepNodeDependencies(node);
              const isResult = project.resultNodeId === node.id;
              const selected = selectedNodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => editNode(node)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-adam-blue-dark ${
                    selected
                      ? 'border-adam-blue-dark/70 bg-adam-blue-dark/10'
                      : 'border-adam-neutral-800 bg-adam-neutral-900/40 hover:border-adam-neutral-700 hover:bg-adam-neutral-900'
                  } ${disabled || saving ? 'cursor-default' : ''}`}
                >
                  <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-adam-neutral-500" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-xs text-adam-text-primary">
                        {node.id}
                      </span>
                      <span className="shrink-0 rounded-full border border-adam-neutral-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-adam-neutral-400">
                        {node.type}
                      </span>
                      {isResult ? (
                        <span className="shrink-0 rounded-full border border-adam-blue-dark/60 bg-adam-blue-dark/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-adam-blue-light">
                          Result
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-adam-neutral-500">
                      {dependencies.length > 0
                        ? `Depends on ${dependencies.join(', ')}`
                        : `Primitive · node ${index + 1}`}
                    </span>
                  </span>
                  <Pencil
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      disabled || saving
                        ? 'text-adam-neutral-700'
                        : 'text-adam-neutral-500'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          {disabled ? (
            <p className="mt-2 text-[10px] text-adam-neutral-500">
              Dependency navigation remains available. Save or discard competing
              edits before changing project structure.
            </p>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setCreateDialogOpen(nextOpen);
          if (!nextOpen) {
            setCreateDraft(null);
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-4 overflow-hidden bg-adam-bg-secondary-dark p-4 sm:p-6">
          {createDraft ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-adam-text-primary">
                  <Plus className="h-4 w-4" />
                  Add BRep feature
                </DialogTitle>
                <DialogDescription className="text-adam-neutral-400">
                  Choose a stable ID and feature type. Save validates the complete
                  canonical project and creates one immutable source revision. The
                  current result node is preserved until you explicitly change it.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs text-adam-neutral-300">
                    <span>Stable node ID</span>
                    <input
                      className={fieldClass}
                      value={createDraft.id}
                      disabled={saving}
                      onChange={(event) =>
                        setCreateDraft({ ...createDraft, id: event.target.value })
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs text-adam-neutral-300">
                    <span>Feature type</span>
                    <select
                      className={fieldClass}
                      value={createDraft.type}
                      disabled={saving}
                      onChange={(event) =>
                        changeCreateType(event.target.value as BrepNode['type'])
                      }
                    >
                      {NODE_TYPES.map((type) => (
                        <option
                          key={type}
                          value={type}
                          disabled={type === 'subtract' && project.nodes.length < 2}
                        >
                          {nodeTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <NodeEditorFields
                  node={createDraft}
                  project={project}
                  disabled={saving}
                  onChange={setCreateDraft}
                />

                {createError ? (
                  <div className="mt-4 rounded-lg border border-destructive p-3 text-sm text-destructive">
                    {createError}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-adam-neutral-800 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void createFeature()}
                >
                  {saving ? 'Saving feature…' : 'Create feature revision'}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) {
            setDraft(null);
            setLocalError(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-4 overflow-hidden bg-adam-bg-secondary-dark p-4 sm:p-6">
          {draft ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex min-w-0 items-center gap-2 text-adam-text-primary">
                  <GitBranch className="h-4 w-4 shrink-0" />
                  <span className="truncate font-mono text-sm sm:text-base">
                    {draft.id}
                  </span>
                  <span className="shrink-0 rounded-full border border-adam-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-adam-neutral-400">
                    {nodeTypeLabel(draft.type)}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-adam-neutral-400">
                  Edit this existing canonical feature. Node ID and type stay
                  stable. Dependency fields rewire the canonical DAG; Save
                  validates the complete project and creates a new immutable
                  source revision.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <NodeEditorFields
                  node={draft}
                  project={project}
                  disabled={saving}
                  onChange={setDraft}
                />
                {localError ? (
                  <div className="mt-4 rounded-lg border border-destructive p-3 text-sm text-destructive">
                    {localError}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-adam-neutral-800 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Saving feature revision…' : 'Save feature revision'}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
