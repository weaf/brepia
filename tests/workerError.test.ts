import { describe, expect, it } from 'vitest';
import OpenSCADError from '@/lib/OpenSCADError';
import { errorFromWorker } from '@/worker/workerError';

describe('worker OpenSCAD error reconstruction', () => {
  it('preserves OpenSCADError identity, code and diagnostics across the worker boundary', () => {
    const error = errorFromWorker({
      name: 'OpenSCADError',
      message: 'Adam did not exit correctly',
      code: '1',
      stdErr: ["WARNING: Ignoring unknown variable 'heiht' in file input.scad, line 4"],
    });

    expect(error).toBeInstanceOf(OpenSCADError);
    expect(error.name).toBe('OpenSCADError');
    expect((error as OpenSCADError).code).toBe('1');
    expect((error as OpenSCADError).stdErr).toContain(
      "WARNING: Ignoring unknown variable 'heiht' in file input.scad, line 4",
    );
    expect(error.message).toContain("unknown variable 'heiht'");
  });

  it('keeps ordinary worker failures as ordinary Error instances', () => {
    const error = errorFromWorker({
      name: 'Error',
      message: 'OpenSCAD worker timed out',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(OpenSCADError);
    expect(error.name).toBe('Error');
  });
});
