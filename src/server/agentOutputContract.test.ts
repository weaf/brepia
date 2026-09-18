import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildAgentOutputContract } from './opencodeAgentResult.js';

function openScadContract(): string {
  return buildAgentOutputContract('openscad');
}

function brepContract(): string {
  return buildAgentOutputContract('brep');
}

describe('buildAgentOutputContract', () => {
  describe('OpenSCAD project protocol', () => {
    it('requires one structured project/message JSON result', () => {
      const contract = openScadContract();
      assert.match(contract, /return ONLY one valid JSON object/);
      assert.match(contract, /"project"/);
      assert.match(contract, /"message"/);
    });

    it('requires a complete normalized OpenSCAD project snapshot', () => {
      const contract = openScadContract();
      assert.match(contract, /COMPLETE normalized OpenSCAD project snapshot/);
      assert.match(contract, /"schemaVersion":1/);
      assert.match(contract, /"entrypointPath":"main\.scad"/);
      assert.match(contract, /"files"/);
    });

    it('preserves support files and bounded relative paths', () => {
      const contract = openScadContract();
      assert.match(contract, /Preserve every unchanged support file/);
      assert.match(contract, /relative \.scad path/);
      assert.match(contract, /never return absolute or traversal paths/);
    });

    it('requires a project for a CAD request before a build result', () => {
      const contract = openScadContract();
      assert.match(contract, /<user_request>/);
      assert.match(contract, /<pcad_build_result>/);
      assert.match(contract, /project MUST be present/);
    });

    it('allows a post-build continuation to finish without another project', () => {
      assert.match(
        openScadContract(),
        /After <pcad_build_result>, omit project only when no revised CAD artifact is needed/,
      );
    });

    it('rejects the legacy top-level code contract', () => {
      assert.match(
        openScadContract(),
        /Do not return a legacy top-level code field/,
      );
    });

    it('bridges the complete project into build_parametric_model', () => {
      assert.match(
        openScadContract(),
        /Brepia converts project into build_parametric_model itself/,
      );
    });
  });

  describe('native BRep project protocol', () => {
    it('requires a complete canonical BRep project snapshot', () => {
      const contract = brepContract();
      assert.match(contract, /COMPLETE canonical BRep project snapshot/);
      assert.match(contract, /"schemaVersion":1/);
      assert.match(contract, /"resultNodeId"/);
    });

    it('preserves stable canonical identities on follow-up edits', () => {
      const contract = brepContract();
      assert.match(contract, /Preserve the existing project id/);
      assert.match(
        contract,
        /Preserve every unchanged node id and published-parameter id/,
      );
    });

    it('keeps external agents inside the provider-safe schema boundary', () => {
      const contract = brepContract();
      assert.match(contract, /<pcad_brep_schema>/);
      assert.match(contract, /Never invent raw edge\/face indices/);
    });

    it('bridges the canonical project into build_brep_project', () => {
      assert.match(
        brepContract(),
        /Brepia converts project into build_brep_project itself/,
      );
    });
  });
});
