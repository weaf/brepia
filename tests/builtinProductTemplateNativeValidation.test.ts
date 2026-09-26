import { describe, expect, it } from 'vitest';
import { BUILTIN_PRODUCT_TEMPLATES } from '@shared/productTemplateCatalog';
import { validateBuiltinProductTemplateNative } from '@/server/productTemplateValidation';

describe('repository built-in product template native validation gate', () => {
  it('validates every shipped exact template version through the authoritative native evaluator', async () => {
    const results = [];
    for (const template of BUILTIN_PRODUCT_TEMPLATES) {
      results.push(await validateBuiltinProductTemplateNative(template));
    }

    expect(
      results.map(({ staticValidation, evaluation, stepBytes }) => ({
        id: staticValidation.template.id,
        version: staticValidation.template.version,
        resultKind: evaluation.resultKind,
        exactStep: evaluation.exactExport.available,
        stepBytes: stepBytes.byteLength,
      })),
    ).toHaveLength(BUILTIN_PRODUCT_TEMPLATES.length);
  });
});
