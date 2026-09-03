import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = 'supabase/migrations';
const suffix = '_brep_ai_atomic_revision.sql';
const candidates = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(suffix))
  .sort();

if (candidates.length !== 1) {
  throw new Error(
    `Expected exactly one generated ${suffix} migration, found ${candidates.length}: ${candidates.join(', ')}`,
  );
}

const migrationPath = path.join(migrationsDir, candidates[0]);
let sql = fs.readFileSync(migrationPath, 'utf8');

if (!sql.includes('CREATE OR REPLACE FUNCTION public.persist_brep_ai_revision')) {
  throw new Error(`Unexpected migration content in ${migrationPath}`);
}

if (!sql.includes('SECURITY INVOKER')) {
  const languageAnchor = ' LANGUAGE plpgsql\n';
  const index = sql.indexOf(languageAnchor);
  if (index < 0 || sql.indexOf(languageAnchor, index + languageAnchor.length) >= 0) {
    throw new Error('Could not uniquely locate the generated function LANGUAGE clause.');
  }
  sql =
    sql.slice(0, index + languageAnchor.length) +
    ' SECURITY INVOKER\n' +
    sql.slice(index + languageAnchor.length);
}

const revoke = `REVOKE ALL ON FUNCTION public.persist_brep_ai_revision(\n  uuid, uuid, uuid, jsonb, jsonb\n) FROM PUBLIC;`;
const grant = `GRANT EXECUTE ON FUNCTION public.persist_brep_ai_revision(\n  uuid, uuid, uuid, jsonb, jsonb\n) TO authenticated;`;

if (!sql.includes('REVOKE ALL ON FUNCTION public.persist_brep_ai_revision')) {
  sql = `${sql.trimEnd()}\n\n${revoke}\n`;
}
if (!sql.includes('GRANT EXECUTE ON FUNCTION public.persist_brep_ai_revision')) {
  sql = `${sql.trimEnd()}\n${grant}\n`;
}

fs.writeFileSync(migrationPath, sql);
console.log(`Finalized generated BRep AI migration security: ${migrationPath}`);
