import { describe, expect, it } from 'vitest';
import { BUILTIN_PRODUCT_TEMPLATES } from '@shared/productTemplateCatalog';
import { validateBuiltinProductTemplateStatic } from '@shared/productTemplateValidation';

describe('repository built-in product template validation gate', () => {
  it('statically validates every shipped exact template version', async () => {
    const results = await Promise.all(
      BUILTIN_PRODUCT_TEMPLATES.map((template) =>
        validateBuiltinProductTemplateStatic(template),
      ),
    );

    expect(
      results.map(({ template, definitionDigest }) => ({
        id: template.id,
        version: template.version,
        definitionDigest,
      })),
    ).toHaveLength(BUILTIN_PRODUCT_TEMPLATES.length);
  });
});
