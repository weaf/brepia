import { useEffect, useMemo, useState } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { ThreeScene } from '@/components/viewer/ThreeScene';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/services/api';
import { exportBrepStep } from '@/services/brepStepExport';
import { createBrepProjectConversation } from '@/services/brepProjectService';
import { importBrepProjectConversation } from '@/services/brepProjectService';
import { downloadSTEPFile } from '@/utils/downloadUtils';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import type { BrepProject } from '@shared/brepProject';
import {
  createBrepProjectPackage,
  serializeBrepProjectPackage,
} from '@shared/brepProjectPackage';
import type {
  BrepEvaluationSuccess,
  BrepParameterValues,
} from '@shared/brepProvider';

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

export function BrepProjectPreview({
  project = phaseOneCabinetProject,
  createProject = false,
  onParameterValuesCommit,
  revisions = [],
  activeRevisionId,
  onSelectRevision,
  onRestoreRevision,
  exportPackage = false,
  importPackage = false,
}: {
  project?: BrepProject;
  createProject?: boolean;
  onParameterValuesCommit?: (values: BrepParameterValues) => Promise<void>;
  revisions?: Array<{ id: string; label: string }>;
  activeRevisionId?: string;
  onSelectRevision?: (id: string) => Promise<void>;
  onRestoreRevision?: (id: string) => Promise<void>;
  exportPackage?: boolean;
  importPackage?: boolean;
}) {
  const { user } = useAuth();
  const [values, setValues] = useState<BrepParameterValues>(() =>
    Object.fromEntries(
      project.parameters.map((parameter) => [parameter.id, parameter.default]),
    ),
  );
  const [result, setResult] = useState<BrepEvaluationSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const geometry = useMemo(
    () => (result ? geometryFromResult(result) : null),
    [result],
  );

  useEffect(() => {
    return () => geometry?.dispose();
  }, [geometry]);

  useEffect(() => {
    const controller = new AbortController();
    const evaluate = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = (await supabase.auth.getSession()).data.session
          ?.access_token;
        const response = await fetch(apiUrl('brep/evaluate'), {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            project,
            parameterValues: values,
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
        setResult(payload as BrepEvaluationSuccess);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'BRep evaluation failed.',
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void evaluate();
    return () => controller.abort();
  }, [project, values]);

  return (
    <main className="grid h-full min-h-[600px] grid-cols-1 gap-4 p-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark p-5 text-adam-text-primary">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-sm text-adam-text-tertiary">
          Native BRep project. Published values are ready for future Grasshopper
          inputs.
        </p>
        <div className="mt-6 space-y-4">
          {project.parameters.map((parameter) => (
            <label className="block text-sm" key={parameter.id}>
              <span>
                {parameter.label} ({parameter.unit})
              </span>
              <input
                className="border-adam-neutral-600 mt-1 w-full rounded border bg-adam-neutral-900 p-2"
                type="number"
                min={parameter.min}
                max={parameter.max}
                step={parameter.step}
                value={values[parameter.id]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [parameter.id]: Number(event.target.value),
                  }))
                }
                onBlur={() => {
                  if (!onParameterValuesCommit) return;
                  void onParameterValuesCommit(values).catch((reason) => {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : 'Could not persist BRep parameter revision.',
                    );
                  });
                }}
              />
            </label>
          ))}
        </div>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => setValues((current) => ({ ...current }))}
        >
          Re-evaluate
        </Button>
        <Button
          className="mt-3 w-full"
          disabled={exporting || loading}
          variant="outline"
          onClick={async () => {
            setExporting(true);
            setError(null);
            try {
              const step = await exportBrepStep(project, values);
              downloadSTEPFile(step);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'BRep STEP export failed.',
              );
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? 'Exporting STEP…' : 'Export native STEP'}
        </Button>
        {exportPackage ? (
          <Button
            className="mt-3 w-full"
            variant="outline"
            onClick={() => {
              const text = serializeBrepProjectPackage(
                createBrepProjectPackage({
                  title: project.name,
                  source: { kind: 'brep', source: project },
                }),
              );
              const url = URL.createObjectURL(
                new Blob([text], { type: 'application/json' }),
              );
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `${project.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'brep-project'}.brepia-brep.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export BRep project
          </Button>
        ) : null}
        {createProject ? (
          <Button
            className="mt-3 w-full"
            disabled={creating || !user?.id}
            onClick={async () => {
              if (!user?.id) return;
              setCreating(true);
              setError(null);
              try {
                const conversationId = await createBrepProjectConversation({
                  userId: user.id,
                  title: project.name,
                  project,
                });
                window.location.assign(`/brep/${conversationId}`);
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : 'Could not create BRep project.',
                );
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? 'Creating project…' : 'Create BRep project'}
          </Button>
        ) : null}
        {importPackage ? (
          <label className="mt-3 block">
            <span className="sr-only">Import BRep project package</span>
            <input
              accept="application/json,.json,.brepia-brep.json"
              className="block w-full text-sm"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !user?.id) return;
                void file
                  .text()
                  .then(async (text) => {
                    const { parseBrepProjectPackageJson } =
                      await import('@shared/brepProjectPackage');
                    const conversationId = await importBrepProjectConversation({
                      userId: user.id,
                      projectPackage: parseBrepProjectPackageJson(text),
                    });
                    window.location.assign(`/brep/${conversationId}`);
                  })
                  .catch((reason) =>
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : 'Could not import BRep project.',
                    ),
                  );
              }}
            />
          </label>
        ) : null}
        {revisions.length > 1 ? (
          <div className="mt-6 border-t border-adam-neutral-700 pt-4">
            <p className="text-sm font-medium">Source revisions</p>
            <div className="mt-2 space-y-2">
              {revisions.map((revision) => (
                <div className="flex gap-2" key={revision.id}>
                  <Button
                    className="flex-1 justify-start"
                    disabled={revision.id === activeRevisionId}
                    size="sm"
                    variant="outline"
                    onClick={() => void onSelectRevision?.(revision.id)}
                  >
                    {revision.label}
                  </Button>
                  <Button
                    disabled={!onRestoreRevision}
                    size="sm"
                    variant="outline"
                    onClick={() => void onRestoreRevision?.(revision.id)}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {loading && <p className="mt-4 text-sm">Evaluating native BRep…</p>}
        {error && (
          <p className="mt-4 rounded border border-destructive p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {result?.warnings.length ? (
          <p className="mt-4 text-sm">Warnings: {result.warnings.join('; ')}</p>
        ) : null}
      </section>
      <section className="min-h-[520px] overflow-hidden rounded-lg border border-adam-neutral-700 bg-adam-neutral-800">
        {geometry ? (
          <ThreeScene geometry={geometry} color="#00A6FF" />
        ) : (
          <div className="flex h-full items-center justify-center text-adam-text-tertiary">
            {loading ? 'Preparing BRep viewer…' : 'No BRep geometry available.'}
          </div>
        )}
      </section>
    </main>
  );
}
