import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schemaSql = readFileSync('supabase/schemas/brep_ai.sql', 'utf8');
const migrationName = readdirSync('supabase/migrations').find((name) =>
  name.endsWith('_brep_ai_atomic_revision.sql'),
);

if (!migrationName) {
  throw new Error(
    'Missing generated brep_ai_atomic_revision migration. Run `npx supabase db diff -f brep_ai_atomic_revision` from the declarative schema.',
  );
}

const migrationSql = readFileSync(
  `supabase/migrations/${migrationName}`,
  'utf8',
);

function expectAtomicRevisionContract(sql: string) {
  const lockIndex = sql.indexOf('FOR UPDATE');
  const insertIndex = sql.indexOf('INSERT INTO public.messages');

  expect(sql).toContain('persist_brep_ai_revision');
  expect(lockIndex).toBeGreaterThan(-1);
  expect(insertIndex).toBeGreaterThan(lockIndex);
  expect(sql).toContain(
    'v_current_leaf_id IS DISTINCT FROM p_expected_leaf_id',
  );
  expect(sql).toContain("'reason', 'stale'");
  expect(sql).toContain('SECURITY INVOKER');
  expect(sql).toContain('user_id = auth.uid()');
  expect(sql).toContain('REVOKE ALL ON FUNCTION');
  expect(sql).toContain('TO authenticated');
}

describe('BRep AI atomic persistence SQL', () => {
  it('keeps the atomic contract in the declarative schema', () => {
    expectAtomicRevisionContract(schemaSql);
  });

  it('keeps the atomic contract in the generated migration', () => {
    expectAtomicRevisionContract(migrationSql);
  });
});
