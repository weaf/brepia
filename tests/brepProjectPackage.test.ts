import { describe, expect, it } from 'vitest';
import {
  createBrepProjectPackage,
  BREP_PROJECT_PACKAGE_MAX_BYTES,
  normalizeBrepProjectPackage,
  parseBrepProjectPackageJson,
  serializeBrepProjectPackage,
} from '@shared/brepProjectPackage';
import { withBrepProjectParameterValues } from '@shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '@shared/brepSamples';

function cabinetPackage() {
  const project = withBrepProjectParameterValues(phaseOneCabinetProject, {
    width: 1450,
    height: 2100,
  });
  return createBrepProjectPackage({
    title: 'Railway cabinet',
    source: { kind: 'brep', source: project },
  });
}

describe('canonical BRep project package', () => {
  it('round-trips deterministically with stable semantic identities and current parameter state', () => {
    const packageValue = cabinetPackage();
    const serialized = serializeBrepProjectPackage(packageValue);
    const parsed = parseBrepProjectPackageJson(serialized);

    expect(parsed).toEqual(packageValue);
    expect(serializeBrepProjectPackage(parsed)).toBe(serialized);
    expect(parsed.source.source.id).toBe(phaseOneCabinetProject.id);
    expect(parsed.source.source.resultNodeId).toBe(
      phaseOneCabinetProject.resultNodeId,
    );
    expect(parsed.source.source.placement).toEqual(
      phaseOneCabinetProject.placement,
    );
    expect(parsed.source.source.metadata).toEqual(phaseOneCabinetProject.metadata);
    expect(
      parsed.source.source.parameters.find((parameter) => parameter.id === 'width')
        ?.default,
    ).toBe(1450);
    expect(
      parsed.source.source.parameters.find(
        (parameter) => parameter.id === 'height',
      )?.default,
    ).toBe(2100);
  });

  it('drops derived or unrelated payloads instead of making them source authority', () => {
    const packageValue = cabinetPackage();
    const normalized = normalizeBrepProjectPackage({
      ...packageValue,
      viewerMesh: { positions: [1, 2, 3] },
      step: 'ISO-10303-21',
      hostPath: '/tmp/native-model.step',
    });
    const serialized = serializeBrepProjectPackage(normalized);

    expect(normalized).toEqual(packageValue);
    expect(serialized).not.toContain('viewerMesh');
    expect(serialized).not.toContain('ISO-10303-21');
    expect(serialized).not.toContain('/tmp/native-model.step');
  });

  it('rejects unsupported package versions and non-BRep source payloads', () => {
    const packageValue = cabinetPackage();
    expect(() =>
      normalizeBrepProjectPackage({ ...packageValue, schemaVersion: 2 }),
    ).toThrow(/unsupported.*schema version/i);
    expect(() =>
      normalizeBrepProjectPackage({
        ...packageValue,
        source: {
          kind: 'openscad',
          source: {
            schemaVersion: 1,
            entrypointPath: 'main.scad',
            files: [{ path: 'main.scad', content: 'cube(10);\n' }],
          },
        },
      }),
    ).toThrow(/source must have kind brep/i);
  });

  it('rejects malformed JSON and oversized input before project normalization', () => {
    expect(() => parseBrepProjectPackageJson('{not json')).toThrow(
      /not valid JSON/i,
    );
    expect(() =>
      parseBrepProjectPackageJson('x'.repeat(BREP_PROJECT_PACKAGE_MAX_BYTES + 1)),
    ).toThrow(/exceeds.*bytes/i);
  });
});
