import { describe, expect, it } from 'vitest';
import { recoverOpenScadAutoPairAfterInput } from './openScadEditorInput';

describe('recoverOpenScadAutoPairAfterInput', () => {
  it('recovers a mobile-style opening parenthesis insertion', () => {
    expect(
      recoverOpenScadAutoPairAfterInput({
        source: 'cube',
        nextValue: 'cube(',
        selectionStart: 5,
        selectionEnd: 5,
      }),
    ).toEqual({
      value: 'cube()',
      selectionStart: 5,
      selectionEnd: 5,
    });
  });

  it('recovers include/use angle bracket insertion but leaves comparisons alone', () => {
    expect(
      recoverOpenScadAutoPairAfterInput({
        source: 'include ',
        nextValue: 'include <',
        selectionStart: 9,
        selectionEnd: 9,
      }),
    ).toEqual({
      value: 'include <>',
      selectionStart: 9,
      selectionEnd: 9,
    });

    expect(
      recoverOpenScadAutoPairAfterInput({
        source: 'a ',
        nextValue: 'a <',
        selectionStart: 3,
        selectionEnd: 3,
      }),
    ).toBeNull();
  });

  it('steps over an existing closer when a mobile keyboard inserted a duplicate', () => {
    expect(
      recoverOpenScadAutoPairAfterInput({
        source: 'cube()',
        nextValue: 'cube())',
        selectionStart: 6,
        selectionEnd: 6,
      }),
    ).toEqual({
      value: 'cube()',
      selectionStart: 6,
      selectionEnd: 6,
    });
  });

  it('ignores multi-character edits so autocorrect/paste remain untouched', () => {
    expect(
      recoverOpenScadAutoPairAfterInput({
        source: 'cub',
        nextValue: 'cube',
        selectionStart: 4,
        selectionEnd: 4,
      }),
    ).toBeNull();

    expect(
      recoverOpenScadAutoPairAfterInput({
        source: '',
        nextValue: '()',
        selectionStart: 2,
        selectionEnd: 2,
      }),
    ).toBeNull();
  });
});
