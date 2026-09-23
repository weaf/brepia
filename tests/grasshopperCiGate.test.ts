import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Grasshopper CI merge gate', () => {
  it('keeps an always-present branch-protection-safe interoperability result', async () => {
    const workflow = await readFile(
      '.github/workflows/grasshopper-build.yml',
      'utf8',
    );

    expect(workflow).toContain('name: grasshopper-interoperability');
    expect(workflow).toContain('if: ${{ always() }}');
    expect(workflow).toContain('needs.changes.outputs.relevant');
    expect(workflow).toContain('BUILD_RESULT: ${{ needs.build.result }}');
    expect(workflow).toContain(
      'PACKAGE_BUILD_RESULT: ${{ needs.package-build.result }}',
    );

    expect(workflow).not.toMatch(/pull_request:\s*\n\s+paths:/);
    expect(workflow).not.toMatch(/branches:\s*\n\s+- master\s*\n\s+paths:/);
  });

  it('preserves the existing interoperability change boundary', async () => {
    const workflow = await readFile(
      '.github/workflows/grasshopper-build.yml',
      'utf8',
    );

    for (const path of [
      'grasshopper/*',
      'shared/brepGrasshopperPackagePlan.ts',
      'tests/brepGrasshopperPlugin.test.ts',
      'tests/brepGrasshopperPackaging.test.ts',
      'tests/brepGrasshopperPackagePlan.test.ts',
      '.github/workflows/grasshopper-build.yml',
    ]) {
      expect(workflow).toContain(path);
    }
  });
});
