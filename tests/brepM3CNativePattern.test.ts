import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);
const smoke = fs.readFileSync(
  new URL('../scripts/brep/smoke-test.sh', import.meta.url),
  'utf8',
);
const rectangularSmoke = fs.readFileSync(
  new URL('../scripts/brep/m3c-rectangular-pattern-smoke.sh', import.meta.url),
  'utf8',
);
const containerfile = fs.readFileSync(
  new URL('../scripts/brep/Containerfile', import.meta.url),
  'utf8',
);

describe('M3C native rectangular-pattern execution contract', () => {
  it('evaluates rectangular instances in canonical row-major A-outer/B-inner order', () => {
    assert.match(driver, /for a in range\(node\["countA"\]\):\s+for b in range\(node\["countB"\]\):/s);
    assert.match(
      driver,
      /direction_a\[axis\] \* a \* spacing_a \+ direction_b\[axis\] \* b \* spacing_b/,
    );
    assert.match(driver, /instances\.append\(input_shape\.moved\(Location\(translation\)\)\)/);
  });

  it('keeps stable body identity tied to the canonical flattened instance index', () => {
    assert.match(driver, /"id": f"\{node_id\}::\{index\}"/);
    assert.match(driver, /"instance": \{"index": index, "sourceNodeId": node\["input"\]\}/);
    assert.match(driver, /"viewerMesh": mesh\(shape, f"\{node_id\}::\{index\}"\)/);
  });

  it('consumes subtract.tools[] in declared order and each instance set in canonical order', () => {
    assert.match(
      driver,
      /for tool_id in node\["tools"\]:\s+for tool_shape in evaluate_node_instances\(tool_id\):\s+shape = shape - tool_shape/s,
    );
  });

  it('locks a pinned-runtime smoke fixture for row-major identities and ordered subtract tools', () => {
    assert.match(smoke, /m3c-rectangular-pattern-smoke\.sh/);
    assert.match(containerfile, /BUILD123D_VERSION=0\.11\.1/);
    assert.match(containerfile, /CADQUERY_OCP_NOVTK_VERSION=7\.9\.3\.1\.1/);
    assert.match(rectangularSmoke, /pattern::/);
    assert.match(rectangularSmoke, /offsets:expected/);
    assert.match(rectangularSmoke, /orderedTools:\['singleToolAt','cutters'\]/);
  });

  it('keeps rectangularPattern as instanceSet output rather than silently fusing bodies', () => {
    assert.match(
      driver,
      /result_node\["type"\] in \{"linearPattern", "rectangularPattern", "circularPattern"\}/,
    );
    assert.match(driver, /result_shape = Compound\(children=result_instances\)/);
    assert.match(driver, /result_kind = "instanceSet"/);
  });
});
