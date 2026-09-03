import { useEffect, useMemo, useState } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { ThreeScene } from '@/components/viewer/ThreeScene';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/services/api';
import { phaseOneCabinetProject } from '@shared/brepSamples';
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

export function BrepProjectPreview() {
  const [values, setValues] = useState<BrepParameterValues>(() =>
    Object.fromEntries(
      phaseOneCabinetProject.parameters.map((parameter) => [
        parameter.id,
        parameter.default,
      ]),
    ),
  );
  const [result, setResult] = useState<BrepEvaluationSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const geometry = useMemo(
    () => (result ? geometryFromResult(result) : null),
    [result],
  );

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
            project: phaseOneCabinetProject,
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
  }, [values]);

  return (
    <main className="grid h-full min-h-[600px] grid-cols-1 gap-4 p-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark p-5 text-adam-text-primary">
        <h1 className="text-xl font-semibold">{phaseOneCabinetProject.name}</h1>
        <p className="mt-2 text-sm text-adam-text-tertiary">
          Native BRep Phase 1 sample. Published values are ready for future
          Grasshopper inputs.
        </p>
        <div className="mt-6 space-y-4">
          {phaseOneCabinetProject.parameters.map((parameter) => (
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
