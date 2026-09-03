import {
  createBundledHighlighter,
  createSingletonShorthands,
} from '@shikijs/core';
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

const { codeToHtml } = createSingletonShorthands(createHighlighter);

export function highlightOpenScadSource(source: string): Promise<string> {
  return codeToHtml(source || ' ', {
    lang: 'openscad',
    theme: 'github-dark',
  });
}
