export const HOME_PROMPT_MESSAGES = [
  'Bring your idea to life with Brepia...',
  'Shape your idea with Brepia...',
  'Turn an idea into geometry with Brepia...',
  'Create something new with Brepia...',
  'What will you create with Brepia?',
] as const;

export type HomePromptMessage = (typeof HOME_PROMPT_MESSAGES)[number];

/**
 * Pick one piece of start-page prompt copy for the current visit.
 *
 * Keep this intentionally presentation-only: the selected text must never
 * affect the actual prompt, model, execution mode or conversation settings.
 */
export function pickHomePromptMessage(
  random: () => number = Math.random,
): HomePromptMessage {
  const index = Math.min(
    HOME_PROMPT_MESSAGES.length - 1,
    Math.floor(random() * HOME_PROMPT_MESSAGES.length),
  );
  return HOME_PROMPT_MESSAGES[index];
}
