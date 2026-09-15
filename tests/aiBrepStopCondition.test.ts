import { describe, expect, it } from 'vitest';
import { shouldStopAfterAcceptedBrepBuild } from '../src/server/aiBrepStopCondition';

describe('native BRep accepted-build stop condition', () => {
  it('does not stop when the completed build attempt was rejected', () => {
    const attempts = new Map([
      [0, [{ accepted: false }]],
    ]);

    expect(shouldStopAfterAcceptedBrepBuild(attempts, 1)).toBe(false);
  });

  it('stops immediately after the first canonical-accepted build', () => {
    const attempts = new Map([
      [0, [{ accepted: true }]],
    ]);

    expect(shouldStopAfterAcceptedBrepBuild(attempts, 1)).toBe(true);
  });

  it('evaluates only the just-completed step so earlier rejections do not interfere', () => {
    const attempts = new Map([
      [0, [{ accepted: false }]],
      [1, [{ accepted: true }]],
    ]);

    expect(shouldStopAfterAcceptedBrepBuild(attempts, 1)).toBe(false);
    expect(shouldStopAfterAcceptedBrepBuild(attempts, 2)).toBe(true);
  });

  it('does not stop without a completed step or recorded acceptance', () => {
    const attempts = new Map<number, Array<{ accepted: boolean }>>();

    expect(shouldStopAfterAcceptedBrepBuild(attempts, 0)).toBe(false);
    expect(shouldStopAfterAcceptedBrepBuild(attempts, 1)).toBe(false);
  });
});
