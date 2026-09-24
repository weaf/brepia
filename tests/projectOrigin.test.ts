import { describe, expect, it } from 'vitest';
import {
  SCRATCH_PROJECT_ORIGIN,
  getProjectCreationFromMessageMetadata,
  getProjectOriginFromConversationSettings,
  parseProjectOrigin,
} from '@shared/projectOrigin';

const templateOrigin = {
  kind: 'template' as const,
  catalog: 'builtin' as const,
  templateId: 'builtin:historical-fixture',
  templateVersion: 7,
  sourceDigest:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};

describe('project provenance read path', () => {
  it('parses scratch and built-in template provenance without catalog dereference', () => {
    expect(parseProjectOrigin({ kind: 'scratch' })).toBe(
      SCRATCH_PROJECT_ORIGIN,
    );
    expect(parseProjectOrigin(templateOrigin)).toEqual(templateOrigin);
  });

  it('reads project and baseline provenance from their persisted containers', () => {
    expect(
      getProjectOriginFromConversationSettings({
        parametricSourceKind: 'brep',
        projectOrigin: templateOrigin,
      }),
    ).toEqual(templateOrigin);
    expect(
      getProjectCreationFromMessageMetadata({
        actualModel: 'example-model',
        projectCreation: templateOrigin,
      }),
    ).toEqual(templateOrigin);
  });

  it('fails safely for missing or malformed historical provenance', () => {
    const malformed = [
      null,
      [],
      {},
      { kind: 'template' },
      { ...templateOrigin, catalog: 'database' },
      { ...templateOrigin, templateId: 'Historical Fixture' },
      { ...templateOrigin, templateVersion: 0 },
      { ...templateOrigin, sourceDigest: 'not-a-digest' },
    ];

    for (const value of malformed) {
      expect(parseProjectOrigin(value)).toBeUndefined();
    }

    expect(getProjectOriginFromConversationSettings(null)).toBeUndefined();
    expect(getProjectOriginFromConversationSettings({})).toBeUndefined();
    expect(getProjectCreationFromMessageMetadata('legacy')).toBeUndefined();
    expect(getProjectCreationFromMessageMetadata({})).toBeUndefined();
  });

  it('drops unknown fields instead of promoting them into provenance authority', () => {
    expect(
      parseProjectOrigin({
        ...templateOrigin,
        source: { nodes: ['must-not-be-read'] },
        latestTemplateVersion: 99,
      }),
    ).toEqual(templateOrigin);
  });
});
