import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONVERSATION_TITLE,
  MAX_CONVERSATION_TITLE_LENGTH,
  conversationTitleFromText,
  normalizeConversationTitle,
} from '../shared/conversationTitle';

describe('conversation titles', () => {
  it('creates a useful title from the first text request', () => {
    expect(
      conversationTitleFromText(
        'Skapa ett enkelt väggfäste för en kabel. Det ska vara 50 mm brett.',
      ),
    ).toBe('ett enkelt väggfäste för en kabel');
  });

  it('removes common image-reference boilerplate', () => {
    expect(
      conversationTitleFromText(
        'Använd den bifogade bilden som visuell referens och skapa en parametrisk J-krok med justerbara huvudmått.',
      ),
    ).toBe('en parametrisk J-krok med justerbara huvudmått');
  });

  it('uses attachment context when the prompt has no text', () => {
    expect(conversationTitleFromText('', { imageCount: 1 })).toBe(
      'CAD from image reference',
    );
    expect(conversationTitleFromText('', { meshCount: 1 })).toBe(
      'CAD model edit',
    );
    expect(conversationTitleFromText('', { imageCount: 1, meshCount: 1 })).toBe(
      'CAD from image and mesh references',
    );
    expect(conversationTitleFromText('')).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  it('normalizes model-generated titles and removes model chatter', () => {
    expect(
      normalizeConversationTitle(
        'Title: "Parametric cable wall mount"\nHere is another sentence.',
        'Create a cable wall mount',
      ),
    ).toBe('Parametric cable wall mount');
  });

  it('falls back when a model returns New Conversation', () => {
    expect(
      normalizeConversationTitle(
        'New Conversation',
        'Create a compact electronics enclosure with rounded corners',
      ),
    ).toBe('a compact electronics enclosure with rounded corners');
  });

  it('keeps titles below the storage/display contract', () => {
    const title = conversationTitleFromText(
      'Create a very detailed modular parametric enclosure with removable top cover ventilation slots cable glands mounting posts service access labels and many configurable dimensions for a complex electronics project',
    );
    expect(title.length).toBeLessThanOrEqual(MAX_CONVERSATION_TITLE_LENGTH);
    expect(title.endsWith(' ')).toBe(false);
  });
});
