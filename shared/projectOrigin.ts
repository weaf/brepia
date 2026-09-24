export type ScratchProjectOrigin = Readonly<{
  kind: 'scratch';
}>;

export type BuiltinTemplateProjectOrigin = Readonly<{
  kind: 'template';
  catalog: 'builtin';
  templateId: string;
  templateVersion: number;
  sourceDigest: string;
}>;

export type ProjectOrigin = ScratchProjectOrigin | BuiltinTemplateProjectOrigin;

export const SCRATCH_PROJECT_ORIGIN: ScratchProjectOrigin = Object.freeze({
  kind: 'scratch',
});
