// P05A: Provider settings UI — ProvidersSettings section.
//
// Renders the provider settings panel in SettingsView.
// Displays two groups:
// - Built-in providers (read-only, managed by the application)
// - Custom providers (CRUD operations via /api/ai-settings/providers/)
// Supports:
// - Create, edit, delete custom providers
// - Enable/disable toggle
// - Test connection
// - Model count display
// - Credential saved status

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Code2,
  Edit2,
  Key,
  Loader2,
  MessageSquare,
  Network,
  Plug,
  Plus,
  Server,
  Settings2,
  Terminal,
  TestTubes,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiJson } from '@/services/api';
import { cn } from '@/lib/utils';
import { TestProviderResultDto } from '@shared/aiSettings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderSummary {
  id: string;
  userId: string;
  slug: string;
  name: string;
  driver: 'openai-compatible' | 'anthropic' | 'google' | 'openrouter';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProviderDetail extends ProviderSummary {
  baseUrl: string | null;
  hasCredential: boolean;
}

interface CreateProviderInput {
  slug: string;
  name: string;
  driver: 'openai-compatible' | 'anthropic' | 'google' | 'openrouter';
  baseUrl?: string;
  credential?: string;
}

interface UpdateProviderInput {
  name?: string;
  driver?: 'openai-compatible' | 'anthropic' | 'google' | 'openrouter';
  baseUrl?: string;
  credential?: string | null;
  enabled?: boolean;
}

interface TestProviderRequest {
  id?: string;
  draftConfig?: Partial<CreateProviderInput>;
}

// ---------------------------------------------------------------------------
// Types — provider models
// ---------------------------------------------------------------------------

interface ProviderModelSummary {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  description: string | null;
  supportsTools: boolean;
  supportsThinking: boolean;
  supportsVision: boolean;
  contextLimit: number | null;
  outputLimit: number | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

type ProviderModelDetail = ProviderModelSummary;

// ---------------------------------------------------------------------------
// Types — runtime integrations
// ---------------------------------------------------------------------------

interface RuntimeIntegrationStatus {
  integrationId: 'opencode' | 'codex' | 'local-openai';
  label: string;
  status: 'connected' | 'available' | 'unavailable' | 'not-configured';
  baseUrl: string | null;
  modelCount: number;
  explanation: string;
}

interface CreateProviderModelInput {
  modelId: string;
  displayName: string;
  description?: string;
  supportsTools?: boolean;
  supportsThinking?: boolean;
  supportsVision?: boolean;
  contextLimit?: number;
  outputLimit?: number;
  isVisible?: boolean;
}

interface UpdateProviderModelInput {
  displayName?: string;
  description?: string | null;
  supportsTools?: boolean;
  supportsThinking?: boolean;
  supportsVision?: boolean;
  contextLimit?: number | null;
  outputLimit?: number | null;
  isVisible?: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchProviders(): Promise<ProviderSummary[]> {
  return apiJson('ai-settings/providers') as Promise<ProviderSummary[]>;
}

async function fetchRuntimeIntegrations(): Promise<RuntimeIntegrationStatus[]> {
  return apiJson('settings/runtime-integrations') as Promise<
    RuntimeIntegrationStatus[]
  >;
}

async function fetchProviderDetail(id: string): Promise<ProviderDetail> {
  return apiJson(`ai-settings/providers/${id}`) as Promise<ProviderDetail>;
}

async function createProvider(
  input: CreateProviderInput,
): Promise<ProviderDetail> {
  return apiJson('ai-settings/providers', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<ProviderDetail>;
}

async function updateProvider(
  providerId: string,
  input: UpdateProviderInput,
): Promise<ProviderDetail> {
  return apiJson(`ai-settings/providers/${providerId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }) as Promise<ProviderDetail>;
}

async function deleteProvider(providerId: string): Promise<void> {
  await apiJson(`ai-settings/providers/${providerId}`, {
    method: 'DELETE',
  });
}

async function testProviderConnection(
  req: TestProviderRequest,
): Promise<TestProviderResultDto> {
  return apiJson('ai-settings/providers/test', {
    method: 'POST',
    body: JSON.stringify(req),
  }) as Promise<TestProviderResultDto>;
}

async function fetchProviderModels(
  providerId: string,
): Promise<ProviderModelSummary[]> {
  return apiJson(`ai-settings/providers/${providerId}/models`) as Promise<
    ProviderModelSummary[]
  >;
}

async function _fetchProviderModelDetail(
  providerId: string,
  modelId: string,
): Promise<ProviderModelDetail> {
  return apiJson(
    `ai-settings/providers/${providerId}/models/${modelId}`,
  ) as Promise<ProviderModelDetail>;
}

async function createProviderModel(
  providerId: string,
  input: CreateProviderModelInput,
): Promise<ProviderModelDetail> {
  return apiJson(`ai-settings/providers/${providerId}/models`, {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<ProviderModelDetail>;
}

async function updateProviderModel(
  providerId: string,
  modelId: string,
  input: UpdateProviderModelInput,
): Promise<ProviderModelDetail> {
  return apiJson(`ai-settings/providers/${providerId}/models/${modelId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }) as Promise<ProviderModelDetail>;
}

async function deleteProviderModel(
  providerId: string,
  modelId: string,
): Promise<void> {
  await apiJson(`ai-settings/providers/${providerId}/models/${modelId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// React Query hooks
// ---------------------------------------------------------------------------

function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: fetchProviders,
    staleTime: 0,
  });
}

function useRuntimeIntegrations() {
  return useQuery({
    queryKey: ['runtime-integrations'],
    queryFn: fetchRuntimeIntegrations,
    staleTime: 0,
  });
}

function useProviderDetail(id: string | null) {
  return useQuery({
    queryKey: ['provider', id ?? ''],
    queryFn: () => (id ? fetchProviderDetail(id) : null),
    enabled: !!id,
    staleTime: 0,
  });
}

function _useProviderModelDetail(
  _providerId: string | null,
  _modelModelId: string | null,
) {
  return { data: null };
}

function useCreateProvider() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast({ title: 'Success', description: 'Provider created.' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to create provider.',
        variant: 'destructive',
      });
    },
  });
}

function useUpdateProvider() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      providerId,
      input,
    }: {
      providerId: string;
      input: UpdateProviderInput;
    }) => updateProvider(providerId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast({ title: 'Success', description: 'Provider updated.' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to update provider.',
        variant: 'destructive',
      });
    },
  });
}

function useDeleteProvider() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast({ title: 'Success', description: 'Provider deleted.' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to delete provider.',
        variant: 'destructive',
      });
    },
  });
}

function useTestProvider() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: testProviderConnection,
    onSuccess: (result) => {
      if (result.ok) {
        toast({
          title: 'Connection successful',
          description: `${result.message} (${result.latencyMs}ms)`,
        });
      } else {
        toast({
          title: 'Connection failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    },
    onError: (e: Error) => {
      toast({
        title: 'Test failed',
        description: e.message,
        variant: 'destructive',
      });
    },
  });
}

function useProviderModels(providerId: string | null) {
  return useQuery({
    queryKey: ['providerModels', providerId ?? ''],
    queryFn: () =>
      providerId ? fetchProviderModels(providerId) : Promise.resolve([]),
    enabled: !!providerId,
    staleTime: 0,
  });
}

function useCreateProviderModel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      providerId,
      input,
    }: {
      providerId: string;
      input: CreateProviderModelInput;
    }) => createProviderModel(providerId, input),
    onSuccess: (_, { providerId }) => {
      queryClient.invalidateQueries({
        queryKey: ['providerModels', providerId],
      });
      toast({ title: 'Success', description: 'Provider model created.' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to create provider model.',
        variant: 'destructive',
      });
    },
  });
}

function useUpdateProviderModel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      providerId,
      modelId,
      input,
    }: {
      providerId: string;
      modelId: string;
      input: UpdateProviderModelInput;
    }) => updateProviderModel(providerId, modelId, input),
    onSuccess: (_, { providerId }) => {
      queryClient.invalidateQueries({
        queryKey: ['providerModels', providerId],
      });
      toast({ title: 'Success', description: 'Provider model updated.' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to update provider model.',
        variant: 'destructive',
      });
    },
  });
}

function useDeleteProviderModel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      providerId,
      modelId,
    }: {
      providerId: string;
      modelId: string;
    }) => deleteProviderModel(providerId, modelId),
    onSuccess: (_, { providerId }) => {
      queryClient.invalidateQueries({
        queryKey: ['providerModels', providerId],
      });
      toast({ title: 'Success', description: 'Provider model deleted.' });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to delete provider model.',
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRIVER_LABELS: Record<string, string> = {
  'openai-compatible': 'OpenAI Compatible',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
};

const DRIVER_ICONS: Record<string, typeof Code2> = {
  'openai-compatible': Code2,
  anthropic: Plug,
  google: Plug,
  openrouter: Plug,
};

const BUILTIN_DRIVERS: Array<
  'openai-compatible' | 'anthropic' | 'google' | 'openrouter'
> = ['anthropic', 'google', 'openrouter', 'openai-compatible'];

const PRESET_ENDPOINTS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  'openai-compatible': '',
};

// ---------------------------------------------------------------------------
// Badge rendering
// ---------------------------------------------------------------------------

function DriverBadge({ driver }: { driver: ProviderSummary['driver'] }) {
  const config = {
    'openai-compatible': {
      label: DRIVER_LABELS['openai-compatible'],
      className: 'bg-adam-blue/15 text-adam-blue border-adam-blue/20',
    },
    anthropic: {
      label: DRIVER_LABELS.anthropic,
      className: 'bg-adam-emerald/15 text-adam-emerald border-adam-emerald/20',
    },
    google: {
      label: DRIVER_LABELS.google,
      className:
        'bg-adad-green-500/15 text-adam-green-500 border-adad-green-500/20',
    },
    openrouter: {
      label: DRIVER_LABELS.openrouter,
      className: 'bg-adam-amber/15 text-adam-amber border-adam-amber/20',
    },
  };
  const { label, className } = config[driver];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function CredentialBadge({ hasCredential }: { hasCredential: boolean }) {
  if (!hasCredential) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-adam-neutral-700 bg-adam-background-2 px-2 py-0.5 text-[10px] text-adam-neutral-400">
        <Key className="h-2.5 w-2.5" />
        No credential
      </span>
    );
  }
  return (
    <span className="border-adad-green-500/30 bg-adam-green-950/20 text-adad-green-500 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
      <CheckCircle2 className="h-2.5 w-2.5" />
      Credential saved
    </span>
  );
}

function TestStatusBadge({
  result,
}: {
  result?: TestProviderResultDto | null;
}) {
  if (!result) return null;
  if (result.ok) {
    return (
      <span
        className="border-adam-emerald-800/50 bg-adam-emerald-950/20 text-adam-emerald-400 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
        title={result.message}
      >
        <CheckCircle2 className="h-2.5 w-2.5" />
        {result.latencyMs}ms
      </span>
    );
  }
  return (
    <span
      className="border-adam-red-800/50 bg-adam-red-950/20 text-adam-red-400 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
      title={result.message}
    >
      <XCircle className="h-2.5 w-2.5" />
      {result.message || 'Failed'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Built-in provider card
// ---------------------------------------------------------------------------

function BuiltinProviderCard({
  driver,
}: {
  driver: ProviderSummary['driver'];
}) {
  const Icon = DRIVER_ICONS[driver] ?? Code2;
  const label = DRIVER_LABELS[driver];
  return (
    <div className="flex items-center justify-between rounded-lg border border-adam-neutral-700 bg-adam-background-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-adam-blue/10">
          <Icon className="h-4 w-4 text-adam-blue" />
        </div>
        <div>
          <div className="text-sm font-medium text-adam-neutral-50">
            {label}
          </div>
          <div className="text-xs text-adam-neutral-400">
            Built-in / server managed
          </div>
        </div>
      </div>
      <Badge
        variant="outline"
        className="border-adam-neutral-700 bg-adam-background-1 text-adam-neutral-400"
      >
        Managed
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom provider card
// ---------------------------------------------------------------------------

interface ProviderCardProps {
  provider: ProviderDetail;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onTest: () => void;
  onManageModels?: () => void;
  isDeleting: boolean;
  isTesting: boolean;
  testResult: TestProviderResultDto | null;
}

function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onToggleEnabled,
  onTest,
  isDeleting,
  isTesting,
  testResult,
  onManageModels,
}: ProviderCardProps) {
  const Icon = DRIVER_ICONS[provider.driver] ?? Code2;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-4 py-3 transition-colors',
        provider.enabled
          ? 'border-adam-neutral-700 bg-adam-background-2'
          : 'border-adam-neutral-800 bg-adam-background-1/50 opacity-60',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              provider.enabled ? 'bg-adam-blue/10' : 'bg-adam-neutral-800',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                provider.enabled ? 'text-adam-blue' : 'text-adam-neutral-500',
              )}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-adam-neutral-50">
              {provider.name}
            </div>
            <div className="text-xs text-adam-neutral-400">
              {provider.baseUrl ?? 'No endpoint configured'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={provider.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={isDeleting || isTesting}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DriverBadge driver={provider.driver} />
        <CredentialBadge hasCredential={provider.hasCredential} />
        <TestStatusBadge result={testResult} />
      </div>

      <div className="flex items-center justify-end gap-2">
        {onManageModels && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onManageModels}
            className="h-7 rounded-full px-2 text-xs text-adam-neutral-400 hover:text-adam-neutral-200"
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Manage Models
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onTest}
          disabled={isTesting || !provider.enabled}
          className="h-7 rounded-full px-2 text-xs"
        >
          {isTesting ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <TestTubes className="mr-1 h-3 w-3" />
          )}
          Test
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isDeleting}
          className="h-7 rounded-full px-2 text-xs"
        >
          <Edit2 className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-adam-red-400 hover:text-adam-red-300 h-7 rounded-full px-2 text-xs"
        >
          {isDeleting ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          Delete
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runtime integration card
// ---------------------------------------------------------------------------

const INTEGRATION_ICONS: Record<
  RuntimeIntegrationStatus['integrationId'],
  typeof Terminal
> = {
  opencode: Terminal,
  codex: Network,
  'local-openai': Server,
};

function RuntimeIntegrationCard({
  integration,
}: {
  integration: RuntimeIntegrationStatus;
}) {
  const Icon = INTEGRATION_ICONS[integration.integrationId];

  const statusColors: Record<
    RuntimeIntegrationStatus['status'],
    { bg: string; text: string; label: string }
  > = {
    connected: {
      bg: 'bg-adam-green/10',
      text: 'text-adam-green',
      label: 'Connected',
    },
    available: {
      bg: 'bg-adam-blue/10',
      text: 'text-adam-blue',
      label: 'Available',
    },
    unavailable: {
      bg: 'bg-adam-orange/10',
      text: 'text-adam-orange',
      label: 'Unavailable',
    },
    'not-configured': {
      bg: 'bg-adam-neutral-800',
      text: 'text-adam-neutral-500',
      label: 'Not configured',
    },
  };

  const status = statusColors[integration.status];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-adam-neutral-700 bg-adam-background-2 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-adam-neutral-800">
            <Icon className="h-4 w-4 text-adam-neutral-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-adam-neutral-50">
              {integration.label}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${status.bg}`} />
                {status.label}
              </span>
              {integration.baseUrl && (
                <span className="text-xs text-adam-neutral-500">
                  {integration.baseUrl.replace(/\/+$/, '')}
                </span>
              )}
            </div>
          </div>
        </div>

        {integration.modelCount > 0 && (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-adam-neutral-500" />
            <span className="text-xs text-adam-neutral-400">
              {integration.modelCount}
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-adam-neutral-500">
        {integration.explanation}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider form (inline editor)
// ---------------------------------------------------------------------------

interface ProviderFormProps {
  mode: 'create' | 'edit';
  initialData?: ProviderDetail;
  onSave: (input: CreateProviderInput | UpdateProviderInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function ProviderForm({
  mode,
  initialData,
  onSave,
  onCancel,
  isSaving,
}: ProviderFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [driver, setDriver] = useState<ProviderSummary['driver']>(
    initialData?.driver ?? 'openai-compatible',
  );
  const [baseUrl, setBaseUrl] = useState(initialData?.baseUrl ?? '');
  const [credential, setCredential] = useState('');
  const [_showCredential, setShowCredential] = useState(false);

  const presetUrl = PRESET_ENDPOINTS[driver] ?? '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const isEdit = mode === 'edit';
    const base = {
      name: name.trim(),
      driver,
      baseUrl: baseUrl || undefined,
    };

    if (isEdit && initialData) {
      const input: UpdateProviderInput = { ...base };
      if (credential) {
        input.credential = credential;
      }
      onSave(input);
    } else {
      const input: CreateProviderInput = {
        ...base,
        slug:
          slug.trim() ||
          name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        ...(credential ? { credential } : {}),
      };
      onSave(input);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-4"
    >
      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
          Display name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Local Model"
          className="h-9"
          required
        />
      </div>

      {/* Slug (create only) */}
      {mode === 'create' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
            Slug (auto-generated from name)
          </label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated"
            className="h-9 text-adam-neutral-400"
            readOnly
          />
        </div>
      )}

      {/* Driver */}
      <div>
        <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
          Driver preset
        </label>
        <select
          value={driver}
          onChange={(e) =>
            setDriver(e.target.value as ProviderSummary['driver'])
          }
          className="h-9 w-full rounded-md border border-adam-neutral-700 bg-adam-background-1 px-3 text-xs text-adam-neutral-300 focus:border-adam-blue/40 focus:outline-none"
        >
          <option value="openai-compatible">OpenAI Compatible</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>

      {/* Base URL */}
      <div>
        <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
          Base URL{' '}
          {presetUrl && (
            <span className="text-adad-green-500/60 ml-1">
              (preset: {presetUrl})
            </span>
          )}
        </label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={presetUrl || 'https://...'}
          className="h-9"
        />
      </div>

      {/* Credential */}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs font-medium text-adam-neutral-300">
          <span className="flex items-center gap-1">
            <Key className="h-3 w-3" />
            API key / token
          </span>
          {initialData?.hasCredential && (
            <button
              type="button"
              onClick={() => {
                setCredential('__REMOVE__');
              }}
              className="text-adam-red-400 hover:text-adam-red-300 text-[10px]"
            >
              Remove existing
            </button>
          )}
        </label>
        <Input
          type={_showCredential ? 'text' : 'password'}
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder={
            initialData?.hasCredential
              ? 'Enter new key to update, or remove existing'
              : 'API key or token'
          }
          className="h-9"
        />
        {credential && (
          <button
            type="button"
            onClick={() => setShowCredential((v) => !v)}
            className="mt-1 text-[10px] text-adam-neutral-400 underline"
          >
            {_showCredential ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="dark"
          onClick={onCancel}
          disabled={isSaving}
          className="h-8 rounded-full px-3 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="h-8 rounded-full px-3 text-xs"
        >
          {isSaving ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Check className="mr-1 h-3 w-3" />
          )}
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Provider model form (inline editor)
// ---------------------------------------------------------------------------

interface ProviderModelFormProps {
  mode: 'create' | 'edit';
  initialData?: ProviderModelDetail;
  onSave: (input: CreateProviderModelInput | UpdateProviderModelInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function ProviderModelForm({
  mode,
  initialData,
  onSave,
  onCancel,
  isSaving,
}: ProviderModelFormProps) {
  const [modelId, setModelId] = useState(
    mode === 'edit' ? (initialData?.modelId ?? '') : '',
  );
  const [displayName, setDisplayName] = useState(
    mode === 'edit' ? (initialData?.displayName ?? '') : '',
  );
  const [description, setDescription] = useState(
    mode === 'edit' ? (initialData?.description ?? '') : '',
  );
  const [supportsTools, setSupportsTools] = useState(
    mode === 'edit' ? (initialData?.supportsTools ?? false) : false,
  );
  const [supportsThinking, setSupportsThinking] = useState(
    mode === 'edit' ? (initialData?.supportsThinking ?? false) : false,
  );
  const [supportsVision, setSupportsVision] = useState(
    mode === 'edit' ? (initialData?.supportsVision ?? false) : false,
  );
  const [contextLimit, setContextLimit] = useState(
    mode === 'edit' ? (initialData?.contextLimit?.toString() ?? '') : '',
  );
  const [outputLimit, setOutputLimit] = useState(
    mode === 'edit' ? (initialData?.outputLimit?.toString() ?? '') : '',
  );
  const [isVisible, setIsVisible] = useState(
    mode === 'edit' ? (initialData?.isVisible ?? true) : true,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base = {
      displayName,
      description: description || null,
      supportsTools,
      supportsThinking,
      supportsVision,
      contextLimit: contextLimit ? parseInt(contextLimit, 10) : null,
      outputLimit: outputLimit ? parseInt(outputLimit, 10) : null,
      isVisible,
    };
    if (mode === 'create') {
      onSave({ ...base, modelId } as CreateProviderModelInput);
    } else {
      onSave(base as UpdateProviderModelInput);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-3"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-adam-neutral-300">
          {mode === 'create' ? 'Add Model' : 'Edit Model'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 rounded-full px-2 text-xs"
        >
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-adam-neutral-400">
            Model ID *
          </label>
          <Input
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="e.g. claude-sonnet-4-20250514"
            disabled={mode === 'edit'}
            required
            className="h-7 rounded-full bg-adam-background-1 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-adam-neutral-400">
            Display Name *
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Claude Sonnet 4"
            required
            className="h-7 rounded-full bg-adam-background-1 text-xs"
          />
        </div>
      </div>

      <div className="mb-2">
        <label className="mb-1 block text-xs text-adam-neutral-400">
          Description
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
          className="rounded-md bg-adam-background-1 text-xs"
        />
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={supportsTools}
            onCheckedChange={setSupportsTools}
            aria-label="Supports tools"
          />
          <span className="text-xs text-adam-neutral-400">Tools</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={supportsThinking}
            onCheckedChange={setSupportsThinking}
            aria-label="Supports thinking"
          />
          <span className="text-xs text-adam-neutral-400">Thinking</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={supportsVision}
            onCheckedChange={setSupportsVision}
            aria-label="Supports vision"
          />
          <span className="text-xs text-adam-neutral-400">Vision</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-adam-neutral-400">
            Context Limit
          </label>
          <Input
            value={contextLimit}
            onChange={(e) => setContextLimit(e.target.value)}
            placeholder="e.g. 128000"
            type="number"
            className="h-7 rounded-full bg-adam-background-1 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-adam-neutral-400">
            Output Limit
          </label>
          <Input
            value={outputLimit}
            onChange={(e) => setOutputLimit(e.target.value)}
            placeholder="e.g. 8192"
            type="number"
            className="h-7 rounded-full bg-adam-background-1 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={isVisible}
            onCheckedChange={setIsVisible}
            aria-label="Enable model"
          />
          <span className="text-xs text-adam-neutral-400">Enabled</span>
        </div>
        <Button
          type="submit"
          size="sm"
          variant="dark"
          disabled={isSaving}
          className="h-7 rounded-full px-2 text-xs"
        >
          {isSaving ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : mode === 'create' ? (
            <Plus className="mr-1 h-3 w-3" />
          ) : (
            <Check className="mr-1 h-3 w-3" />
          )}
          {mode === 'create' ? 'Add Model' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Provider model card
// ---------------------------------------------------------------------------

interface ProviderModelCardProps {
  model: ProviderModelDetail;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ProviderModelCard({
  model,
  onEdit,
  onDelete,
  isDeleting,
}: ProviderModelCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2 transition-colors',
        model.isVisible
          ? 'border-adam-neutral-700 bg-adam-background-1/50'
          : 'border-adam-neutral-800 bg-adam-background-1/30 opacity-50',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-xs text-adam-neutral-300">
              {model.modelId}
            </span>
            <span className="text-xs text-adam-neutral-500">—</span>
            <span className="truncate text-xs text-adam-neutral-400">
              {model.displayName}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {model.supportsTools && (
              <Badge
                variant="secondary"
                className="h-4 rounded px-1 text-[10px]"
              >
                Tools
              </Badge>
            )}
            {model.supportsThinking && (
              <Badge
                variant="secondary"
                className="h-4 rounded px-1 text-[10px]"
              >
                Thinking
              </Badge>
            )}
            {model.supportsVision && (
              <Badge
                variant="secondary"
                className="h-4 rounded px-1 text-[10px]"
              >
                Vision
              </Badge>
            )}
            {model.contextLimit && (
              <span className="text-[10px] text-adam-neutral-500">
                {model.contextLimit.toLocaleString()} ctx
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ml-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isDeleting}
          className="h-6 rounded-full px-1.5 text-[11px]"
        >
          <Edit2 className="mr-0.5 h-2.5 w-2.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-adam-red-400 hover:text-adam-red-300 h-6 rounded-full px-1.5 text-[11px]"
        >
          {isDeleting ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Trash2 className="h-2.5 w-2.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProvidersSettings() {
  const _queryClient = useQueryClient();

  // Fetch data
  const { data: providers = [], isLoading: isProvidersLoading } =
    useProviders();

  // Runtime integrations
  const runtimeIntegrations = useRuntimeIntegrations();

  // Separate built-in vs custom
  const customProviders = providers.filter(
    (p) => !BUILTIN_DRIVERS.includes(p.driver) || false,
  );

  // Built-in drivers (static)
  const builtinDrivers = useMemo(
    () => ['anthropic', 'google', 'openrouter', 'openai-compatible'],
    [],
  );

  // State
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );

  // Detail for editing
  const { data: editingDetail } = useProviderDetail(editingProviderId);

  // Model management state
  const [selectedModelProviderId, setSelectedModelProviderId] = useState<
    string | null
  >(null);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelFormMode, setModelFormMode] = useState<'create' | 'edit'>(
    'create',
  );
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  // Model data
  const { data: modelList = [] } = useProviderModels(selectedModelProviderId);
  const editingModel =
    modelFormMode === 'edit' && editingModelId
      ? modelList.find((m) => m.id === editingModelId)
      : undefined;

  // Model mutations
  const createModelMutation = useCreateProviderModel();
  const updateModelMutation = useUpdateProviderModel();
  const deleteModelMutation = useDeleteProviderModel();

  // Mutations
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();
  const deleteMutation = useDeleteProvider();
  const testMutation = useTestProvider();

  // Test state (per-provider)
  const [testResults, setTestResults] = useState<
    Record<string, TestProviderResultDto | null>
  >({});

  // Handlers
  const handleCreate = useCallback(() => {
    setFormMode('create');
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((provider: ProviderSummary) => {
    setFormMode('edit');
    setEditingProviderId(provider.id);
    setShowForm(true);
  }, []);

  const handleSave = useCallback(
    (input: CreateProviderInput | UpdateProviderInput) => {
      if (formMode === 'edit' && editingDetail) {
        const updateInput = input as UpdateProviderInput;
        if (updateInput.credential === '__REMOVE__') {
          updateInput.credential = null;
        }
        updateMutation.mutate({
          providerId: editingDetail.id,
          input: updateInput,
        });
      } else {
        const createInput = input as CreateProviderInput;
        if (createInput.credential === '__REMOVE__') {
          createInput.credential = undefined;
        }
        createMutation.mutate(createInput);
      }
      setShowForm(false);
      setEditingProviderId(null);
    },
    [formMode, editingDetail, updateMutation, createMutation],
  );

  const handleDelete = useCallback(
    (providerId: string) => {
      if (window.confirm('Delete this provider? This cannot be undone.')) {
        deleteMutation.mutate(providerId);
      }
    },
    [deleteMutation],
  );

  const handleToggleEnabled = useCallback(
    (provider: ProviderDetail) => {
      updateMutation.mutate({
        providerId: provider.id,
        input: { enabled: !provider.enabled },
      });
    },
    [updateMutation],
  );

  const handleTest = useCallback(
    (provider: ProviderDetail) => {
      testMutation.mutate(
        { id: provider.id },
        {
          onSettled: (result) => {
            setTestResults((prev) => ({
              ...prev,
              [provider.id]: result ?? null,
            }));
          },
        },
      );
    },
    [testMutation],
  );

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingProviderId(null);
  }, []);

  // Model handlers
  const handleSelectProviderModels = useCallback((providerId: string) => {
    setSelectedModelProviderId((prev) =>
      prev === providerId ? null : providerId,
    );
  }, []);

  const handleOpenModelForm = useCallback(
    (mode: 'create' | 'edit', modelId?: string) => {
      setModelFormMode(mode);
      setEditingModelId(mode === 'edit' && modelId ? modelId : null);
      setShowModelForm(true);
    },
    [],
  );

  const handleCloseModelForm = useCallback(() => {
    setShowModelForm(false);
    setEditingModelId(null);
  }, []);

  const handleSaveModel = useCallback(
    (input: CreateProviderModelInput | UpdateProviderModelInput) => {
      if (!selectedModelProviderId) return;

      if (modelFormMode === 'edit' && editingModelId) {
        updateModelMutation.mutate({
          providerId: selectedModelProviderId,
          modelId: editingModelId,
          input: input as UpdateProviderModelInput,
        });
      } else {
        createModelMutation.mutate({
          providerId: selectedModelProviderId,
          input: input as CreateProviderModelInput,
        });
      }
      handleCloseModelForm();
    },
    [
      modelFormMode,
      selectedModelProviderId,
      editingModelId,
      updateModelMutation,
      createModelMutation,
      handleCloseModelForm,
    ],
  );

  const handleDeleteModel = useCallback(
    (modelId: string) => {
      if (!selectedModelProviderId) return;
      if (window.confirm('Delete this model? This cannot be undone.')) {
        deleteModelMutation.mutate({
          providerId: selectedModelProviderId,
          modelId,
        });
      }
    },
    [selectedModelProviderId, deleteModelMutation],
  );

  // Loading state
  if (isProvidersLoading) {
    return (
      <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
        <h2 className="mb-5 text-sm font-medium text-adam-neutral-50">
          Providers
        </h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-adam-neutral-500" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-medium text-adam-neutral-50">Providers</h2>
        <Button
          size="sm"
          variant="dark"
          onClick={handleCreate}
          disabled={showForm}
          className="h-7 rounded-full px-2 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Provider
        </Button>
      </div>

      {/* Built-in providers */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-adam-neutral-400" />
          <span className="text-xs font-medium text-adam-neutral-400">
            Built-in providers
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {builtinDrivers.map((driver) => (
            <BuiltinProviderCard
              key={driver}
              driver={driver as ProviderSummary['driver']}
            />
          ))}
        </div>
      </div>

      {/* Runtime integrations */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-adam-neutral-400" />
          <span className="text-xs font-medium text-adam-neutral-400">
            Runtime Integrations
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {runtimeIntegrations.isLoading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-adam-neutral-500" />
              <span className="text-xs text-adam-neutral-500">
                Discovering runtimes…
              </span>
            </div>
          )}
          {runtimeIntegrations.isError && (
            <div className="border-adam-orange/20 bg-adam-orange/5 text-adam-orange rounded-md border px-3 py-2 text-xs">
              Failed to discover runtime integrations
            </div>
          )}
          {!runtimeIntegrations.isLoading &&
            !runtimeIntegrations.isError &&
            runtimeIntegrations.data?.map((integration) => (
              <RuntimeIntegrationCard
                key={integration.integrationId}
                integration={integration}
              />
            ))}
        </div>
      </div>

      {/* Divider */}
      {customProviders.length > 0 && (
        <div className="my-4 border-t border-adam-neutral-800" />
      )}

      {/* Custom providers form */}
      {showForm && (
        <div className="mb-4">
          <ProviderForm
            mode={formMode}
            initialData={editingDetail ?? undefined}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      )}

      {/* Custom provider list */}
      {customProviders.length > 0 && (
        <div className="flex flex-col gap-2">
          {customProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={{
                ...provider,
                baseUrl: null,
                hasCredential: false,
              }}
              onEdit={() => handleEdit(provider)}
              onDelete={() => handleDelete(provider.id)}
              onToggleEnabled={() =>
                handleToggleEnabled({
                  ...provider,
                  baseUrl: null,
                  hasCredential: false,
                } as ProviderDetail)
              }
              onTest={() =>
                handleTest({
                  ...provider,
                  baseUrl: null,
                  hasCredential: false,
                } as ProviderDetail)
              }
              isDeleting={
                deleteMutation.isPending &&
                deleteMutation.variables === provider.id
              }
              isTesting={testMutation.isPending}
              testResult={testResults[provider.id] ?? null}
              onManageModels={() => handleSelectProviderModels(provider.id)}
            />
          ))}
        </div>
      )}

      {/* Model management panel */}
      {selectedModelProviderId && (
        <div className="mb-4 mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-adam-neutral-400" />
              <span className="text-xs font-medium text-adam-neutral-400">
                Models
              </span>
              <span className="text-[10px] text-adam-neutral-500">
                ({modelList.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedModelProviderId(null)}
                className="h-6 rounded-full px-2 text-[10px]"
              >
                ×
              </Button>
              <Button
                size="sm"
                variant="dark"
                onClick={() => handleOpenModelForm('create')}
                disabled={showModelForm}
                className="h-6 rounded-full px-2 text-[10px]"
              >
                <Plus className="mr-0.5 h-2.5 w-2.5" />
                Add Model
              </Button>
            </div>
          </div>

          {/* Model form */}
          {showModelForm && (
            <ProviderModelForm
              mode={modelFormMode}
              initialData={editingModel}
              onSave={handleSaveModel}
              onCancel={handleCloseModelForm}
              isSaving={
                createModelMutation.isPending || updateModelMutation.isPending
              }
            />
          )}

          {/* Model list */}
          <div className="flex flex-col gap-2">
            {modelList.map((model) => (
              <ProviderModelCard
                key={model.modelId}
                model={model}
                onEdit={() => handleOpenModelForm('edit', model.modelId)}
                onDelete={() => handleDeleteModel(model.modelId)}
                isDeleting={
                  deleteModelMutation.isPending &&
                  deleteModelMutation.variables?.modelId === model.modelId
                }
              />
            ))}
            {modelList.length === 0 && !showModelForm && (
              <div className="rounded-md border border-dashed border-adam-neutral-800 px-3 py-4 text-center">
                <div className="text-xs text-adam-neutral-500">
                  No models configured
                </div>
                <div className="text-adam-neutral-600 mt-0.5 text-[10px]">
                  Add models available through this provider
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {customProviders.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-adam-neutral-800 bg-adam-background-1/50 px-4 py-8 text-center">
          <Plug className="text-adam-neutral-600 mx-auto mb-2 h-5 w-5" />
          <div className="text-sm text-adam-neutral-400">
            No custom providers configured
          </div>
          <div className="mt-1 text-xs text-adam-neutral-500">
            Add a provider to connect to custom AI endpoints
          </div>
        </div>
      )}
    </section>
  );
}
