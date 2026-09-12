import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BREP_GRASSHOPPER_EXTERNAL_CONNECTION_MAX_COUNT,
  BREP_GRASSHOPPER_RECONCILIATION_MAX_BYTES,
  BrepGrasshopperReconciliationError,
  createBrepGrasshopperReconciliationEnvelope,
  normalizeBrepGrasshopperReconciliationEnvelope,
  parseBrepGrasshopperReconciliationJson,
  serializeBrepGrasshopperReconciliationEnvelope,
} from '../shared/brepGrasshopperReconciliation.ts';
import { createBrepGrasshopperPackagePlan } from '../shared/brepGrasshopperPackagePlan.ts';

const contract = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

const externalObjectGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const externalParamGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const targetParamGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function expectReconciliationError(
  action: () => Promise<unknown>,
  code: BrepGrasshopperReconciliationError['code'],
) {
  return expect(action()).rejects.toMatchObject({
    name: 'BrepGrasshopperReconciliationError',
    code,
  });
}

describe('BRep Phase 8D Grasshopper reconciliation envelope', () => {
  it('recognizes the exact generated Brepia instance and generated controls', async () => {
    const plan = await createBrepGrasshopperPackagePlan(contract);
    const envelope = await createBrepGrasshopperReconciliationEnvelope({
      contract,
      observedComponentInstanceGuid: plan.component.instanceGuid,
      parameters: plan.controls.map((control) => ({
        id: control.inputId,
        value: control.default,
        sourceObjectGuid: control.instanceGuid,
      })),
    });

    expect(envelope.kind).toBe('brepia-grasshopper-reconciliation');
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.model.projectId).toBe('cabinetA42');
    expect(envelope.componentIdentity.recognition).toBe('exact-generated-instance');
    expect(
      envelope.parameters.every(
        (parameter) =>
          parameter.valueStatus === 'resolved' &&
          parameter.sourceOwnership === 'generated-brepia-control',
      ),
    ).toBe(true);
    expect(envelope.placement).toEqual({
      inputId: 'placement',
      mode: 'project-placement',
    });
  });

  it('still recognizes a copied/reidentified Brepia component through its canonical embedded contract', async () => {
    const envelope = await createBrepGrasshopperReconciliationEnvelope({
      contract,
      observedComponentInstanceGuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });

    expect(envelope.componentIdentity.recognition).toBe(
      'contract-recognized-instance',
    );
    expect(envelope.parameters.every((parameter) => parameter.valueStatus === 'unresolved')).toBe(
      true,
    );
  });

  it('classifies changed upstream controls as external evidence without making them canonical features', async () => {
    const plan = await createBrepGrasshopperPackagePlan(contract);
    const envelope = await createBrepGrasshopperReconciliationEnvelope({
      contract,
      observedComponentInstanceGuid: plan.component.instanceGuid,
      parameters: [
        {
          id: 'width',
          value: 1350,
          sourceObjectGuid: externalObjectGuid,
        },
      ],
      placementSourceObjectGuid: externalObjectGuid,
      externalEvidence: {
        completeness: 'document-scan',
        objects: [
          {
            instanceGuid: externalObjectGuid,
            componentGuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            name: 'User Slider',
            nickname: 'Width override',
          },
        ],
        connections: [
          {
            fromObjectGuid: externalObjectGuid,
            fromParamGuid: externalParamGuid,
            toObjectGuid: plan.component.instanceGuid,
            toParamGuid: targetParamGuid,
          },
        ],
      },
    });

    const width = envelope.parameters.find((parameter) => parameter.id === 'width');
    expect(width).toMatchObject({
      valueStatus: 'resolved',
      value: 1350,
      sourceOwnership: 'external-grasshopper-source',
      sourceObjectGuid: externalObjectGuid,
    });
    expect(envelope.placement).toEqual({
      inputId: 'placement',
      mode: 'grasshopper-source',
      sourceObjectGuid: externalObjectGuid,
    });
    expect(envelope.externalEvidence.authority).toBe('evidence-only');
    expect(envelope.externalEvidence.completeness).toBe('document-scan');
  });

  it('rejects unknown, duplicate, non-finite and out-of-bounds Brepia parameter observations', async () => {
    const plan = await createBrepGrasshopperPackagePlan(contract);
    const base = {
      contract,
      observedComponentInstanceGuid: plan.component.instanceGuid,
    };

    await expectReconciliationError(
      () =>
        createBrepGrasshopperReconciliationEnvelope({
          ...base,
          parameters: [{ id: 'unknown', value: 1 }],
        }),
      'invalid_reconciliation',
    );
    await expectReconciliationError(
      () =>
        createBrepGrasshopperReconciliationEnvelope({
          ...base,
          parameters: [
            { id: 'width', value: 1000 },
            { id: 'width', value: 1200 },
          ],
        }),
      'invalid_reconciliation',
    );
    await expectReconciliationError(
      () =>
        createBrepGrasshopperReconciliationEnvelope({
          ...base,
          parameters: [{ id: 'width', value: Number.NaN }],
        }),
      'invalid_reconciliation',
    );
    await expectReconciliationError(
      () =>
        createBrepGrasshopperReconciliationEnvelope({
          ...base,
          parameters: [{ id: 'width', value: 500 }],
        }),
      'invalid_reconciliation',
    );
  });

  it('re-normalizes derived ownership and expected identities instead of trusting transported claims', async () => {
    const plan = await createBrepGrasshopperPackagePlan(contract);
    const canonical = await createBrepGrasshopperReconciliationEnvelope({
      contract,
      observedComponentInstanceGuid: plan.component.instanceGuid,
      parameters: [
        {
          id: 'width',
          value: 1300,
          sourceObjectGuid: plan.controls.find((control) => control.inputId === 'width')!
            .instanceGuid,
        },
      ],
    });
    const tampered = structuredClone(canonical);
    tampered.model.projectId = 'evil';
    tampered.componentIdentity.expectedInstanceGuid = externalObjectGuid;
    tampered.componentIdentity.recognition = 'contract-recognized-instance';
    tampered.parameters[1]!.expectedControlInstanceGuid = externalObjectGuid;
    tampered.parameters[1]!.sourceOwnership = 'external-grasshopper-source';
    tampered.externalEvidence.authority = 'evidence-only';

    await expect(normalizeBrepGrasshopperReconciliationEnvelope(tampered)).resolves.toEqual(
      canonical,
    );
  });

  it('round-trips bounded JSON and rejects oversized evidence', async () => {
    const plan = await createBrepGrasshopperPackagePlan(contract);
    const canonical = await createBrepGrasshopperReconciliationEnvelope({
      contract,
      observedComponentInstanceGuid: plan.component.instanceGuid,
    });
    const serialized = `${JSON.stringify(canonical)}\n`;

    await expect(parseBrepGrasshopperReconciliationJson(serialized)).resolves.toEqual(
      canonical,
    );
    expect(await serializeBrepGrasshopperReconciliationEnvelope(canonical)).toContain(
      '"authority": "evidence-only"',
    );
    await expectReconciliationError(
      () => parseBrepGrasshopperReconciliationJson('{'),
      'invalid_json',
    );
    await expectReconciliationError(
      () =>
        parseBrepGrasshopperReconciliationJson(
          ' '.repeat(BREP_GRASSHOPPER_RECONCILIATION_MAX_BYTES + 1),
        ),
      'too_large',
    );
    await expectReconciliationError(
      () =>
        createBrepGrasshopperReconciliationEnvelope({
          contract,
          observedComponentInstanceGuid: plan.component.instanceGuid,
          externalEvidence: {
            connections: Array.from(
              { length: BREP_GRASSHOPPER_EXTERNAL_CONNECTION_MAX_COUNT + 1 },
              () => ({
                fromParamGuid: externalParamGuid,
                toParamGuid: targetParamGuid,
              }),
            ),
          },
        }),
      'too_large',
    );
  });
});
