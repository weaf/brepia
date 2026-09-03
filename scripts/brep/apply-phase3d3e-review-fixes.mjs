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
  'do not expose OpenSCAD-only mesh context to active BRep turns',
  `      convertDataPart: (part) => {\n        if (part.type === 'data-mesh-context') {\n`,
  `      convertDataPart: (part) => {\n        if (\n          activeBrepSource &&\n          (part.type === 'data-mesh-context' ||\n            part.type === 'data-mesh-preferences')\n        ) {\n          return undefined;\n        }\n        if (part.type === 'data-mesh-context') {\n`,
);

replaceOnce(
  'never update an immutable BRep assistant revision in place',
  `            if (persistAction === 'update') {\n              ({ error } = await supabaseClient\n                .from('messages')\n                .update(serializedMessage)\n                .eq('id', responseMessage.id)\n                .eq('conversation_id', conversation.id));\n            } else if (persistAction === 'insert') {\n`,
  `            if (persistAction === 'update') {\n              if (activeBrepSource) {\n                error = {\n                  message:\n                    'Native BRep AI attempted to update an immutable assistant revision in place.',\n                };\n              } else {\n                ({ error } = await supabaseClient\n                  .from('messages')\n                  .update(serializedMessage)\n                  .eq('id', responseMessage.id)\n                  .eq('conversation_id', conversation.id));\n              }\n            } else if (persistAction === 'insert') {\n`,
);

replaceOnce(
  'do not emit suggestions from a response that failed persistence',
  `            if (!hasPendingToolCall && anthropicAuxiliaryAvailable) {\n`,
  `            if (\n              !error &&\n              !hasPendingToolCall &&\n              anthropicAuxiliaryAvailable\n            ) {\n`,
);

fs.writeFileSync(path, source);
console.log(`Applied Phase 3D/3E review hardening to ${path}.`);
