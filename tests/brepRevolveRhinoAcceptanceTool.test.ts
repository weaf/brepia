import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'vitest';

import {
  generateRevolveRhinoAcceptanceFixtures,
  REVOLVE_RHINO_ACCEPTED_LENGTH,
  REVOLVE_RHINO_ACCEPTED_OUTER_RADIUS,
  REVOLVE_RHINO_DEFAULT_LENGTH,
  REVOLVE_RHINO_DEFAULT_OUTER_RADIUS,
  REVOLVE_RHINO_PARAMETER_LENGTH,
  REVOLVE_RHINO_PARAMETER_OUTER_RADIUS,
  revolveRhinoFixtureFilename,
  validateRevolveRhinoReturnedFixture,
} from '../scripts/brep/revolve-rhino-acceptance.ts';

const mode = process.env.REVOLVE_RHINO_MODE ?? 'selftest';

function expectedParameter(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const value = Number(raw);
  assert.ok(Number.isFinite(value), `${name} must be a finite number.`);
  return value;
}

describe('bounded revolve Rhino acceptance tooling', () => {
  if (mode === 'selftest' || mode === 'generate') {
    it('generates validated current-compiler Item-access revolve GHX fixtures', async () => {
      const temporaryDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'brepia-revolve-rhino-'),
      );
      const outputDirectory =
        mode === 'generate'
          ? path.resolve(
              process.env.REVOLVE_RHINO_OUTPUT_DIR ??
                'tmp/revolve-rhino-acceptance',
            )
          : temporaryDirectory;

      try {
        const results = await generateRevolveRhinoAcceptanceFixtures(outputDirectory);
        assert.deepEqual(
          results.map((entry) => ({
            kind: entry.kind,
            filename: entry.filename,
            expectedResultAccess: entry.expectedResultAccess,
          })),
          [
            {
              kind: 'parameterized',
              filename: 'revolve-parameterized-z.ghx',
              expectedResultAccess: 'Item',
            },
            {
              kind: 'axisAdjacent',
              filename: 'revolve-axis-adjacent-y.ghx',
              expectedResultAccess: 'Item',
            },
          ],
        );

        const parameterized = results.find((entry) => entry.kind === 'parameterized');
        const axisAdjacent = results.find((entry) => entry.kind === 'axisAdjacent');
        assert.ok(parameterized);
        assert.ok(axisAdjacent);
        assert.equal(
          parameterized.parameters[REVOLVE_RHINO_PARAMETER_OUTER_RADIUS],
          REVOLVE_RHINO_DEFAULT_OUTER_RADIUS,
        );
        assert.equal(
          parameterized.parameters[REVOLVE_RHINO_PARAMETER_LENGTH],
          REVOLVE_RHINO_DEFAULT_LENGTH,
        );
        assert.deepEqual(axisAdjacent.parameters, {});

        for (const entry of results) {
          const filename = path.join(outputDirectory, entry.filename);
          const stat = await fs.stat(filename);
          assert.ok(stat.size > 0);
          if (mode === 'selftest') {
            const returned = await validateRevolveRhinoReturnedFixture(
              entry.kind,
              filename,
              entry.kind === 'parameterized'
                ? REVOLVE_RHINO_DEFAULT_OUTER_RADIUS
                : undefined,
              entry.kind === 'parameterized' ? REVOLVE_RHINO_DEFAULT_LENGTH : undefined,
            );
            assert.deepEqual(returned.parameters, entry.parameters);
            assert.equal(returned.expectedResultAccess, 'Item');
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
    it('strictly validates installed-host returned revolve GHX files', async () => {
      const parameterizedFile = process.env.REVOLVE_RHINO_RETURNED_PARAMETERIZED;
      const axisAdjacentFile = process.env.REVOLVE_RHINO_RETURNED_AXIS_ADJACENT;
      assert.ok(
        parameterizedFile,
        'REVOLVE_RHINO_RETURNED_PARAMETERIZED is required.',
      );
      assert.ok(
        axisAdjacentFile,
        'REVOLVE_RHINO_RETURNED_AXIS_ADJACENT is required.',
      );

      const expectedOuterRadius = expectedParameter(
        'REVOLVE_RHINO_EXPECTED_OUTER_RADIUS',
        REVOLVE_RHINO_ACCEPTED_OUTER_RADIUS,
      );
      const expectedLength = expectedParameter(
        'REVOLVE_RHINO_EXPECTED_LENGTH',
        REVOLVE_RHINO_ACCEPTED_LENGTH,
      );

      const parameterized = await validateRevolveRhinoReturnedFixture(
        'parameterized',
        parameterizedFile,
        expectedOuterRadius,
        expectedLength,
      );
      const axisAdjacent = await validateRevolveRhinoReturnedFixture(
        'axisAdjacent',
        axisAdjacentFile,
      );

      assert.notEqual(
        parameterized.parameters[REVOLVE_RHINO_PARAMETER_OUTER_RADIUS],
        REVOLVE_RHINO_DEFAULT_OUTER_RADIUS,
      );
      assert.notEqual(
        parameterized.parameters[REVOLVE_RHINO_PARAMETER_LENGTH],
        REVOLVE_RHINO_DEFAULT_LENGTH,
      );
      assert.deepEqual(axisAdjacent.parameters, {});
      assert.equal(parameterized.expectedResultAccess, 'Item');
      assert.equal(axisAdjacent.expectedResultAccess, 'Item');
      assert.equal(parameterized.filename, path.basename(parameterizedFile));
      assert.equal(axisAdjacent.filename, path.basename(axisAdjacentFile));
      assert.equal(revolveRhinoFixtureFilename('parameterized').endsWith('.ghx'), true);
      assert.equal(revolveRhinoFixtureFilename('axisAdjacent').endsWith('.ghx'), true);

      console.log(
        JSON.stringify({
          returnedValidation: 'accepted',
          parameterized,
          axisAdjacent,
        }),
      );
    });
  }
});
