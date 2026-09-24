import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { normalizeBuiltinProductTemplate } from '@shared/productTemplate';
import {
  digestCanonicalBrepProjectSource,
  materializeBuiltinProductTemplate,
} from '@shared/productTemplateProjectCreation';

function fixture(version = 1) {
  return normalizeBuiltinProductTemplate({
    id: 'builtin:creation-fixture',
    version,
    name: 'Creation fixture',
    category: 'Test fixtures',
    source: {
      kind: 'brep',
      source: phaseOneCabinetProject,
    },
  });
}

describe('template project materialization', () => {
  it('creates an independent canonical project snapshot with exact provenance', async () => {
    const template = fixture(3);
    const materialized = await materializeBuiltinProductTemplate(template);

    expect(materialized.title).toBe(template.name);
    expect(materialized.project).toEqual(template.source.source);
    expect(materialized.project).not.toBe(template.source.source);
    expect(materialized.project.parameters).not.toBe(
      template.source.source.parameters,
    );
    expect(materialized.projectOrigin).toMatchObject({
      kind: 'template',
      catalog: 'builtin',
      templateId: template.id,
      templateVersion: 3,
    });
    expect(materialized.projectOrigin.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps template version out of the canonical source digest', async () => {
    const versionOne = await materializeBuiltinProductTemplate(fixture(1));
    const versionTwo = await materializeBuiltinProductTemplate(fixture(2));

    expect(versionOne.projectOrigin.sourceDigest).toBe(
      versionTwo.projectOrigin.sourceDigest,
    );
    expect(versionOne.projectOrigin.templateVersion).toBe(1);
    expect(versionTwo.projectOrigin.templateVersion).toBe(2);
  });

  it('changes the digest when the normalized canonical source changes', async () => {
    const original = await digestCanonicalBrepProjectSource(
      phaseOneCabinetProject,
    );
    const changedProject = {
      ...phaseOneCabinetProject,
      parameters: phaseOneCabinetProject.parameters.map((parameter) =>
        parameter.id === 'width' ? { ...parameter, default: 1300 } : parameter,
      ),
    };
    const changed = await digestCanonicalBrepProjectSource(changedProject);

    expect(changed).not.toBe(original);
  });
});
