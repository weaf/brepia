import { tool } from '@opencode-ai/plugin';
import { validateOpenScad } from '../../src/server/openScadValidation.ts';

export default async function pcadValidationPlugin() {
  return {
    tool: {
      pcad_validate: tool({
        description:
          'Compile a complete OpenSCAD source for Brepia. Returns structured compiler diagnostics; call it before returning final code.',
        args: {
          code: tool.schema.string().min(1).max(256_000),
        },
        async execute({ code }, context) {
          return JSON.stringify(await validateOpenScad(code, context.abort));
        },
      }),
    },
  };
}
