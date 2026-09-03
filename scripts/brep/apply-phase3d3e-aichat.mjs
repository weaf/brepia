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
  'BRep context import',
  "import { chatTools, type AppUIMessage, type AppTools } from '@shared/chatAi';\n",
  "import { chatTools, type AppUIMessage, type AppTools } from '@shared/chatAi';\nimport { resolveActiveBrepAiSource } from '@shared/brepAiContext';\n",
);

replaceOnce(
  'server BRep helper imports',
  "} from './chatToolPersistence';\n",
  "} from './chatToolPersistence';\nimport { brepParametricTools } from './brepAiTools';\nimport {\n  finalizeBrepAiAssistantParts,\n  parametricBuildToolName,\n  withBrepProjectSystemContext,\n} from './brepAiTurn';\nimport {\n  persistBrepAiRevisionAtomically,\n  type BrepAiRpcClient,\n} from './brepAiPersistence';\n",
);

replaceOnce(
  'drop generated text for either parametric build tool',
  "  const hasBuild = parts.some(\n    (part) => part.type === 'tool-build_parametric_model',\n  );\n",
  "  const hasBuild = parts.some(\n    (part) =>\n      part.type === 'tool-build_parametric_model' ||\n      part.type === 'tool-build_brep_project',\n  );\n",
);

replaceOnce(
  'BRep auxiliary instruction declarations',
  "  let buildToolDescription: string;\n  let answerToolDescription: string;\n",
  "  let buildToolDescription: string;\n  let brepBuildToolDescription: string;\n  let answerToolDescription: string;\n",
);

replaceOnce(
  'BRep context template declaration',
  "  let parametricAttachmentTemplate: string;\n  let creativeReferenceTemplate: string;\n",
  "  let parametricAttachmentTemplate: string;\n  let brepProjectContextTemplate: string;\n  let creativeReferenceTemplate: string;\n",
);

replaceOnce(
  'BRep auxiliary instruction destructuring',
  "      buildToolDescription,\n      answerToolDescription,\n      createMeshDescription,\n      parametricAttachmentTemplate,\n      creativeReferenceTemplate,\n",
  "      buildToolDescription,\n      brepBuildToolDescription,\n      answerToolDescription,\n      createMeshDescription,\n      parametricAttachmentTemplate,\n      brepProjectContextTemplate,\n      creativeReferenceTemplate,\n",
);

replaceOnce(
  'BRep auxiliary instruction loading',
  "      aiRuntime.instruction('tool.build_parametric_model'),\n      aiRuntime.instruction('tool.answer_user'),\n      aiRuntime.instruction('tool.create_mesh'),\n      aiRuntime.template('context.parametric_attachment'),\n      aiRuntime.template('context.creative_reference_mesh'),\n",
  "      aiRuntime.instruction('tool.build_parametric_model'),\n      aiRuntime.instruction('tool.build_brep_project'),\n      aiRuntime.instruction('tool.answer_user'),\n      aiRuntime.instruction('tool.create_mesh'),\n      aiRuntime.template('context.parametric_attachment'),\n      aiRuntime.template('context.brep_project'),\n      aiRuntime.template('context.creative_reference_mesh'),\n",
);

replaceOnce(
  'defer parametric tool routing until branch source is known',
  `  const tools =\n    conversation.type === 'creative'\n      ? creativeTools({\n          conversation,\n          req,\n          model: rawBody.model,\n          description: createMeshDescription,\n        })\n      : parametricTools({\n          supabaseClient,\n          buildDescription: buildToolDescription,\n          answerDescription: answerToolDescription,\n          inspectionOutputTemplate,\n          previewPathForToolCall: (toolCallId) =>\n            \`${'${user.id}/${conversation.id}/inspection-preview-${toolCallId}'}\`,\n        });\n\n`,
  '',
);

replaceOnce(
  'resolve active BRep source and source-aware tools',
  "  const leafMessageId = conversation.current_message_leaf_id;\n",
  `  let activeBrepSource;\n  if (conversation.type === 'parametric') {\n    try {\n      activeBrepSource = resolveActiveBrepAiSource(branchMessages);\n    } catch (error) {\n      logError(error, {\n        functionName: 'ai-chat',\n        statusCode: 400,\n        userId: user.id,\n        conversationId: conversation.id,\n        additionalContext: { operation: 'resolve_active_brep_source' },\n      });\n      return jsonResponse({ error: 'Active native BRep source is invalid' }, 400);\n    }\n  }\n\n  resolvedSystemPrompt = withBrepProjectSystemContext({\n    systemPrompt: resolvedSystemPrompt,\n    contextTemplate: brepProjectContextTemplate,\n    activeBrepSource,\n  });\n\n  const tools =\n    conversation.type === 'creative'\n      ? creativeTools({\n          conversation,\n          req,\n          model: rawBody.model,\n          description: createMeshDescription,\n        })\n      : activeBrepSource\n        ? brepParametricTools({\n            activeBrepSource,\n            buildDescription: brepBuildToolDescription,\n            answerDescription: answerToolDescription,\n          })\n        : parametricTools({\n            supabaseClient,\n            buildDescription: buildToolDescription,\n            answerDescription: answerToolDescription,\n            inspectionOutputTemplate,\n            previewPathForToolCall: (toolCallId) =>\n              \`${'${user.id}/${conversation.id}/inspection-preview-${toolCallId}'}\`,\n          });\n  const buildToolName = parametricBuildToolName(activeBrepSource);\n\n  const leafMessageId = conversation.current_message_leaf_id;\n`,
);

replaceOnce(
  'block BRep external-agent transports until 3F',
  `  if (conversation.type === 'creative' && transport.kind !== 'normal') {\n    return jsonResponse(\n      {\n        error:\n          'Creative mode currently requires a direct AI model; OpenCode/Codex agent adapters are parametric-only',\n      },\n      400,\n    );\n  }\n`,
  `  if (conversation.type === 'creative' && transport.kind !== 'normal') {\n    return jsonResponse(\n      {\n        error:\n          'Creative mode currently requires a direct AI model; OpenCode/Codex agent adapters are parametric-only',\n      },\n      400,\n    );\n  }\n  if (activeBrepSource && transport.kind !== 'normal') {\n    return jsonResponse(\n      {\n        error:\n          'Native BRep editing through OpenCode/Codex is not available until Phase 3F; choose a direct tool-capable model.',\n      },\n      400,\n    );\n  }\n`,
);

replaceOnce(
  'dynamic forced build tool activeTools',
  "          activeTools: ['build_parametric_model' as never],\n",
  "          activeTools: [buildToolName as never],\n",
);

replaceOnce(
  'dynamic forced build tool choice',
  "                  toolName: 'build_parametric_model' as never,\n",
  "                  toolName: buildToolName as never,\n",
);

replaceOnce(
  'BRep stop condition',
  "    stopWhen: streamingOpenCode\n      ? hasToolCall('build_parametric_model')\n      : stepCountIs(maxSteps),\n",
  "    stopWhen: streamingOpenCode\n      ? hasToolCall('build_parametric_model')\n      : activeBrepSource\n        ? [hasToolCall('answer_user'), stepCountIs(maxSteps)]\n        : stepCountIs(maxSteps),\n",
);

replaceOnce(
  'dynamic fallback build call check',
  "          (call) => call.toolName === 'build_parametric_model',\n",
  "          (call) => call.toolName === buildToolName,\n",
);

replaceOnce(
  'dynamic fallback build error',
  "            'Parametric turn finished without calling build_parametric_model under auto tool-choice fallback',\n",
  "            `Parametric turn finished without calling ${buildToolName} under auto tool-choice fallback`,\n",
);

replaceOnce(
  'BRep response finalization',
  `            const finalizedParts =\n              conversation.type === 'parametric'\n                ? dropTextFromParametricBuildMessage(\n                    finalizeStreamingParts(responseMessage.parts),\n                  )\n                : finalizeStreamingParts(responseMessage.parts);\n\n            const serializedMessage = {\n`,
  `            const baseFinalizedParts =\n              conversation.type === 'parametric'\n                ? dropTextFromParametricBuildMessage(\n                    finalizeStreamingParts(responseMessage.parts),\n                  )\n                : finalizeStreamingParts(responseMessage.parts);\n            const brepFinalized = finalizeBrepAiAssistantParts({\n              parts: baseFinalizedParts,\n              activeBrepSource,\n            });\n            const finalizedParts = brepFinalized.parts;\n\n            const serializedMessage = {\n`,
);

replaceOnce(
  'atomic BRep insert persistence',
  `            } else if (persistAction === 'insert') {\n              ({ error } = await supabaseClient.from('messages').insert({\n                id: responseMessage.id,\n                conversation_id: conversation.id,\n                role: responseMessage.role,\n                ...serializedMessage,\n                parent_message_id: leafMessageId,\n              }));\n            } else {\n`,
  `            } else if (persistAction === 'insert') {\n              if (activeBrepSource) {\n                try {\n                  await persistBrepAiRevisionAtomically({\n                    client: supabaseClient as unknown as BrepAiRpcClient,\n                    conversationId: conversation.id,\n                    expectedLeafId: leafMessageId,\n                    messageId: responseMessage.id,\n                    parts: serializedMessage.parts,\n                    metadata: serializedMessage.metadata,\n                  });\n                } catch (persistError) {\n                  error = {\n                    message:\n                      persistError instanceof Error\n                        ? persistError.message\n                        : 'BRep AI revision persistence failed',\n                  };\n                }\n              } else {\n                ({ error } = await supabaseClient.from('messages').insert({\n                  id: responseMessage.id,\n                  conversation_id: conversation.id,\n                  role: responseMessage.role,\n                  ...serializedMessage,\n                  parent_message_id: leafMessageId,\n                }));\n              }\n            } else {\n`,
);

fs.writeFileSync(path, source);
console.log(`Patched ${path} for Phase 3D/3E normal-provider BRep routing.`);
