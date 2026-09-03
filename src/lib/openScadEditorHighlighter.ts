import { createBundledHighlighter } from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import {
  bundledLanguages,
  bundledThemes,
} from '@/generated/shikiBundles';

const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: bundledThemes,
  engine: () => createJavaScriptRegexEngine({ forgiving: true }),
});

const highlighterPromise = createHighlighter({
  langs: ['openscad'],
  themes: ['github-dark'],
});

export async function highlightOpenScadSource(source: string): Promise<string> {
  const highlighter = await highlighterPromise;
  return highlighter.codeToHtml(source || ' ', {
    lang: 'openscad',
    theme: 'github-dark',
  });
}
