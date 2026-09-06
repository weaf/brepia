import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  createBrepGrasshopperPackagePlan,
  serializeBrepGrasshopperPackagePlan,
} from '../shared/brepGrasshopperPackagePlan.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

const UUID_V8 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('BRep Phase 8 portable Grasshopper package plan', () => {
  it('is deterministic and preserves canonical project/revision identity', async () => {
    const first = await createBrepGrasshopperPackagePlan(fixture);
    const second = await createBrepGrasshopperPackagePlan(fixture);

    assert.deepEqual(first, second);
    assert.equal(first.kind, 'brepia-grasshopper-package-plan');
    assert.equal(first.schemaVersion, 1);
    assert.equal(first.model.projectId, 'cabinetA42');
    assert.equal(first.model.sourceRevisionId, 'revision-42');
    assert.match(first.component.instanceGuid, UUID_V8);
    assert.equal(
      await serializeBrepGrasshopperPackagePlan(fixture),
      await serializeBrepGrasshopperPackagePlan(fixture),
    );
  });

  it('creates one stable control and wire per canonical numeric input', async () => {
    const plan = await createBrepGrasshopperPackagePlan(fixture);
    const canonicalNumberInputs = plan.contract.interface.inputs.filter(
      (input) => input.type === 'number',
    );

    assert.deepEqual(
      plan.controls.map((control) => control.inputId),
      canonicalNumberInputs.map((input) => input.id),
    );
    assert.equal(plan.controls.length, 2);
    assert.equal(plan.connections.length, plan.controls.length);
    assert.ok(plan.controls.every((control) => UUID_V8.test(control.instanceGuid)));
    assert.deepEqual(
      plan.connections.map((connection) => connection.to.inputId),
      plan.controls.map((control) => control.inputId),
    );
    assert.ok(
      plan.connections.every(
        (connection) =>
          connection.to.objectGuid === plan.component.instanceGuid &&
          plan.controls.some(
            (control) => control.instanceGuid === connection.from.objectGuid,
          ),
      ),
    );
  });

  it('does not invent slider bounds for partially or unbounded parameters', async () => {
    const plan = await createBrepGrasshopperPackagePlan(fixture);
    const height = plan.controls.find((control) => control.inputId === 'height');
    const width = plan.controls.find((control) => control.inputId === 'width');

    assert.ok(height);
    assert.ok(width);
    assert.equal(height.presentation, 'number');
    assert.equal(width.presentation, 'slider');
    assert.equal(width.min, 600);
    assert.equal(width.max, 2400);
    assert.equal(width.step, 50);
  });

  it('leaves placement deliberately unconnected so Phase 7 project placement semantics remain authoritative', async () => {
    const plan = await createBrepGrasshopperPackagePlan(fixture);

    assert.deepEqual(plan.placement, {
      inputId: 'placement',
      generatedSource: null,
      behavior: 'leave-unconnected-for-project-placement',
    });
    assert.equal(
      plan.connections.some((connection) => connection.to.inputId === 'placement'),
      false,
    );
  });

  it('changes generated object identity when the immutable source revision changes', async () => {
    const first = await createBrepGrasshopperPackagePlan(fixture);
    const changed = structuredClone(fixture) as {
      model: Record<string, unknown>;
    };
    changed.model.sourceRevisionId = 'revision-43';
    const second = await createBrepGrasshopperPackagePlan(changed);

    assert.notEqual(first.component.instanceGuid, second.component.instanceGuid);
    assert.notDeepEqual(
      first.controls.map((control) => control.instanceGuid),
      second.controls.map((control) => control.instanceGuid),
    );
    assert.deepEqual(
      first.controls.map((control) => control.inputId),
      second.controls.map((control) => control.inputId),
    );
  });

  it('rebuilds the package interface from canonical source instead of trusting tampered display data', async () => {
    const tampered = structuredClone(fixture) as {
      interface: {
        inputs: Array<Record<string, unknown>>;
      };
    };
    tampered.interface.inputs = [
      {
        id: 'evil',
        label: 'Injected input',
        type: 'number',
        access: 'item',
        unit: 'mm',
        default: 999,
        fallback: 'project-default',
      },
    ];

    const plan = await createBrepGrasshopperPackagePlan(tampered);
    assert.deepEqual(
      plan.controls.map((control) => control.inputId),
      ['height', 'width'],
    );
  });
});
