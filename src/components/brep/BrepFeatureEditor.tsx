import { useMemo, useState } from 'react';
import { ChevronDown, GitBranch, Pencil } from 'lucide-react';
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
import { brepNodeDependencies } from '@shared/brepProjectEditing';

const LITERAL_VALUE = '__literal__';
const fieldClass =
  'h-9 w-full rounded-lg border border-adam-neutral-700 bg-adam-neutral-900 px-2 text-xs text-adam-text-primary outline-none focus:border-adam-blue-dark disabled:cursor-not-allowed disabled:opacity-60';

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
            <option
              key={parameter.id}
              value={`parameter:${parameter.id}`}
            >
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
}: {
  project: BrepProject;
  disabled: boolean;
  saving: boolean;
  onSaveNode: (node: BrepNode) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<BrepNode | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const editNode = (node: BrepNode) => {
    if (disabled || saving) return;
    setDraft(cloneNode(node));
    setLocalError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!draft || saving) return;
    setLocalError(null);
    try {
      await onSaveNode(draft);
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

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          aria-label={`${open ? 'Collapse' : 'Expand'} BRep features`}
          className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-xs font-semibold text-adam-text-primary transition-colors focus:outline-none"
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
        <CollapsibleContent>
          <div className="mt-3 space-y-1.5">
            {project.nodes.map((node, index) => {
              const dependencies = brepNodeDependencies(node);
              const isResult = project.resultNodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={disabled || saving}
                  onClick={() => editNode(node)}
                  className="flex w-full items-start gap-2 rounded-lg border border-adam-neutral-800 bg-adam-neutral-900/40 px-3 py-2 text-left transition-colors hover:border-adam-neutral-700 hover:bg-adam-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-adam-neutral-500" />
                </button>
              );
            })}
          </div>
          {disabled ? (
            <p className="mt-2 text-[10px] text-adam-neutral-500">
              Save or discard competing edits before changing a feature.
            </p>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

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
                  stable in Phase 4A; Save validates the complete BRep project
                  and creates a new immutable source revision.
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
