import { createFileRoute } from '@tanstack/react-router';
import {
  conversationTitleFromText,
  normalizeConversationTitle,
} from '@shared/conversationTitle';
import { createAnthropicText } from '@/server/anthropic';
import {
  isRecord,
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { env } from '@/server/env';

const TITLE_SYSTEM_PROMPT =
  'Generate a concise, descriptive title under 80 characters for this CAD conversation. Return only the title. If unclear, return "New Conversation".';

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';

  return parts
    .flatMap((part) =>
      isRecord(part) && part.type === 'text' && typeof part.text === 'string'
        ? [part.text]
        : [],
    )
    .join('\n')
    .trim();
}

function nonNegativeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export const Route = createFileRoute('/api/title-generator')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        try {
          await requireUser(request);
        } catch (err) {
          if (isUnauthorizedError(err)) {
            return json({ error: 'Unauthorized' }, 401);
          }
          throw err;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          body = null;
        }

        if (!isRecord(body)) {
          return json({ title: conversationTitleFromText('') });
        }

        const trimmedText =
          typeof body.text === 'string' ? body.text.trim() : '';
        const text = trimmedText || textFromParts(body.parts);
        const context = {
          imageCount: nonNegativeCount(body.imageCount),
          meshCount: nonNegativeCount(body.meshCount),
        };
        const fallbackTitle = conversationTitleFromText(text, context);

        // Local/dev installs commonly have no Anthropic credential. Naming a
        // conversation must never depend on an external provider, so return the
        // deterministic title immediately in that case.
        if (!text || !env('ANTHROPIC_API_KEY')) {
          return json({ title: fallbackTitle });
        }

        try {
          const generated = await createAnthropicText({
            model: 'claude-haiku-4-5-20251001',
            maxTokens: 100,
            system: TITLE_SYSTEM_PROMPT,
            content: text,
          });
          return json({
            title: normalizeConversationTitle(generated, text, context),
          });
        } catch {
          return json({ title: fallbackTitle });
        }
      },
    },
  },
});
