import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BREP_GRASSHOPPER_PACKAGE_PLAN_MEDIA_TYPE,
  brepGrasshopperPackagePlanErrorResponse,
  createBrepGrasshopperPackagePlanFromRequest,
} from '@/routes/api/brep/export.grasshopper-plan';
import { BrepGrasshopperPackagePlanError } from '@shared/brepGrasshopperPackagePlan';

const contractFixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  source: unknown;
  model: { sourceRevisionId: string };
};

const routeSource = fs.readFileSync(
  new URL(
    '../src/routes/api/brep/export.grasshopper-plan.ts',
    import.meta.url,
  ),
  'utf8',
);

describe('BRep Phase 8C Grasshopper package plan transport', () => {
  it('builds the deterministic plan from canonical project plus immutable revision provenance', async () => {
    const plan = await createBrepGrasshopperPackagePlanFromRequest({
      project: contractFixture.source,
      sourceRevisionId: contractFixture.model.sourceRevisionId,
    });

    expect(plan.kind).toBe('brepia-grasshopper-package-plan');
    expect(plan.schemaVersion).toBe(1);
    expect(plan.model.projectId).toBe('cabinetA42');
    expect(plan.model.sourceRevisionId).toBe('revision-42');
    expect(plan.controls.map((control) => control.inputId)).toEqual([
      'height',
      'width',
    ]);
    expect(plan.placement.generatedSource).toBeNull();
  });

  it('uses an explicit versioned package media type', () => {
    expect(BREP_GRASSHOPPER_PACKAGE_PLAN_MEDIA_TYPE).toBe(
      'application/vnd.brepia.grasshopper-package-plan+json',
    );
  });

  it('maps malformed package requests to a stable client error', async () => {
    const response = brepGrasshopperPackagePlanErrorResponse(
      new BrepGrasshopperPackagePlanError(
        'invalid_plan',
        'invalid package request',
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'invalid_grasshopper_package_request',
      error: 'invalid package request',
    });
  });

  it('keeps the transport authenticated, bounded, cache-safe and free from native evaluation', () => {
    expect(routeSource).toMatch(/await requireUser\(request\)/);
    expect(routeSource).toMatch(/readBoundedBrepJson\(request\)/);
    expect(routeSource).toMatch(/Cache-Control': 'private, no-store'/);
    expect(routeSource).toMatch(/X-Brepia-Grasshopper-Plan-Version/);
    expect(routeSource).toMatch(/createBrepGrasshopperContract/);
    expect(routeSource).toMatch(/createBrepGrasshopperPackagePlan/);
    expect(routeSource).not.toMatch(/evaluateBrepProject/);
    expect(routeSource).not.toMatch(/exportBrepProjectTo/);
    expect(routeSource).not.toMatch(/Rhino/);
  });
});
