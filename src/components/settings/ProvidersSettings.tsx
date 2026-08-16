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

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Check,
  CheckCircle2,
  Code2,
  Edit2,
  Key,
  Loader2,
  Plus,
  Plug,
  Settings2,
  TestTubes,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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

interface TestProviderResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchProviders(): Promise<ProviderSummary[]> {
  const res = await fetch('/api/ai-settings/providers');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchProviderDetail(id: string): Promise<ProviderDetail> {
  const res = await fetch(`/api/ai-settings/providers/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function createProvider(
  input: CreateProviderInput,
): Promise<ProviderDetail> {
  const res = await fetch('/api/ai-settings/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create provider');
  }
  return res.json();
}

async function updateProvider(
  providerId: string,
  input: UpdateProviderInput,
): Promise<ProviderDetail> {
  const res = await fetch(`/api/ai-settings/providers/${providerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update provider');
  }
  return res.json();
}

async function deleteProvider(providerId: string): Promise<void> {
  const res = await fetch(`/api/ai-settings/providers/${providerId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to delete provider');
  }
}

async function testProviderConnection(
  req: TestProviderRequest,
): Promise<TestProviderResult> {
  const res = await fetch('/api/ai-settings/providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

function useProviderDetail(id: string | null) {
  return useQuery({
    queryKey: ['provider', id ?? ''],
    queryFn: () => (id ? fetchProviderDetail(id) : null),
    enabled: !!id,
    staleTime: 0,
  });
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

function TestStatusBadge({ result }: { result?: TestProviderResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <span className="border-adam-emerald-800/50 bg-adam-emerald-950/20 text-adam-emerald-400 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {result.latencyMs}ms
      </span>
    );
  }
  return (
    <span className="border-adam-red-800/50 bg-adam-red-950/20 text-adam-red-400 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
      <XCircle className="h-2.5 w-2.5" />
      Failed
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
  isDeleting: boolean;
  isTesting: boolean;
  testResult: TestProviderResult | null;
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
// Main component
// ---------------------------------------------------------------------------

export function ProvidersSettings() {
  const { user: _user } = useAuth();
  const _queryClient = useQueryClient();

  // Fetch data
  const { data: providers = [], isLoading: isProvidersLoading } =
    useProviders();

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

  // Mutations
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();
  const deleteMutation = useDeleteProvider();
  const testMutation = useTestProvider();

  // Test state (per-provider)
  const [testResults, setTestResults] = useState<
    Record<string, TestProviderResult | null>
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
            />
          ))}
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
