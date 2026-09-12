import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeFiles = [
  'shared/models.ts',
  'src/lib/defaultModels.ts',
  'src/lib/utilsCore.ts',
  'src/views/PromptView.tsx',
  'src/views/EditorView.tsx',
  'src/views/BrepProjectView.tsx',
  'src/services/brepProjectService.ts',
  'src/server/modelCatalog.ts',
  'src/server/aiChat.ts',
  'src/server/imageGen.ts',
  'src/server/falMesh.ts',
  'src/server/nativeCreativeMesh.ts',
  'src/server/creativeRuntimeModels.ts',
];

const historicalModelIds = [
  'openai/gpt-5.6-sol',
  'openai/gpt-5.5',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.7-flash',
  'google/gemini-3.6-flash',
  'anthropic/claude-fable-5',
  'anthropic/claude-opus-4.8',
  'anthropic/claude-sonnet-5',
  'claude-haiku-4-5',
  'x-ai/grok-4.6',
  'moonshotai/kimi-k3',
  'z-ai/glm-5.2',
  'gpt-5.4',
  'gpt-image-2',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro/kontext/max/multi',
  'creative/z-image-turbo',
  'creative/trellis2',
  'fal-ai/meshy/v6-preview/image-to-3d',
  'fal-ai/moondream3-preview/caption',
  'fal-ai/sam-3/image',
  'fal-ai/sam-3/3d-objects',
  'tripo3d/tripo/v2.5/image-to-3d',
  'fal-ai/hunyuan3d/v2/mini/turbo',
];

describe('runtime model routing', () => {
  it('keeps historical provider model IDs out of runtime source files', () => {
    for (const relativePath of runtimeFiles) {
      const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
      for (const modelId of historicalModelIds) {
        expect(source, `${relativePath} contains ${modelId}`).not.toContain(
          modelId,
        );
      }
    }
  });

  it('does not retain a hidden hosted-provider fallback in chat routing', () => {
    const source = fs.readFileSync(
      path.resolve('src/server/aiChat.ts'),
      'utf8',
    );

    expect(source).not.toContain("return 'openrouter'");
    expect(source).not.toContain('createOpenRouter');
    expect(source).not.toContain('createAnthropic');
    expect(source).not.toContain('createGoogleGenerativeAI');
    expect(source).toContain("return 'unsupported'");
  });
});
