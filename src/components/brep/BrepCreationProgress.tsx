import { ActivityIndicator } from '@/components/brand';
import type { Message, Model } from '@shared/types';
import { Check, Circle } from 'lucide-react';

type StepState = 'complete' | 'active' | 'pending';

type ProgressStep = {
  label: string;
  state: StepState;
};

function StepIcon({ state }: { state: StepState }) {
  if (state === 'complete') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-adam-blue/15 text-adam-blue">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
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

export function BrepCreationProgress({
  messages,
  messagesFetched,
  leafPresent,
  model,
  executionMode,
  requestSavedOverride,
}: {
  messages: Message[];
  messagesFetched: boolean;
  leafPresent: boolean;
  model: Model;
  executionMode: 'cli' | 'streaming';
  requestSavedOverride?: boolean;
}) {
  const conversationSynced = messagesFetched && leafPresent;
  const requestSaved =
    requestSavedOverride ?? messages.some((message) => message.role === 'user');

  const steps: ProgressStep[] = [
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
    { label: 'Evaluate native geometry and prepare 3D preview', state: 'pending' },
  ];

  const currentLabel = !messagesFetched
    ? 'Loading conversation state…'
    : !leafPresent
      ? 'Synchronizing the active branch…'
      : !requestSaved
        ? 'Saving the BRep creation request…'
        : 'AI is generating the canonical BRep definition…';

  return (
    <main className="flex h-full min-h-0 w-full items-center justify-center overflow-auto bg-adam-background-1 px-4 py-8 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-adam-neutral-700 bg-adam-bg-secondary-dark/95 p-5 shadow-lg sm:p-6">
        <div className="flex items-start gap-3">
          <ActivityIndicator
            label={currentLabel}
            size="lg"
            className="mt-1 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-adam-text-primary sm:text-lg">
              Creating native BRep
            </h1>
            <p className="mt-1 text-sm leading-5 text-adam-text-secondary" aria-live="polite">
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
            Selected model: {selectedModelLabel(model, executionMode)}
          </p>
          <p className="mt-2 text-xs leading-5 text-adam-neutral-400">
            Local models and native BRep evaluation can take a while. You can
            leave this page; Brepia will resynchronize the persisted project
            state when you return.
          </p>
        </div>
      </section>
    </main>
  );
}
