import { describe, expect, it } from 'vitest';
import { createBrepGrasshopperContract } from '@shared/brepGrasshopperContract';
import {
  BREP_GRASSHOPPER_EXACT_ARTIFACT_MANIFEST_KIND,
  BREP_GRASSHOPPER_EXACT_ARTIFACT_MANIFEST_SCHEMA_VERSION,
  brepGrasshopperExactArtifactFileName,
  createBrepGrasshopperExactArtifactManifest,
} from '@shared/brepGrasshopperRuntime';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import type { BrepProject } from '@shared/brepProject';

function projectWithExactRoles(): BrepProject {
  return {
    ...phaseOneCabinetProject,
    projectObject: {
      footprintNodeId: 'cabinetBody',
      clearanceEnvelopeNodeId: 'cableHole',
      maintenanceEnvelopeNodeId: 'positionedHole',
      points: [],
    },
  };
}

describe('BRep Phase 7 exact Grasshopper artifact manifest', () => {
  it('maps canonical Brep roles to deterministic exact STEP identities', () => {
    const contract = createBrepGrasshopperContract({
      project: projectWithExactRoles(),
      sourceRevisionId: 'revision-42',
    });

    const manifest = createBrepGrasshopperExactArtifactManifest(contract);

    expect(manifest.kind).toBe(
      BREP_GRASSHOPPER_EXACT_ARTIFACT_MANIFEST_KIND,
    );
    expect(manifest.schemaVersion).toBe(
      BREP_GRASSHOPPER_EXACT_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    );
    expect(manifest.model).toEqual(contract.model);
    expect(manifest.artifacts).toEqual([
      {
        role: 'result',
        nodeId: 'cabinetWithCableHole',
        format: 'step',
        representation: 'exact-brep',
        contentType: 'model/step',
        fileName: 'brepia-primary.step',
      },
      {
        role: 'footprint',
        nodeId: 'cabinetBody',
        format: 'step',
        representation: 'exact-brep',
        contentType: 'model/step',
        fileName: 'brepia-footprint.step',
      },
      {
        role: 'clearanceEnvelope',
        nodeId: 'cableHole',
        format: 'step',
        representation: 'exact-brep',
        contentType: 'model/step',
        fileName: 'brepia-clearance-envelope.step',
      },
      {
        role: 'maintenanceEnvelope',
        nodeId: 'positionedHole',
        format: 'step',
        representation: 'exact-brep',
        contentType: 'model/step',
        fileName: 'brepia-maintenance-envelope.step',
      },
    ]);
  });

  it('requires only the primary exact artifact when optional roles are absent', () => {
    const manifest = createBrepGrasshopperExactArtifactManifest(
      createBrepGrasshopperContract({
        project: phaseOneCabinetProject,
        sourceRevisionId: 'revision-base',
      }),
    );

    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.artifacts[0]).toMatchObject({
      role: 'result',
      nodeId: phaseOneCabinetProject.resultNodeId,
      fileName: 'brepia-primary.step',
      representation: 'exact-brep',
    });
  });

  it('derives artifact identity from canonical source rather than display fields', () => {
    const contract = createBrepGrasshopperContract({
      project: projectWithExactRoles(),
      sourceRevisionId: 'revision-derived',
    });
    contract.interface.outputs[0].label = 'Renamed display output';
    contract.interface.outputs.reverse();

    const manifest = createBrepGrasshopperExactArtifactManifest(contract);

    expect(manifest.artifacts.map((entry) => entry.role)).toEqual([
      'result',
      'footprint',
      'clearanceEnvelope',
      'maintenanceEnvelope',
    ]);
    expect(brepGrasshopperExactArtifactFileName('result')).toBe(
      'brepia-primary.step',
    );
    expect(brepGrasshopperExactArtifactFileName('clearanceEnvelope')).toBe(
      'brepia-clearance-envelope.step',
    );
  });
});
