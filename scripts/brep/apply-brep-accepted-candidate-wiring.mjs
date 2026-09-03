import fs from 'node:fs';

const path = 'src/server/aiChat.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch anchor not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'BRep build input type import',
  `import {\n  resolveActiveBrepAiSource,\n  type BrepAiSourceRevision,\n} from '@shared/brepAiContext';\n`,
  `import {\n  resolveActiveBrepAiSource,\n  type BrepAiSourceRevision,\n} from '@shared/brepAiContext';\nimport type { BrepAiBuildInput } from '@shared/brepAiTool';\n`,
);

replaceOnce(
  'request-local accepted BRep candidate state',
  `  const tools =\n    conversation.type === 'creative'\n`,
  `  let acceptedBrepBuildInput: BrepAiBuildInput | undefined;\n\n  const tools =\n    conversation.type === 'creative'\n`,
);

replaceOnce(
  'capture accepted BRep candidate from server tool execution',
  `        ? brepParametricTools({\n            activeBrepSource,\n            buildDescription: brepBuildToolDescription,\n            answerDescription: answerToolDescription,\n          })\n`,
  `        ? brepParametricTools({\n            activeBrepSource,\n            buildDescription: brepBuildToolDescription,\n            answerDescription: answerToolDescription,\n            onAcceptedBuild: (input) => {\n              acceptedBrepBuildInput = input;\n            },\n          })\n`,
);

replaceOnce(
  'finalize from request-local accepted BRep candidate',
  `            const brepFinalized = finalizeBrepAiAssistantParts({\n              parts: baseFinalizedParts,\n              activeBrepSource,\n            });\n`,
  `            const brepFinalized = finalizeBrepAiAssistantParts({\n              parts: baseFinalizedParts,\n              activeBrepSource,\n              acceptedBuildInput: acceptedBrepBuildInput,\n            });\n`,
);

fs.writeFileSync(path, source);
console.log(`Wired request-local accepted BRep candidate persistence in ${path}.`);
