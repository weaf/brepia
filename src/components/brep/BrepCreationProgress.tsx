import { ActivityIndicator } from '@/components/brand';
import type { GenerationRunPhase, GenerationRunSnapshot } from '@shared/generationRun';
import type { Message, Model } from '@shared/types';
import { Check, Circle, X } from 'lucide-react';

type StepState = 'complete' | 'active' | 'pending' | 'failed';

type ProgressStep = {
  label: string;
  state: StepState;
};

const PHASE_ORDER: Record<GenerationRunPhase, number> = {
  request_saved: 0,
  model_dispatched: 1,
  generating: 2,
  response_received: 3,
  validating_artifact: 4,
  saving_revision: 5,
  revision_saved: 6,
  evaluation_requested: 7,
  evaluating_native: 8,
  preparing_viewer: 9,
  preview_ready: 10,
};

function StepIcon({ state }: { state: StepState }) {
  if (state === 'complete') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-adam-blue/15 text-adam-blue">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  if (state === 'failed') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  if (state === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <ActivityIndicator label="Current step" size="sm" />
      </span>
    );
  }

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-adam-neutral-500">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function selectedModelLabel(model: Model, executionMode: 'cli' | 'streaming') {
  if (model.startsWith('agent/opencode/')) {
    return `OpenCode ${executionMode} · ${model.slice('agent/opencode/'.length)}`;
  }
  if (model.startsWith('agent/codex/')) {
    return `Codex CLI · ${model.slice('agent/codex/'.length)}`;
  }
  if (model.startsWith('local/')) {
    return `Local · ${model.slice('local/'.length)}`;
  }
  return model;
}

export function generationRunModelLabel(
  run: GenerationRunSnapshot,
  fallbackModel: Model,
  fallbackExecutionMode: 'cli' | 'streaming',
): string {
  const model = run.actualModelId ?? run.requestedModelId ?? fallbackModel;
  if (run.transportKind === 'opencode') {
    const mode = run.executionMode ?? fallbackExecutionMode;
    return `OpenCode ${mode} · ${model}`;
  }
  if (run.transportKind === 'codex') return `Codex CLI · ${model}`;
  if (run.transportKind === 'cli-agent') return `CLI agent · ${model}`;
  if (run.actualModelId) return model;
  return selectedModelLabel(fallbackModel, fallbackExecutionMode);
}

function phaseAtLeast(
  phase: GenerationRunPhase,
  expected: GenerationRunPhase,
): boolean {
  return PHASE_ORDER[phase] >= PHASE_ORDER[expected];
}

function failedStepIndex(phase: GenerationRunPhase): number {
  if (phaseAtLeast(phase, 'revision_saved')) return 6;
  if (phaseAtLeast(phase, 'saving_revision')) return 5;
  if (phaseAtLeast(phase, 'response_received')) return 4;
  return 3;
}

export function durableBrepProgressSteps({
  run,
  conversationSynced,
}: {
  run: GenerationRunSnapshot;
  conversationSynced: boolean;
}): ProgressStep[] {
  const terminalFailure = run.status === 'failed' || run.status === 'cancelled';
  const failedIndex = terminalFailure ? failedStepIndex(run.phase) : -1;
  const state = (index: number, complete: boolean, active: boolean): StepState => {
    if (index === failedIndex) return 'failed';
    if (complete) return 'complete';
    return active ? 'active' : 'pending';
  };

  return [
    { label: 'Open BRep project', state: 'complete' },
    {
      label: 'Synchronize conversation state',
      state: conversationSynced ? 'complete' : 'active',
    },
    { label: 'Persist creation request', state: 'complete' },
    {
      label: 'Generate canonical BRep definition',
      state: state(
        3,
        phaseAtLeast(run.phase, 'response_received'),
        phaseAtLeast(run.phase, 'request_saved'),
      ),
    },
    {
      label: 'Validate canonical BRep source',
      state: state(
        4,
        phaseAtLeast(run.phase, 'saving_revision'),
        phaseAtLeast(run.phase, 'response_received'),
      ),
    },
    {
      label: 'Save immutable project revision',
      state: state(
        5,
        phaseAtLeast(run.phase, 'revision_saved'),
        phaseAtLeast(run.phase, 'saving_revision'),
      ),
    },
    {
      label: 'Evaluate native geometry and prepare 3D preview',
      state: state(
        6,
        phaseAtLeast(run.phase, 'preview_ready') || run.status === 'completed',
        phaseAtLeast(run.phase, 'revision_saved'),
      ),
    },
  ];
}

function durableCurrentLabel(run: GenerationRunSnapshot): string {
  if (run.status === 'failed') {
    return run.errorMessage ?? run.detail ?? 'BRep generation failed.';
  }
  if (run.status === 'cancelled') {
    return run.detail ?? 'BRep generation was stopped.';
  }
  if (run.status === 'completed') {
    return 'Native BRep is ready. Synchronizing project state…';
  }

  switch (run.phase) {
    case 'request_saved':
      return 'Creation request saved. Preparing the selected AI model…';
    case 'model_dispatched':
      return 'The selected AI transport is starting…';
    case 'generating':
      return 'AI is generating the canonical BRep definition…';
    case 'response_received':
    case 'validating_artifact':
      return 'Validating the generated canonical BRep source…';
    case 'saving_revision':
      return 'Saving the immutable BRep project revision…';
    case 'revision_saved':
      return 'Project revision saved. Preparing native preview…';
    case 'evaluation_requested':
    case 'evaluating_native':
      return 'Evaluating native BRep geometry…';
    case 'preparing_viewer':
      return 'Preparing the native 3D viewer payload…';
    case 'preview_ready':
      return 'Native BRep preview is ready.';
  }
}

export function BrepCreationProgress({
  messages,
  messagesFetched,
  leafPresent,
  model,
  executionMode,
  requestSavedOverride,
  generationRun,
}: {
  messages: Message[];
  messagesFetched: boolean;
  leafPresent: boolean;
  model: Model;
  executionMode: 'cli' | 'streaming';
  requestSavedOverride?: boolean;
  generationRun?: GenerationRunSnapshot;
}) {
  const conversationSynced = messagesFetched && leafPresent;
  const requestSaved =
    requestSavedOverride ?? messages.some((message) => message.role === 'user');
  const terminalFailure =
    generationRun?.status === 'failed' || generationRun?.status === 'cancelled';

  const steps: ProgressStep[] = generationRun
    ? durableBrepProgressSteps({ run: generationRun, conversationSynced })
    : [
        { label: 'Open BRep project', state: 'complete' },
        {
          label: 'Synchronize conversation state',
          state: conversationSynced ? 'complete' : 'active',
        },
        {
          label: 'Persist creation request',
          state: requestSaved
            ? 'complete'
            : conversationSynced
              ? 'active'
              : 'pending',
        },
        {
          label: 'Generate canonical BRep definition',
          state: requestSaved && conversationSynced ? 'active' : 'pending',
        },
        { label: 'Validate canonical BRep source', state: 'pending' },
        { label: 'Save immutable project revision', state: 'pending' },
        {
          label: 'Evaluate native geometry and prepare 3D preview',
          state: 'pending',
        },
      ];

  const currentLabel = generationRun
    ? durableCurrentLabel(generationRun)
    : !messagesFetched
      ? 'Loading conversation state…'
      : !leafPresent
        ? 'Synchronizing the active branch…'
        : !requestSaved
          ? 'Saving the BRep creation request…'
          : 'AI is generating the canonical BRep definition…';
  const modelLabel = generationRun
    ? generationRunModelLabel(generationRun, model, executionMode)
    : selectedModelLabel(model, executionMode);

  return (
    <main className="flex h-full min-h-0 w-full items-center justify-center overflow-auto bg-adam-background-1 px-4 py-8 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-adam-neutral-700 bg-adam-bg-secondary-dark/95 p-5 shadow-lg sm:p-6">
        <div className="flex items-start gap-3">
          {terminalFailure ? (
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <X className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : (
            <ActivityIndicator
              label={currentLabel}
              size="lg"
              className="mt-1 shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-adam-text-primary sm:text-lg">
              {generationRun?.status === 'failed'
                ? 'Native BRep creation failed'
                : generationRun?.status === 'cancelled'
                  ? 'Native BRep creation stopped'
                  : 'Creating native BRep'}
            </h1>
            <p
              className={`mt-1 text-sm leading-5 ${terminalFailure ? 'text-destructive' : 'text-adam-text-secondary'}`}
              aria-live="polite"
            >
              {currentLabel}
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3" aria-label="Native BRep creation progress">
          {steps.map((step) => (
            <li
              key={step.label}
              className={`flex items-center gap-3 text-sm ${
                step.state === 'pending'
                  ? 'text-adam-neutral-500'
                  : step.state === 'failed'
                    ? 'text-destructive'
                    : 'text-adam-text-primary'
              }`}
              aria-current={step.state === 'active' ? 'step' : undefined}
            >
              <StepIcon state={step.state} />
              <span>{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 border-t border-adam-neutral-700 pt-4">
          <p className="break-words text-xs text-adam-neutral-400">
            {generationRun ? 'Generation model' : 'Selected model'}: {modelLabel}
          </p>
          {generationRun?.errorCode ? (
            <p className="mt-1 break-words font-mono text-[10px] text-adam-neutral-500">
              Status code: {generationRun.errorCode}
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-adam-neutral-400">
            Generation progress is persisted by the server. You can leave this
            page; Brepia will resume showing the durable state when you return.
          </p>
        </div>
      </section>
    </main>
  );
}
