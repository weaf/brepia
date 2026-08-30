import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeFiles = [
  'src/lib/defaultModels.ts',
  'src/server/imageGen.ts',
  'src/server/falMesh.ts',
  'src/server/nativeCreativeMesh.ts',
];

const historicalModelIds = [
  'openai/gpt-5.6-sol',
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
});
