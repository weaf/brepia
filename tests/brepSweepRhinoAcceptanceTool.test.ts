import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'vitest';

import {
  generateSweepRhinoAcceptanceFixture,
  SWEEP_RHINO_ACCEPTED_BEND_RADIUS,
  SWEEP_RHINO_ACCEPTED_TUBE_DIAMETER,
  SWEEP_RHINO_DEFAULT_BEND_RADIUS,
  SWEEP_RHINO_DEFAULT_TUBE_DIAMETER,
  SWEEP_RHINO_FILENAME,
  SWEEP_RHINO_PARAMETER_BEND_RADIUS,
  SWEEP_RHINO_PARAMETER_TUBE_DIAMETER,
  validateSweepRhinoReturnedFixture,
} from '../scripts/brep/sweep-rhino-acceptance.ts';

const mode = process.env.SWEEP_RHINO_MODE ?? 'selftest';

describe('bounded sweep Rhino acceptance tooling', () => {
  if (mode === 'selftest' || mode === 'generate') {
    it('generates a validated current-compiler Item-access sweep GHX fixture', async () => {
      const temporaryDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'brepia-sweep-rhino-'),
      );
      const outputDirectory =
        mode === 'generate'
          ? path.resolve(
              process.env.SWEEP_RHINO_OUTPUT_DIR ??
                'tmp/sweep-rhino-acceptance',
            )
          : temporaryDirectory;

      try {
        const result =
          await generateSweepRhinoAcceptanceFixture(outputDirectory);
        assert.equal(result.filename, SWEEP_RHINO_FILENAME);
        assert.equal(result.expectedResultAccess, 'Item');
        assert.equal(
          result.parameters[SWEEP_RHINO_PARAMETER_TUBE_DIAMETER],
          SWEEP_RHINO_DEFAULT_TUBE_DIAMETER,
        );
        assert.equal(
          result.parameters[SWEEP_RHINO_PARAMETER_BEND_RADIUS],
          SWEEP_RHINO_DEFAULT_BEND_RADIUS,
        );
        assert.ok(
          (await fs.stat(path.join(outputDirectory, result.filename))).size > 0,
        );

        if (mode === 'selftest') {
          const returned = await validateSweepRhinoReturnedFixture(
            path.join(outputDirectory, result.filename),
            SWEEP_RHINO_DEFAULT_TUBE_DIAMETER,
            SWEEP_RHINO_DEFAULT_BEND_RADIUS,
          );
          assert.deepEqual(returned.parameters, result.parameters);
        }

        if (mode === 'generate') {
          console.log(JSON.stringify({ outputDirectory, fixture: result }));
        }
      } finally {
        if (mode === 'selftest') {
          await fs.rm(temporaryDirectory, { recursive: true, force: true });
        }
      }
    });
  }

  if (mode === 'validate') {
    it('strictly validates the installed-host returned sweep GHX', async () => {
      const returnedFile = process.env.SWEEP_RHINO_RETURNED;
      assert.ok(returnedFile, 'SWEEP_RHINO_RETURNED is required.');

      const result = await validateSweepRhinoReturnedFixture(
        returnedFile,
        SWEEP_RHINO_ACCEPTED_TUBE_DIAMETER,
        SWEEP_RHINO_ACCEPTED_BEND_RADIUS,
      );

      assert.equal(
        result.parameters[SWEEP_RHINO_PARAMETER_TUBE_DIAMETER],
        SWEEP_RHINO_ACCEPTED_TUBE_DIAMETER,
      );
      assert.equal(
        result.parameters[SWEEP_RHINO_PARAMETER_BEND_RADIUS],
        SWEEP_RHINO_ACCEPTED_BEND_RADIUS,
      );
      assert.notEqual(
        result.parameters[SWEEP_RHINO_PARAMETER_TUBE_DIAMETER],
        SWEEP_RHINO_DEFAULT_TUBE_DIAMETER,
      );
      assert.notEqual(
        result.parameters[SWEEP_RHINO_PARAMETER_BEND_RADIUS],
        SWEEP_RHINO_DEFAULT_BEND_RADIUS,
      );
      assert.equal(result.expectedResultAccess, 'Item');

      console.log(
        JSON.stringify({ returnedValidation: 'accepted', fixture: result }),
      );
    });
  }
});
