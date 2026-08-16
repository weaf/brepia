// P04D: Prompt profiles settings UI — PromptProfilesSettings section.
//
// Renders the prompt profile list and detail editor in SettingsView.
// Supports:
// - built-in profile (read-only, non-editable, non-deletable)
// - custom profiles (create, edit, duplicate, archive, delete)
// - overlay vs fork mode display
// - fingerprint mismatch warnings for forked profiles
// - "Set as default" to pin a profile as the conversation default
// - "Restore CADAM Original" clears defaultPromptProfileId
//
// API: /api/ai-settings/profiles (GET list + POST create,
//      /api/ai-settings/profiles/:id (GET detail, PATCH update, DELETE archive/delete),
//      /api/ai-settings/preferences (PUT to update defaultPromptProfileId)

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Copy,
  Archive,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Settings2,
  SquarePen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptProfileSummary {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  mode: 'overlay' | 'fork';
  archived: boolean;
  fingerprint: string | null;
  editable: boolean;
  deletable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptProfileDetail extends PromptProfileSummary {
  promptTemplate: string;
  baseRevision: string | null;
}

interface AiPreferences {
  defaultPromptProfileId: string | null;
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

async function fetchProfiles(): Promise<PromptProfileSummary[]> {
  const res = await fetch('/api/ai-settings/profiles');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchProfileDetail(id: string): Promise<PromptProfileDetail> {
  const res = await fetch(`/api/ai-settings/profiles/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPreferences(): Promise<AiPreferences> {
  const res = await fetch('/api/ai-settings/preferences');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// React Query hooks
// ---------------------------------------------------------------------------

function usePromptProfiles() {
  return useQuery({
    queryKey: ['prompt-profiles'],
    queryFn: fetchProfiles,
    staleTime: 0,
  });
}

function usePromptProfileDetail(id: string | null) {
  return useQuery({
    queryKey: ['prompt-profile', id ?? ''],
    queryFn: () => (id ? fetchProfileDetail(id) : null),
    enabled: !!id,
    staleTime: 0,
  });
}

function useAiPreferences() {
  return useQuery({
    queryKey: ['ai-preferences'],
    queryFn: fetchPreferences,
    staleTime: 0,
  });
}

function useSetDefaultPromptProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string | null) => {
      const res = await fetch('/api/ai-settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultPromptProfileId: profileId }),
      });
      if (!res.ok) throw new Error('Failed to set default profile');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-preferences'] });
      toast({
        title: 'Default profile updated',
        description: 'New conversations will use this prompt profile.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to set default profile.',
        variant: 'destructive',
      });
    },
  });
}

function useCreateProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      promptTemplate: string;
      description?: string | null;
      baseRevision?: string | null;
    }) => {
      const res = await fetch('/api/ai-settings/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to create profile');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-profiles'] });
      toast({
        title: 'Profile created',
        description: 'New prompt profile saved.',
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to create profile.',
        variant: 'destructive',
      });
    },
  });
}

function useUpdateProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      input,
    }: {
      profileId: string;
      input: {
        name?: string;
        promptTemplate?: string;
        description?: string | null;
        baseRevision?: string | null;
      };
    }) => {
      const res = await fetch(`/api/ai-settings/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to update profile');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prompt-profiles'] });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: ['prompt-profile', data.id],
        });
      }
      toast({
        title: 'Profile updated',
        description: 'Prompt profile saved.',
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to update profile.',
        variant: 'destructive',
      });
    },
  });
}

function useArchiveProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/ai-settings/profiles/${profileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to archive profile');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-profiles'] });
      toast({
        title: 'Profile archived',
        description: 'Prompt profile has been archived.',
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Error',
        description: e.message ?? 'Failed to archive profile.',
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: detect overlay vs fork mode
// ---------------------------------------------------------------------------

function getProfileMode(
  profile: PromptProfileDetail | null,
  isBuiltIn: boolean,
): 'built-in' | 'overlay' | 'fork' {
  if (isBuiltIn) return 'built-in';
  if (!profile) return 'fork';
  // Overlay: has a baseRevision that matches the current built-in fingerprint
  if (profile.baseRevision) {
    return 'fork'; // fork profile (full copy with baseRevision)
  }
  // No baseRevision → treat as overlay (user just added custom instructions)
  return 'overlay';
}

// ---------------------------------------------------------------------------
// Badge rendering
// ---------------------------------------------------------------------------

function ModeBadge({ mode }: { mode: 'built-in' | 'overlay' | 'fork' }) {
  const config = {
    'built-in': {
      label: 'CADAM Original',
      className: 'bg-adam-blue/15 text-adam-blue border-adam-blue/20',
    },
    overlay: {
      label: 'Overlay',
      className: 'bg-adam-emerald/15 text-adam-emerald border-adam-emerald/20',
    },
    fork: {
      label: 'Fork',
      className: 'bg-adam-amber/15 text-adam-amber border-adam-amber/20',
    },
  };
  const { label, className } = config[mode];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Default profile indicator
// ---------------------------------------------------------------------------

function DefaultBadge({
  profileId,
  defaultId,
}: {
  profileId: string;
  defaultId: string | null;
}) {
  const isActive = profileId === defaultId;
  if (!isActive) return null;
  return (
    <Badge
      variant="outline"
      className="border-adad-green-500/30 ml-2 h-4 bg-adam-blue/10 text-[10px] text-adam-blue"
    >
      <Settings2 className="mr-0.5 h-2.5 w-2.5" />
      Default
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Fingerprint mismatch warning
// ---------------------------------------------------------------------------

function FingerprintWarning({
  baseRevision,
  builtInFingerprint,
}: {
  baseRevision: string;
  builtInFingerprint: string | null;
}) {
  if (!baseRevision || !builtInFingerprint) return null;
  const mismatched = baseRevision !== builtInFingerprint;
  if (!mismatched) return null;
  return (
    <div className="border-adam-amber-800/50 bg-adam-amber-950/20 flex items-start gap-2 rounded-lg border p-3">
      <AlertTriangle className="text-adam-amber-400 mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-adam-amber-300 text-xs font-medium">
          Forked from an older version
        </div>
        <p className="text-adam-amber-200/70 mt-0.5 text-xs">
          This full copy was forked from a previous CADAM prompt revision and
          does not automatically inherit future updates.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile list item
// ---------------------------------------------------------------------------

function ProfileListItem({
  profile,
  isActive,
  defaultId,
  onSelect,
  onArchive,
  isArchiving,
}: {
  profile: PromptProfileSummary;
  isActive: boolean;
  defaultId: string | null;
  onSelect: () => void;
  onArchive: () => void;
  isArchiving: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
        isActive
          ? 'border-adam-blue/40 bg-adam-blue/5'
          : 'border-transparent hover:bg-adam-neutral-800/40'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate text-sm ${
                isActive
                  ? 'font-medium text-adam-neutral-50'
                  : 'text-adam-neutral-300'
              }`}
            >
              {profile.name}
            </span>
            {!profile.editable ? (
              <Badge
                variant="outline"
                className="border-adam-blue/30 bg-adam-blue/10 text-[10px] text-adam-blue"
              >
                CADAM Original
              </Badge>
            ) : (
              <ModeBadge mode={profile.mode} />
            )}
            <DefaultBadge profileId={profile.id} defaultId={defaultId} />
          </div>
          {profile.description && (
            <div className="truncate text-xs text-adam-neutral-400">
              {profile.description}
            </div>
          )}
        </div>
      </button>
      {profile.deletable && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          disabled={isArchiving}
          className="ml-2 h-7 w-7 shrink-0 rounded-full p-0"
        >
          {isArchiving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-adam-neutral-500" />
          ) : (
            <Archive className="h-3.5 w-3.5 text-adam-neutral-400" />
          )}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile editor (inline dialog for creating/editing)
// ---------------------------------------------------------------------------

interface ProfileEditorProps {
  mode: 'create' | 'edit';
  initialData?: PromptProfileDetail;
  builtInFingerprint: string | null;
  onSave: (input: {
    name: string;
    promptTemplate: string;
    description?: string | null;
    baseRevision?: string | null;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function ProfileEditor({
  mode,
  initialData,
  builtInFingerprint,
  onSave,
  onCancel,
  isSaving,
}: ProfileEditorProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [promptTemplate, setPromptTemplate] = useState(
    initialData?.promptTemplate ?? '',
  );
  const [description, setDescription] = useState(
    initialData?.description ?? '',
  );
  const [baseRevision] = useState<string | null>(
    initialData?.baseRevision ?? null,
  );

  const isFork = !!baseRevision;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !promptTemplate.trim()) return;
    onSave({
      name: name.trim(),
      promptTemplate: promptTemplate.trim(),
      description: description.trim() || null,
      baseRevision,
    });
  };

  return (
    <div className="rounded-xl border border-adam-neutral-700 bg-adam-background-2 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name input */}
        <div>
          <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
            Profile name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My custom prompt"
            className="h-9"
          />
        </div>

        {/* Mode indicator */}
        <div className="flex items-center gap-2">
          <ModeBadge mode={isFork ? 'fork' : 'overlay'} />
          {isFork && (
            <span className="text-xs text-adam-neutral-400">
              Full copy — does not inherit future CADAM updates
            </span>
          )}
        </div>

        {/* Fingerprint warning for forks */}
        {isFork &&
          builtInFingerprint &&
          baseRevision !== builtInFingerprint && (
            <FingerprintWarning
              baseRevision={baseRevision}
              builtInFingerprint={builtInFingerprint}
            />
          )}

        {/* Prompt template (monospaced) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
            Prompt template
          </label>
          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={12}
            className="w-full resize-y rounded-lg border border-adam-neutral-700 bg-adam-background-1 p-3 font-mono text-xs leading-relaxed text-adam-neutral-200 placeholder:text-adam-neutral-500 focus:border-adam-blue/50 focus:outline-none focus:ring-1 focus:ring-adam-blue/20"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-adam-neutral-300">
            Description (optional)
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this profile"
            className="h-9"
          />
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
            disabled={isSaving || !name.trim() || !promptTemplate.trim()}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptProfilesSettings() {
  const { user: _user } = useAuth();
  const _queryClient = useQueryClient();

  // Fetch data
  const { data: profiles = [], isLoading: isProfilesLoading } =
    usePromptProfiles();
  const { data: prefs } = useAiPreferences();
  const defaultPromptProfileId = prefs?.defaultPromptProfileId ?? null;

  // State
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');

  // Derived
  const customProfiles = profiles.filter((p) => p.editable);
  const builtinProfile = profiles.find((p) => !p.editable) ?? null;
  const builtInFingerprint = builtinProfile?.fingerprint ?? null;

  // Fetch detail for selected profile
  const { data: selectedDetail } = usePromptProfileDetail(selectedProfileId);
  const mode = getProfileMode(
    selectedDetail ?? null,
    !!builtinProfile?.id && selectedProfileId === builtinProfile.id,
  );

  // Mutations
  const setDefaultMutation = useSetDefaultPromptProfile();
  const createMutation = useCreateProfile();
  const updateMutation = useUpdateProfile();
  const archiveMutation = useArchiveProfile();

  // Handlers
  const handleSelectProfile = useCallback((id: string) => {
    setSelectedProfileId(id);
    setShowEditor(false);
  }, []);

  const handleSetDefault = useCallback(
    (profileId: string | null) => {
      setDefaultMutation.mutate(profileId);
    },
    [setDefaultMutation],
  );

  const handleEdit = useCallback((_profile: PromptProfileDetail) => {
    setEditorMode('edit');
    setShowEditor(true);
  }, []);

  const handleDuplicate = useCallback(() => {
    if (!selectedDetail) return;
    setEditorMode('create');
    setShowEditor(true);
  }, [selectedDetail]);

  const handleCreate = useCallback(() => {
    setEditorMode('create');
    setShowEditor(true);
  }, []);

  const handleSave = useCallback(
    (input: {
      name: string;
      promptTemplate: string;
      description?: string | null;
      baseRevision?: string | null;
    }) => {
      if (showEditor && editorMode === 'edit' && selectedDetail) {
        updateMutation.mutate({ profileId: selectedDetail.id, input });
      } else {
        createMutation.mutate(input);
      }
      setShowEditor(false);
    },
    [showEditor, editorMode, selectedDetail, updateMutation, createMutation],
  );

  const handleArchiveSelected = useCallback(() => {
    if (!selectedDetail) return;
    archiveMutation.mutate(selectedDetail.id);
    setSelectedProfileId(null);
  }, [selectedDetail, archiveMutation]);

  // Built-in profile detail (always available)
  const builtinDetail = useMemo(() => {
    if (!builtinProfile) return null;
    return {
      ...builtinProfile,
      promptTemplate: '', // built-in template is loaded server-side
      baseRevision: null,
      fingerprint: builtInFingerprint,
    } as PromptProfileDetail;
  }, [builtinProfile, builtInFingerprint]);

  // Loading state
  const isLoading = isProfilesLoading;

  if (isLoading) {
    return (
      <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
        <h2 className="mb-5 text-sm font-medium text-adam-neutral-50">
          Prompt Profiles
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
        <h2 className="text-sm font-medium text-adam-neutral-50">
          Prompt Profiles
        </h2>
        <Button
          size="sm"
          variant="dark"
          onClick={handleCreate}
          className="h-7 rounded-full px-2 text-xs"
        >
          <SquarePen className="mr-1 h-3 w-3" />
          New Profile
        </Button>
      </div>

      {/* Profile list */}
      <div className="mb-4 flex flex-col gap-1">
        {builtinProfile && (
          <ProfileListItem
            profile={builtinProfile}
            isActive={selectedProfileId === builtinProfile.id}
            defaultId={defaultPromptProfileId}
            onSelect={() => handleSelectProfile(builtinProfile.id)}
            onArchive={() => {}}
            isArchiving={false}
          />
        )}
        {customProfiles.map((profile) => (
          <ProfileListItem
            key={profile.id}
            profile={profile}
            isActive={selectedProfileId === profile.id}
            defaultId={defaultPromptProfileId}
            onSelect={() => handleSelectProfile(profile.id)}
            onArchive={() => handleArchiveSelected()}
            isArchiving={
              archiveMutation.isPending && selectedProfileId === profile.id
            }
          />
        ))}
      </div>

      {/* Detail panel (when a profile is selected and no editor is open) */}
      {!showEditor && selectedDetail && (
        <div className="mt-4 rounded-xl border border-adam-neutral-700 bg-adam-background-1 p-4">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ModeBadge mode={mode} />
              {!selectedDetail.editable && (
                <Badge
                  variant="outline"
                  className="border-adam-blue/30 bg-adam-blue/10 text-[10px] text-adam-blue"
                >
                  Read-only
                </Badge>
              )}
              <DefaultBadge
                profileId={selectedDetail.id}
                defaultId={defaultPromptProfileId}
              />
            </div>
            <div className="flex items-center gap-1">
              {selectedDetail.editable && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(selectedDetail)}
                    className="h-7 w-7 rounded-full p-0"
                    title="Edit profile"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-adam-neutral-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDuplicate}
                    className="h-7 w-7 rounded-full p-0"
                    title="Duplicate profile"
                  >
                    <Copy className="h-3.5 w-3.5 text-adam-neutral-400" />
                  </Button>
                </>
              )}
              {!selectedDetail.deletable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefault(null)}
                  className="h-7 w-7 rounded-full p-0"
                  title="Restore CADAM Original"
                >
                  <X className="h-3.5 w-3.5 text-adam-neutral-400" />
                </Button>
              )}
            </div>
          </div>

          {/* Prompt template display */}
          <div className="rounded-lg border border-adam-neutral-800 bg-adam-background-2 p-3">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-adam-neutral-200">
              {selectedDetail.promptTemplate || '(no prompt text)'}
            </pre>
          </div>

          {/* Fork warning */}
          {selectedDetail.baseRevision && (
            <FingerprintWarning
              baseRevision={selectedDetail.baseRevision}
              builtInFingerprint={builtInFingerprint}
            />
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-adam-neutral-400">
              {mode === 'fork' && (
                <span className="text-adam-amber-300/80">
                  Fork — does not inherit future CADAM updates
                </span>
              )}
            </div>
            <Button
              variant="dark"
              size="sm"
              onClick={() =>
                handleSetDefault(
                  selectedDetail.id === defaultPromptProfileId
                    ? null
                    : selectedDetail.id,
                )
              }
              disabled={
                defaultPromptProfileId === selectedDetail.id ||
                setDefaultMutation.isPending
              }
              className="h-7 rounded-full px-2 text-xs"
            >
              {defaultPromptProfileId === selectedDetail.id ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Set as default
                </>
              ) : (
                'Set as default'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Built-in prompt viewer (when built-in is selected) */}
      {!showEditor &&
        selectedProfileId === builtinProfile?.id &&
        builtinDetail && (
          <div className="mt-4 rounded-xl border border-adam-neutral-700 bg-adam-background-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ModeBadge mode="built-in" />
                <Badge
                  variant="outline"
                  className="border-adam-blue/30 bg-adam-blue/10 text-[10px] text-adam-blue"
                >
                  Read-only
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefault(null)}
                  className="h-7 w-7 rounded-full p-0"
                  title="Restore CADAM Original"
                >
                  <X className="h-3.5 w-3.5 text-adam-neutral-400" />
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-adam-neutral-800 bg-adam-background-2 p-3">
              <p className="text-sm italic text-adam-neutral-400">
                Built-in prompt loaded from upstream — edit to create a custom
                profile.
              </p>
            </div>
          </div>
        )}

      {/* Editor (create or edit) */}
      {showEditor && (
        <ProfileEditor
          mode={editorMode}
          initialData={selectedDetail ?? undefined}
          builtInFingerprint={builtInFingerprint}
          onSave={handleSave}
          onCancel={() => setShowEditor(false)}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </section>
  );
}
