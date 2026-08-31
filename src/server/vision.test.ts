import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import {
  VISION_NOT_CONFIGURED_MESSAGE,
  modelSupportsDirectVision,
  rewritePromptForVisionFallback,
  selectVisionModelId,
  withVisionFallback,
  type VisionAnalysisRequest,
  type VisionAnalyzer,
} from './vision.ts';

describe('pCAD vision routing', () => {
  it('selects Fast for references and Deep for inspection with Fast fallback', () => {
    const preferences = {
      visionFastModelId: 'custom/provider/fast-vl',
      visionDeepModelId: 'custom/provider/deep-vl',
    };
    assert.equal(
      selectVisionModelId('reference', preferences),
      'custom/provider/fast-vl',
    );
    assert.equal(
      selectVisionModelId('inspection', preferences),
      'custom/provider/deep-vl',
    );
    assert.equal(
      selectVisionModelId('inspection', {
        ...preferences,
        visionDeepModelId: null,
      }),
      'custom/provider/fast-vl',
    );
    assert.equal(
      selectVisionModelId('reference', {
        visionFastModelId: null,
        visionDeepModelId: null,
      }),
      undefined,
    );
  });

  it('preserves direct images for native multimodal models', () => {
    assert.equal(
      modelSupportsDirectVision('google/gemini-3.6-flash', 'normal'),
      true,
    );
    assert.equal(
      modelSupportsDirectVision('local/qwen3.6-35b-mtp-128k', 'normal'),
      false,
    );
    assert.equal(
      modelSupportsDirectVision('custom/provider/model', 'normal', true),
      true,
    );
    assert.equal(
      modelSupportsDirectVision('custom/provider/model', 'normal', false),
      false,
    );
    assert.equal(
      modelSupportsDirectVision('agent/codex/default', 'cli-agent'),
      false,
    );
    assert.equal(
      modelSupportsDirectVision(
        'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
        'streaming-opencode',
      ),
      false,
    );
  });

  it('preserves supportedUrls when the provider exposes it through a getter', () => {
    const supportedUrls = { 'image/*': [/^data:/] };
    const prototype = {
      get supportedUrls() {
        return supportedUrls;
      },
    };
    const baseModel = Object.assign(Object.create(prototype), {
      specificationVersion: 'v3',
      provider: 'test-provider',
      modelId: 'text-only-test-model',
      async doGenerate() {
        throw new Error('not called');
      },
      async doStream() {
        throw new Error('not called');
      },
    }) as unknown as Parameters<typeof withVisionFallback>[0];

    const wrapped = withVisionFallback(baseModel, 'test-user');
    const wrappedModel = wrapped as unknown as {
      provider: string;
      modelId: string;
      supportedUrls?: unknown;
    };

    assert.equal(wrappedModel.provider, 'test-provider');
    assert.equal(wrappedModel.modelId, 'text-only-test-model');
    assert.equal(wrappedModel.supportedUrls, supportedUrls);
  });

  it('replaces user images with one fast vision observation for text-only models', async () => {
    const calls: VisionAnalysisRequest[] = [];
    const analyzer: VisionAnalyzer = async (request) => {
      calls.push(request);
      return 'A rectangular enclosure with rounded exterior corners.';
    };
    const prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Make this shape.' },
          {
            type: 'file',
            filename: 'reference.png',
            mediaType: 'image/png',
            data: 'AAAA',
          },
          {
            type: 'file',
            filename: 'reference-2.png',
            mediaType: 'image/png',
            data: 'BBBB',
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const rewritten = await rewritePromptForVisionFallback(prompt, {
      analyzer,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'reference');
    assert.equal(calls[0].images.length, 2);
    assert.equal(calls[0].userRequest, 'Make this shape.');

    const user = rewritten[0];
    assert.equal(user.role, 'user');
    if (user.role !== 'user') return;
    assert.equal(
      user.content.some((part) => part.type === 'file'),
      false,
    );
    assert.match(
      user.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n'),
      /rounded exterior corners/,
    );
  });

  it('propagates missing Vision configuration instead of silently removing the image', async () => {
    const analyzer: VisionAnalyzer = async () => {
      throw new Error(VISION_NOT_CONFIGURED_MESSAGE);
    };
    const prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Use this reference.' },
          {
            type: 'file',
            filename: 'reference.png',
            mediaType: 'image/png',
            data: 'AAAA',
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    await assert.rejects(
      rewritePromptForVisionFallback(prompt, { analyzer }),
      new RegExp(
        VISION_NOT_CONFIGURED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ),
    );
  });

  it('replaces rendered tool images with deep inspection observations', async () => {
    const calls: VisionAnalysisRequest[] = [];
    const analyzer: VisionAnalyzer = async (request) => {
      calls.push(request);
      return 'The requested front opening is missing from the render.';
    };
    const prompt = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Make a case with a front opening.' }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'build-1',
            toolName: 'build_parametric_model',
            output: {
              type: 'content',
              value: [
                { type: 'text', text: 'OpenSCAD compiled successfully.' },
                { type: 'image-data', data: 'CCCC', mediaType: 'image/png' },
              ],
            },
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const rewritten = await rewritePromptForVisionFallback(prompt, {
      analyzer,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'inspection');
    assert.equal(calls[0].userRequest, 'Make a case with a front opening.');

    const tool = rewritten[1];
    assert.equal(tool.role, 'tool');
    if (tool.role !== 'tool') return;
    const result = tool.content[0];
    assert.equal(result.type, 'tool-result');
    if (result.type !== 'tool-result' || result.output.type !== 'content') {
      return;
    }
    assert.equal(
      result.output.value.some((part) => part.type === 'image-data'),
      false,
    );
    assert.match(
      result.output.value
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n'),
      /front opening is missing/,
    );
  });
});
