import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schemaSql = readFileSync('supabase/schemas/brep_ai.sql', 'utf8');
const migrationSql = readFileSync(
  'supabase/migrations/20260903130000_brep_ai_atomic_revision.sql',
  'utf8',
);

describe('BRep AI atomic persistence SQL', () => {
  it('keeps declarative schema and migration definitions identical', () => {
    expect(migrationSql).toBe(schemaSql);
  });

  it('locks and verifies the conversation leaf before inserting a message', () => {
    const lockIndex = schemaSql.indexOf('FOR UPDATE;');
    const insertIndex = schemaSql.indexOf('INSERT INTO public.messages');

    expect(lockIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(lockIndex);
    expect(schemaSql).toContain('v_current_leaf_id IS DISTINCT FROM p_expected_leaf_id');
    expect(schemaSql).toContain("'reason', 'stale'");
  });

  it('runs as the caller and explicitly restricts execution to authenticated users', () => {
    expect(schemaSql).toContain('SECURITY INVOKER');
    expect(schemaSql).toContain('user_id = auth.uid()');
    expect(schemaSql).toContain('REVOKE ALL ON FUNCTION');
    expect(schemaSql).toContain('TO authenticated;');
  });
});
