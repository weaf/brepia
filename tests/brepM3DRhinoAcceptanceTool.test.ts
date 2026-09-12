import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'vitest';

import {
  generateM3dRhinoAcceptanceFixtures,
  M3D_RHINO_DEFAULT_ANGLE_STEP,
  M3D_RHINO_DEFAULT_RADIUS,
  M3D_RHINO_PARAMETER_ANGLE_STEP,
  M3D_RHINO_PARAMETER_RADIUS,
  m3dRhinoFixtureFilename,
  validateM3dRhinoReturnedFixture,
} from '../scripts/brep/m3d-rhino-acceptance.ts';

const mode = process.env.M3D_RHINO_MODE ?? 'selftest';

function optionalExpectedParameter(name: string): number | undefined {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return undefined;
  const value = Number(raw);
  assert.ok(Number.isFinite(value), `${name} must be a finite number.`);
  return value;
}

function assertPerturbed(parameters: Record<string, number>, fixture: string): void {
  assert.ok(
    parameters[M3D_RHINO_PARAMETER_RADIUS] !== M3D_RHINO_DEFAULT_RADIUS ||
      parameters[M3D_RHINO_PARAMETER_ANGLE_STEP] !==
        M3D_RHINO_DEFAULT_ANGLE_STEP,
    `${fixture} must persist at least one parameter change from the generated defaults.`,
  );
}

describe('M3D Rhino acceptance tooling', () => {
  if (mode === 'selftest' || mode === 'generate') {
    it('generates validated current-compiler circular GHX fixtures', async () => {
      const temporaryDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'brepia-m3d-rhino-'),
      );
      const outputDirectory =
        mode === 'generate'
          ? path.resolve(
              process.env.M3D_RHINO_OUTPUT_DIR ??
                'tmp/m3d-rhino-acceptance',
            )
          : temporaryDirectory;

      try {
        const results = await generateM3dRhinoAcceptanceFixtures(outputDirectory);
        assert.deepEqual(
          results.map((entry) => ({
            kind: entry.kind,
            filename: entry.filename,
            expectedResultAccess: entry.expectedResultAccess,
          })),
          [
            {
              kind: 'final',
              filename: 'm3d-final-circular-pattern.ghx',
              expectedResultAccess: 'List',
            },
            {
              kind: 'cutters',
              filename: 'm3d-circular-pattern-cutters.ghx',
              expectedResultAccess: 'Item',
            },
          ],
        );

        for (const entry of results) {
          const filename = path.join(outputDirectory, entry.filename);
          const stat = await fs.stat(filename);
          assert.ok(stat.size > 0);
          assert.equal(
            entry.parameters[M3D_RHINO_PARAMETER_RADIUS],
            M3D_RHINO_DEFAULT_RADIUS,
          );
          assert.equal(
            entry.parameters[M3D_RHINO_PARAMETER_ANGLE_STEP],
            M3D_RHINO_DEFAULT_ANGLE_STEP,
          );

          if (mode === 'selftest') {
            const returned = await validateM3dRhinoReturnedFixture(
              entry.kind,
              filename,
              M3D_RHINO_DEFAULT_RADIUS,
              M3D_RHINO_DEFAULT_ANGLE_STEP,
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
    it('strictly validates both installed-host returned circular GHX files', async () => {
      const finalFile = process.env.M3D_RHINO_RETURNED_FINAL;
      const cuttersFile = process.env.M3D_RHINO_RETURNED_CUTTERS;
      assert.ok(finalFile, 'M3D_RHINO_RETURNED_FINAL is required.');
      assert.ok(cuttersFile, 'M3D_RHINO_RETURNED_CUTTERS is required.');

      const expectedRadius = optionalExpectedParameter(
        'M3D_RHINO_EXPECTED_RADIUS',
      );
      const expectedAngleStep = optionalExpectedParameter(
        'M3D_RHINO_EXPECTED_ANGLE_STEP',
      );

      const finalResult = await validateM3dRhinoReturnedFixture(
        'final',
        finalFile,
        expectedRadius,
        expectedAngleStep,
      );
      const cuttersResult = await validateM3dRhinoReturnedFixture(
        'cutters',
        cuttersFile,
        expectedRadius,
        expectedAngleStep,
      );

      assertPerturbed(finalResult.parameters, 'Final pattern returned GHX');
      assertPerturbed(cuttersResult.parameters, 'Pattern cutters returned GHX');
      assert.equal(finalResult.expectedResultAccess, 'List');
      assert.equal(cuttersResult.expectedResultAccess, 'Item');
      assert.equal(finalResult.filename, path.basename(finalFile));
      assert.equal(cuttersResult.filename, path.basename(cuttersFile));
      assert.equal(m3dRhinoFixtureFilename('final').endsWith('.ghx'), true);
      assert.equal(m3dRhinoFixtureFilename('cutters').endsWith('.ghx'), true);

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
