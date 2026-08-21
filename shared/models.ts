import type { Model } from './types';

// Model ids persisted in conversation settings (and submitted by stale
// clients) outlive the picker catalog. Map retired ids to their successors
// so old conversations keep resolving to a routable, correctly priced model.
export const LEGACY_MODEL_IDS: Record<string, Model> = {
  'openai/gpt-5.5': 'openai/gpt-5.6-sol',
  'google/gemini-3.6-flash': 'google/gemini-3.7-flash',
};

export function normalizeModelId(model: Model): Model {
  return LEGACY_MODEL_IDS[model] ?? model;
}

// Canonical OpenCode agent model ID: `agent/opencode/<provider>/<model>`.
// `/api/opencode/models` emits exactly this form. Both the CLI adapter and the
// streaming HTTP adapter must accept the same ID and the transport must be
// chosen by `executionMode`, never by picking a different model ID.
export function isOpenCodeAgentModel(modelId: string): boolean {
  return modelId.startsWith('agent/opencode/');
}

// True for any model that can switch CLI vs Streaming transport: the
// canonical `agent/opencode/...` agent IDs plus legacy `opencode/...` IDs
// that may still be persisted in old conversations.
export function isOpenCodeTransportModel(modelId: string): boolean {
  return isOpenCodeAgentModel(modelId) || modelId.startsWith('opencode/');
}
