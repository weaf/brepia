import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'vitest';

import {
  generateM3cRhinoAcceptanceFixtures,
  M3C_RHINO_PARAMETER_A,
  M3C_RHINO_PARAMETER_BASE_B,
  m3cRhinoFixtureFilename,
  validateM3cRhinoReturnedFixture,
} from '../scripts/brep/m3c-rhino-acceptance.ts';

const mode = process.env.M3C_RHINO_MODE ?? 'selftest';

describe('M3C Rhino acceptance tooling', () => {
  if (mode === 'selftest' || mode === 'generate') {
    it('generates validated current-compiler GHX fixtures', async () => {
      const temporaryDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'brepia-m3c-rhino-'),
      );
      const outputDirectory =
        mode === 'generate'
          ? path.resolve(
              process.env.M3C_RHINO_OUTPUT_DIR ??
                'tmp/m3c-rhino-acceptance',
            )
          : temporaryDirectory;

      try {
        const results = await generateM3cRhinoAcceptanceFixtures(outputDirectory);
        assert.deepEqual(
          results.map((entry) => ({
            kind: entry.kind,
            filename: entry.filename,
            expectedResultAccess: entry.expectedResultAccess,
          })),
          [
            {
              kind: 'final',
              filename: 'm3c-final-rectangular-pattern.ghx',
              expectedResultAccess: 'List',
            },
            {
              kind: 'cutters',
              filename: 'm3c-rectangular-pattern-cutters.ghx',
              expectedResultAccess: 'Item',
            },
          ],
        );

        for (const entry of results) {
          const filename = path.join(outputDirectory, entry.filename);
          const stat = await fs.stat(filename);
          assert.ok(stat.size > 0);
          assert.equal(entry.parameters[M3C_RHINO_PARAMETER_A], 20);
          assert.equal(entry.parameters[M3C_RHINO_PARAMETER_BASE_B], 25);

          if (mode === 'selftest') {
            const returned = await validateM3cRhinoReturnedFixture(
              entry.kind,
              filename,
              20,
              25,
            );
            assert.deepEqual(returned.parameters, entry.parameters);
          }
        }

        if (mode === 'generate') {
          console.log(JSON.stringify({ outputDirectory, fixtures: results }));
        }
      } finally {
        if (mode === 'selftest') {
          await fs.rm(temporaryDirectory, { recursive: true, force: true });
        }
      }
    });
  }

  if (mode === 'validate') {
    it('strictly validates both installed-host returned GHX files', async () => {
      const finalFile = process.env.M3C_RHINO_RETURNED_FINAL;
      const cuttersFile = process.env.M3C_RHINO_RETURNED_CUTTERS;
      assert.ok(finalFile, 'M3C_RHINO_RETURNED_FINAL is required.');
      assert.ok(cuttersFile, 'M3C_RHINO_RETURNED_CUTTERS is required.');

      const expectedPitchA = Number(process.env.M3C_RHINO_EXPECTED_PITCH_A);
      const expectedPitchBaseB = Number(
        process.env.M3C_RHINO_EXPECTED_PITCH_BASE_B,
      );
      assert.ok(Number.isFinite(expectedPitchA));
      assert.ok(Number.isFinite(expectedPitchBaseB));

      const finalResult = await validateM3cRhinoReturnedFixture(
        'final',
        finalFile,
        expectedPitchA,
        expectedPitchBaseB,
      );
      const cuttersResult = await validateM3cRhinoReturnedFixture(
        'cutters',
        cuttersFile,
        expectedPitchA,
        expectedPitchBaseB,
      );

      assert.equal(finalResult.expectedResultAccess, 'List');
      assert.equal(cuttersResult.expectedResultAccess, 'Item');
      assert.equal(finalResult.filename, path.basename(finalFile));
      assert.equal(cuttersResult.filename, path.basename(cuttersFile));
      assert.equal(m3cRhinoFixtureFilename('final').endsWith('.ghx'), true);
      assert.equal(m3cRhinoFixtureFilename('cutters').endsWith('.ghx'), true);

      console.log(
        JSON.stringify({
          returnedValidation: 'accepted',
          final: finalResult,
          cutters: cuttersResult,
        }),
      );
    });
  }
});
