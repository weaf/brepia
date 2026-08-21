/**
 * path-utils — normalizePath tests
 *
 * Covers:
 *   1. Absolute paths      → canonicalized, POSIX-formatted
 *   2. Relative paths      → resolved against cwd (default + custom)
 *   3. Tilde-paths (`~/`)  → expanded via os.homedir()
 *   4. Edge cases          → `~` alone, double slashes, `.` segments
 */

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'vitest';

import { normalizePath } from '../src/utils/path-utils';

// ------------------------------------------------------------------
// 1. Absolute paths
// ------------------------------------------------------------------

describe('absolute paths', () => {
  it('returns an absolute POSIX path unchanged (canonicalized)', () => {
    const input = '/tmp/foo/bar';
    const result = normalizePath(input);
    assert.strictEqual(result, '/tmp/foo/bar');
    assert(result.startsWith('/'), 'must be absolute');
  });

  it('collapses `..` in absolute paths', () => {
    const input = '/tmp/foo/../bar';
    const result = normalizePath(input);
    assert.strictEqual(result, '/tmp/bar');
  });

  it('collapses `.` segments in absolute paths', () => {
    const input = '/tmp/./foo/./bar';
    const result = normalizePath(input);
    assert.strictEqual(result, '/tmp/foo/bar');
  });

  it('uses custom cwd for relative paths', () => {
    const input = 'relative/file.txt';
    const customCwd = '/opt/app';
    const result = normalizePath(input, { cwd: customCwd });
    const expected = path.posix.join(customCwd, 'relative/file.txt');
    assert.strictEqual(result, expected);
  });

  it('converts backslashes to forward slashes on all platforms', () => {
    // Even though we're on Linux, test that the POSIX-ify step works
    const input = '/tmp\\foo\\bar';
    const result = normalizePath(input);
    assert(result.includes('/'), 'must use forward slashes');
    assert(!result.includes('\\'), 'must not contain backslashes');
  });
});

// ------------------------------------------------------------------
// 2. Relative paths
// ------------------------------------------------------------------

describe('relative paths', () => {
  it('resolves relative path against default cwd', () => {
    const input = './src/utils/foo.ts';
    const result = normalizePath(input);
    const expected = path.resolve(process.cwd(), 'src/utils/foo.ts');
    assert.strictEqual(result, expected);
  });

  it('handles parent-dir traversal', () => {
    const input = '../../other/file.txt';
    const result = normalizePath(input);
    // Just verify it resolves without error and is absolute
    assert(result.startsWith('/'), 'must be absolute');
  });
});

// ------------------------------------------------------------------
// 3. Tilde-paths (`~/`)
// ------------------------------------------------------------------

describe('tilde paths', () => {
  it('expands `~/` using os.homedir()', () => {
    const home = os.homedir();
    const input = '~/Documents/file.txt';
    const result = normalizePath(input);
    const expected = path.posix.join(home, 'Documents/file.txt');
    assert.strictEqual(result, expected);
  });

  it('expands bare `~` to home directory', () => {
    const home = os.homedir();
    const input = '~';
    const result = normalizePath(input);
    assert.strictEqual(result, home);
  });

  it('expands tilde path then canonicalizes', () => {
    const home = os.homedir();
    const input = '~/foo/../bar';
    const result = normalizePath(input);
    const expected = path.posix.join(home, 'bar');
    assert.strictEqual(result, expected);
  });
});

// ------------------------------------------------------------------
// 4. Edge cases
// ------------------------------------------------------------------

describe('edge cases', () => {
  it('collapses double slashes', () => {
    const input = '/tmp//foo///bar';
    const result = normalizePath(input);
    assert.strictEqual(result, '/tmp/foo/bar');
  });

  it('returns a string (not a Path object)', () => {
    const input = '/tmp/test';
    const result = normalizePath(input);
    assert(typeof result === 'string', 'must return a string');
  });
});
