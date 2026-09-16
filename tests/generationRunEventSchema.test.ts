import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const schema = fs.readFileSync(
  new URL('../supabase/schemas/generation_runs_events.sql', import.meta.url),
  'utf8',
);
const migration = fs.readFileSync(
  new URL(
    '../supabase/migrations/20260916071100_generation_run_events.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('generation run event durable schema', () => {
  for (const [name, sql] of [
    ['schema', schema],
    ['migration', migration],
  ] as const) {
    it(`${name} keeps telemetry separate, bounded and server-owned`, () => {
      assert.match(sql, /CREATE TABLE IF NOT EXISTS "public"\."generation_run_events"/);
      assert.match(sql, /REFERENCES "public"\."generation_runs"\("id"\) ON DELETE CASCADE/);
      assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
      assert.match(sql, /CREATE POLICY "generation_run_events_select_own"/);
      assert.match(sql, /GRANT SELECT ON TABLE "public"\."generation_run_events" TO authenticated/);
      assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE).*authenticated/i);
      assert.match(sql, /CREATE OR REPLACE FUNCTION "public"\."append_generation_run_event"/);
      assert.match(sql, /FOR UPDATE/);
      assert.match(sql, /ORDER BY "sequence" DESC\s+OFFSET 128/);
      assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM authenticated/);
      assert.doesNotMatch(sql, /"payload"\s/);
      assert.doesNotMatch(sql, /"prompt"\s/);
      assert.doesNotMatch(sql, /"reasoning"\s/);
    });
  }
});
