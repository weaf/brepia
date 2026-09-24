import { describe, expect, it } from 'vitest';
import { withBrepProjectParameterValues } from '@shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { createBuiltinProductTemplateCatalog } from '@shared/productTemplateCatalog';
import {
  digestCanonicalBrepProjectSource,
  materializeBuiltinProductTemplate,
} from '@shared/productTemplateProjectCreation';
import { parseProjectOrigin, SCRATCH_PROJECT_ORIGIN } from '@shared/projectOrigin';

function template(version: number, presentationLabel = 'Dimensions') {
  return {
    id: 'builtin:c1-acceptance-fixture',
    version,
    name: 'C1 acceptance fixture',
    category: 'Acceptance',
    source: {
      kind: 'brep',
      source: phaseOneCabinetProject,
    },
    presentation: {
      groups: [
        {
          id: 'dimensions',
          label: presentationLabel,
          parameterIds: ['width', 'height'],
        },
      ],
    },
  } as const;
}

describe('Phase C1 template foundation acceptance', () => {
  it('materializes independent projects from the same immutable template snapshot', async () => {
    const catalog = createBuiltinProductTemplateCatalog([template(1)]);
    const exact = catalog.requireExact({
      id: 'builtin:c1-acceptance-fixture',
      version: 1,
    });

    const first = await materializeBuiltinProductTemplate(exact);
    const second = await materializeBuiltinProductTemplate(exact);

    expect(first.project).toEqual(second.project);
    expect(first.project).not.toBe(second.project);
    expect(first.project.parameters).not.toBe(second.project.parameters);
    expect(first.projectOrigin).toEqual(second.projectOrigin);

    const revisedFirst = withBrepProjectParameterValues(first.project, {
      width: 1550,
    });

    expect(
      revisedFirst.parameters.find((parameter) => parameter.id === 'width')
        ?.default,
    ).toBe(1550);
    expect(
      second.project.parameters.find((parameter) => parameter.id === 'width')
        ?.default,
    ).toBe(1200);
  });

  it('keeps an already materialized project unchanged when a newer template version is published', async () => {
    const v1Catalog = createBuiltinProductTemplateCatalog([template(1)]);
    const createdFromV1 = await materializeBuiltinProductTemplate(
      v1Catalog.requireExact({
        id: 'builtin:c1-acceptance-fixture',
        version: 1,
      }),
    );
    const before = JSON.stringify(createdFromV1.project);

    const laterCatalog = createBuiltinProductTemplateCatalog([
      template(1),
      {
        ...template(2),
        source: {
          kind: 'brep',
          source: withBrepProjectParameterValues(phaseOneCabinetProject, {
            width: 1700,
          }),
        },
      },
    ]);

    expect(laterCatalog.getLatest('builtin:c1-acceptance-fixture')?.version).toBe(
      2,
    );
    expect(JSON.stringify(createdFromV1.project)).toBe(before);
    expect(createdFromV1.projectOrigin.templateVersion).toBe(1);
  });

  it('proves presentation metadata is not geometry authority', async () => {
    const left = await materializeBuiltinProductTemplate(
      template(1, 'Dimensions'),
    );
    const right = await materializeBuiltinProductTemplate(
      template(1, 'Product size'),
    );

    expect(right.project).toEqual(left.project);
    expect(
      await digestCanonicalBrepProjectSource(right.project),
    ).toBe(await digestCanonicalBrepProjectSource(left.project));
  });

  it('keeps canonical BRep schema and scratch provenance semantics unchanged', async () => {
    const created = await materializeBuiltinProductTemplate(template(1));

    expect(created.project.schemaVersion).toBe(1);
    expect(parseProjectOrigin({ kind: 'scratch' })).toBe(
      SCRATCH_PROJECT_ORIGIN,
    );
  });

  it('fails closed before materialization for unsupported canonical BRep source', async () => {
    await expect(
      materializeBuiltinProductTemplate({
        ...template(1),
        source: {
          kind: 'brep',
          source: { ...phaseOneCabinetProject, schemaVersion: 2 },
        },
      }),
    ).rejects.toThrow(/invalid or unsupported/i);
  });
});
