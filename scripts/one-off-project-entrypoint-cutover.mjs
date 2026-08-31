import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, replacements) {
  let source = await readFile(path, 'utf8');
  for (const [before, after, label, expectedCount = 1] of replacements) {
    const occurrences = source.split(before).length - 1;
    if (occurrences !== expectedCount) {
      throw new Error(
        `${path}: expected ${expectedCount} ${label}, found ${occurrences}`,
      );
    }
    source = source.split(before).join(after);
  }
  await writeFile(path, source, 'utf8');
}

await patchFile('src/components/chat/ChatSession.tsx', [
  [
    "import { isParametricArtifact } from '@shared/parametricParts';",
    "import {\n  getParametricArtifactEntrypointCode,\n  isParametricArtifact,\n} from '@shared/parametricParts';",
    'parametricParts import',
  ],
  [
    '        const { stl, off } = await previewScadColoredViaToolWorker(input.code);',
    '        const code = getParametricArtifactEntrypointCode(input);\n        const { stl, off } = await previewScadColoredViaToolWorker(code);',
    'tool preview compile',
  ],
  [
    "        ? `artifact:${preview.messageId}:${preview.artifact.code.length}`",
    "        ? `artifact:${preview.messageId}:${getParametricArtifactEntrypointCode(preview.artifact).length}`",
    'auto preview key',
  ],
]);

await patchFile('src/components/chat/MessageBubble.tsx', [
  [
    "import {\n  cleanAssistantText,\n  isParametricArtifact,\n} from '@shared/parametricParts';",
    "import {\n  cleanAssistantText,\n  getParametricArtifactEntrypointCode,\n  isParametricArtifact,\n} from '@shared/parametricParts';",
    'parametricParts import',
  ],
  [
    "function getStringField(value: unknown, key: string): string | undefined {\n  if (!isRecord(value)) return undefined;\n  const field = value[key];\n  return typeof field === 'string' ? field : undefined;\n}\n",
    "function getStringField(value: unknown, key: string): string | undefined {\n  if (!isRecord(value)) return undefined;\n  const field = value[key];\n  return typeof field === 'string' ? field : undefined;\n}\n\nfunction getStreamingParametricEntrypointCode(value: unknown): string {\n  if (!isRecord(value) || !isRecord(value.project)) return '';\n  const entrypointPath = value.project.entrypointPath;\n  const files = value.project.files;\n  if (typeof entrypointPath !== 'string' || !Array.isArray(files)) return '';\n  for (const file of files) {\n    if (!isRecord(file)) continue;\n    if (file.path === entrypointPath && typeof file.content === 'string') {\n      return file.content;\n    }\n  }\n  return '';\n}\n",
    'streaming project helper insertion',
  ],
  [
    "            const partialCode =\n              part.state === 'input-streaming'\n                ? (getStringField(part.input, 'code') ?? '')\n                : '';",
    "            const partialCode =\n              part.state === 'input-streaming'\n                ? getStreamingParametricEntrypointCode(part.input)\n                : '';\n            const artifactCode = artifact\n              ? getParametricArtifactEntrypointCode(artifact)\n              : '';",
    'partial and completed artifact code derivation',
  ],
  [
    '                        code={artifact.code}',
    '                        code={artifactCode}',
    'thumbnail entrypoint code',
  ],
  [
    '                {artifact?.code ? (',
    '                {artifactCode ? (',
    'expanded code guard',
  ],
  [
    '                      <code>{artifact.code}</code>',
    '                      <code>{artifactCode}</code>',
    'expanded entrypoint code',
  ],
]);

await patchFile('src/views/EditorView.tsx', [
  [
    "import {\n  isParametricArtifact,\n  replaceBuildParametricModelOutput,\n} from '@shared/parametricParts';",
    "import {\n  getParametricArtifactEntrypointCode,\n  isParametricArtifact,\n  replaceBuildParametricModelOutput,\n  replaceParametricArtifactEntrypointCode,\n} from '@shared/parametricParts';",
    'parametricParts import',
  ],
  [
    "    (artifact: ParametricArtifact, messageId: string) => {\n      baseCodeRef.current = artifact.code;",
    "    (artifact: ParametricArtifact, messageId: string) => {\n      const code = getParametricArtifactEntrypointCode(artifact);\n      baseCodeRef.current = code;",
    'view artifact entrypoint extraction',
  ],
  [
    '      setParameters(mergeParameterDefaults(artifact.code, originalCode));',
    '      setParameters(mergeParameterDefaults(code, originalCode));',
    'parameter parsing entrypoint code',
  ],
  [
    "      const updatedArtifact: ParametricArtifact = {\n        ...activePreview.artifact,\n        code: nextCode,\n      };",
    "      const updatedArtifact = replaceParametricArtifactEntrypointCode(\n        activePreview.artifact,\n        nextCode,\n      );",
    'parameter edit project replacement',
  ],
  [
    "  const hasArtifact =\n    activePreview?.type === 'artifact' && parameters.length > 0;",
    "  const hasArtifact =\n    activePreview?.type === 'artifact' && parameters.length > 0;\n  const activeArtifactCode =\n    activePreview?.type === 'artifact'\n      ? getParametricArtifactEntrypointCode(activePreview.artifact)\n      : undefined;\n  const shareArtifactCode =\n    sharePreview?.type === 'artifact'\n      ? getParametricArtifactEntrypointCode(sharePreview.artifact)\n      : undefined;",
    'derived render entrypoint code',
  ],
  [
    "                  activeOpenscadCode={\n                    sharePreview?.type === 'artifact'\n                      ? sharePreview.artifact.code\n                      : undefined\n                  }",
    '                  activeOpenscadCode={shareArtifactCode}',
    'chat title entrypoint code',
  ],
  [
    "                    openscadCode={\n                      sharePreview?.type === 'artifact'\n                        ? sharePreview.artifact.code\n                        : undefined\n                    }",
    '                    openscadCode={shareArtifactCode}',
    'share popover entrypoint code',
  ],
  [
    '              scadCode={activePreview.artifact.code}',
    '              scadCode={activeArtifactCode ?? \'\'}',
    'preview entrypoint code',
    2,
  ],
  [
    "            code={\n              activePreview?.type === 'artifact'\n                ? activePreview.artifact.code\n                : undefined\n            }",
    '            code={activeArtifactCode}',
    'desktop parameter entrypoint code',
  ],
  [
    "          code={\n            activePreview?.type === 'artifact'\n              ? activePreview.artifact.code\n              : undefined\n          }",
    '          code={activeArtifactCode}',
    'mobile parameter entrypoint code',
  ],
]);

console.log(
  'Applied project-native entrypoint cutover to ChatSession, MessageBubble, and EditorView.',
);
