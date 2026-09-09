import { describe, expect, it, vi } from 'vitest';
import {
  brepAiBuildProviderInputSchema,
} from '../shared/brepAiTool';
import { chatTools } from '../shared/chatAi';

describe('BRep AI provider JSON Schema', () => {
  it('keeps recursive M1 scalar operands as JSON Schema references instead of any', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const jsonSchema = await Promise.resolve(
        brepAiBuildProviderInputSchema.jsonSchema,
      );
      const serialized = JSON.stringify(jsonSchema);

      expect(serialized).toContain('"$ref"');
      expect(
        warn.mock.calls.some(([message]) =>
          String(message).includes('Recursive reference detected'),
        ),
      ).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('uses the recursive-safe provider schema on the actual build_brep_project tool', () => {
    expect(chatTools.build_brep_project.inputSchema).toBe(
      brepAiBuildProviderInputSchema,
    );
  });
});
