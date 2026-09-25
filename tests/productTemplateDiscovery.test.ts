import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { createBuiltinProductTemplateCatalog } from '@shared/productTemplateCatalog';
import { listBuiltinProductTemplateDiscovery } from '@shared/productTemplateDiscovery';

function fixture(version: number, name: string) {
  return {
    id: 'builtin:discovery-fixture',
    version,
    name,
    category: 'Electrical',
    description: 'Reusable enclosure foundation.',
    source: {
      kind: 'brep',
      source: phaseOneCabinetProject,
    },
    presentation: {
      parameterOrder: ['width', 'height'],
      parameters: {
        width: {
          label: 'Cabinet width',
          unitLabel: 'mm',
          tier: 'basic',
        },
        height: {
          label: 'Cabinet height',
          visibility: 'hidden',
        },
      },
      preview: {
        kind: 'bundled',
        assetId: 'templates/discovery-fixture.webp',
      },
    },
  } as const;
}

describe('Phase C3 built-in template discovery', () => {
  it('lists only the latest immutable version of each template family', () => {
    const catalog = createBuiltinProductTemplateCatalog([
      fixture(1, 'Old fixture'),
      fixture(2, 'Current fixture'),
    ]);

    expect(listBuiltinProductTemplateDiscovery(catalog)).toEqual([
      {
        templateId: 'builtin:discovery-fixture',
        templateVersion: 2,
        name: 'Current fixture',
        category: 'Electrical',
        description: 'Reusable enclosure foundation.',
        previewAssetId: 'templates/discovery-fixture.webp',
        importantParameters: [
          {
            id: 'width',
            label: 'Cabinet width',
            unit: 'mm',
            unitLabel: 'mm',
          },
        ],
      },
    ]);
  });

  it('derives important parameters from C2 visibility/tier semantics', () => {
    const catalog = createBuiltinProductTemplateCatalog([
      {
        ...fixture(1, 'Fixture'),
        presentation: {
          parameterOrder: ['height', 'width'],
          parameters: {
            height: { label: 'Overall height', tier: 'advanced' },
            width: { label: 'Overall width', tier: 'basic' },
          },
        },
      },
    ]);

    const [item] = listBuiltinProductTemplateDiscovery(catalog);

    expect(item.importantParameters.map((parameter) => parameter.id)).toEqual([
      'width',
      'height',
    ]);
  });

  it('returns an immutable empty discovery list for the shipped empty catalog shape', () => {
    const catalog = createBuiltinProductTemplateCatalog([]);
    const discovery = listBuiltinProductTemplateDiscovery(catalog);

    expect(discovery).toEqual([]);
    expect(Object.isFrozen(discovery)).toBe(true);
  });
});
