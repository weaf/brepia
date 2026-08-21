import { createFileRoute } from '@tanstack/react-router';
import { handleAiChatRequest } from '@/server/aiChat';
import { withConversationWorkspaceLifecycle } from '@/server/conversationWorkspaceLifecycle';

const handleRequest = (request: Request) =>
  withConversationWorkspaceLifecycle(request, handleAiChatRequest);

export const Route = createFileRoute('/api/parametric-chat')({
  server: {
    handlers: {
      GET: ({ request }) => handleRequest(request),
      POST: ({ request }) => handleRequest(request),
      OPTIONS: ({ request }) => handleRequest(request),
    },
  },
});
