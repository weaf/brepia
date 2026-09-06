import {
  ghxChunk,
  ghxChunks,
  ghxDirectChild,
  ghxItemText,
  parseBrepGrasshopperGhxArchive,
  BrepGrasshopperGhxArchiveError,
  type BrepGrasshopperGhxArchiveNode,
} from './brepGrasshopperGhxArchive.ts';
import {
  BREP_GRASSHOPPER_GHX_NUMBER_PARAMETER_GUID,
  BREP_GRASSHOPPER_GHX_NUMBER_SLIDER_GUID,
} from './brepGrasshopperGhx.ts';
import { createBrepGrasshopperPackagePlan } from './brepGrasshopperPackagePlan.ts';
import {
  BREP_GRASSHOPPER_RHINO_CSHARP_COMPONENT_GUID,
  BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID,
  BREP_GRASSHOPPER_SCRIPT_PARAMETER_GUID,
  createBrepGrasshopperRhinoScriptPlan,
  type BrepGrasshopperRhinoScriptInput,
  type BrepGrasshopperRhinoScriptOutput,
  type BrepGrasshopperRhinoScriptPlan,
} from './brepGrasshopperRhinoScript.ts';

export type BrepGrasshopperExecutableGhxDiagnostic = {
  code: string;
  severity: 'error';
  message: string;
  path?: string;
};

export type BrepGrasshopperExecutableGhxValidationResult = {
  accepted: boolean;
  compatibility: 'supported' | 'unsupported';
  diagnostics: BrepGrasshopperExecutableGhxDiagnostic[];
  parameters: Record<string, number>;
};

function error(
  diagnostics: BrepGrasshopperExecutableGhxDiagnostic[],
  code: string,
  message: string,
  path?: string,
): void {
  diagnostics.push({ code, severity: 'error', message, ...(path ? { path } : {}) });
}

function parseFinite(value: string | undefined): number | undefined {
  if (value == null || value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const combined = (a << 16) | (b << 8) | c;
    result += alphabet[(combined >> 18) & 63];
    result += alphabet[(combined >> 12) & 63];
    result += index + 1 < bytes.length ? alphabet[(combined >> 6) & 63] : '=';
    result += index + 2 < bytes.length ? alphabet[combined & 63] : '=';
  }
  return result;
}

function expectedSourceBase64(source: string): string {
  return bytesToBase64(new TextEncoder().encode(source));
}

function objectContainer(
  object: BrepGrasshopperGhxArchiveNode,
): BrepGrasshopperGhxArchiveNode | undefined {
  return ghxChunk(object, 'Container');
}

function validateNumericControl(
  object: BrepGrasshopperGhxArchiveNode,
  expectedByGuid: ReadonlyMap<
    string,
    Awaited<ReturnType<typeof createBrepGrasshopperPackagePlan>>['controls'][number]
  >,
  mode: 'generated' | 'returned',
  seen: Set<string>,
  parameters: Record<string, number>,
  diagnostics: BrepGrasshopperExecutableGhxDiagnostic[],
  path: string,
): void {
  const componentGuid = ghxItemText(object, 'GUID')?.toLowerCase();
  const container = objectContainer(object);
  const instanceGuid = container
    ? ghxItemText(container, 'InstanceGuid')?.toLowerCase()
    : undefined;
  if (!container || !instanceGuid) {
    error(diagnostics, 'invalid_control', 'Numeric control is missing Container/InstanceGuid.', path);
    return;
  }
  const expected = expectedByGuid.get(instanceGuid);
  if (!expected) {
    error(
      diagnostics,
      'unexpected_control',
      `Numeric control ${instanceGuid} is not owned by the expected Brepia project.`,
      path,
    );
    return;
  }
  if (seen.has(instanceGuid)) {
    error(diagnostics, 'duplicate_control', `Duplicate numeric control ${instanceGuid}.`, path);
    return;
  }
  seen.add(instanceGuid);

  const expectedGuid =
    expected.presentation === 'slider'
      ? BREP_GRASSHOPPER_GHX_NUMBER_SLIDER_GUID
      : BREP_GRASSHOPPER_GHX_NUMBER_PARAMETER_GUID;
  if (componentGuid !== expectedGuid) {
    error(
      diagnostics,
      'control_type_changed',
      `Brepia parameter ${expected.inputId} changed Grasshopper control type.`,
      path,
    );
    return;
  }
  if (ghxItemText(container, 'NickName') !== expected.label) {
    error(
      diagnostics,
      'control_identity_changed',
      `Brepia parameter ${expected.inputId} display identity changed.`,
      path,
    );
  }

  let value: number | undefined;
  if (expected.presentation === 'slider') {
    const slider = ghxChunk(container, 'Slider');
    const min = slider ? parseFinite(ghxItemText(slider, 'Min')) : undefined;
    const max = slider ? parseFinite(ghxItemText(slider, 'Max')) : undefined;
    value = slider ? parseFinite(ghxItemText(slider, 'Value')) : undefined;
    if (
      slider == null ||
      min == null ||
      max == null ||
      value == null ||
      min !== expected.min ||
      max !== expected.max ||
      min >= max ||
      value < min ||
      value > max
    ) {
      error(
        diagnostics,
        'invalid_slider_state',
        `Brepia parameter ${expected.inputId} slider bounds/value are invalid or changed.`,
        path,
      );
      return;
    }
  } else {
    const persistent = ghxChunk(container, 'PersistentData');
    const branch = persistent ? ghxChunk(persistent, 'Branch', '0') : undefined;
    const stored = branch ? ghxChunk(branch, 'Item', '0') : undefined;
    value = stored ? parseFinite(ghxItemText(stored, 'number')) : undefined;
    if (value == null) {
      error(
        diagnostics,
        'invalid_number_state',
        `Brepia parameter ${expected.inputId} persistent value is invalid.`,
        path,
      );
      return;
    }
  }

  if (expected.min != null && value < expected.min) {
    error(
      diagnostics,
      'parameter_out_of_bounds',
      `Brepia parameter ${expected.inputId} is below its canonical minimum.`,
      path,
    );
  }
  if (expected.max != null && value > expected.max) {
    error(
      diagnostics,
      'parameter_out_of_bounds',
      `Brepia parameter ${expected.inputId} exceeds its canonical maximum.`,
      path,
    );
  }
  if (mode === 'generated' && value !== expected.default) {
    error(
      diagnostics,
      'generated_default_mismatch',
      `Generated Brepia parameter ${expected.inputId} differs from its canonical default.`,
      path,
    );
  }
  parameters[expected.inputId] = value;
}

function validateInput(
  parameterData: BrepGrasshopperGhxArchiveNode,
  expected: BrepGrasshopperRhinoScriptInput,
  index: number,
  diagnostics: BrepGrasshopperExecutableGhxDiagnostic[],
): void {
  const path = `script/input:${expected.inputId}`;
  if (ghxItemText(parameterData, 'InputId', String(index)) !== BREP_GRASSHOPPER_SCRIPT_PARAMETER_GUID) {
    error(diagnostics, 'script_input_type_changed', `Script input ${expected.inputId} parameter type changed.`, path);
  }
  const input = ghxChunk(parameterData, 'InputParam', String(index));
  if (!input) {
    error(diagnostics, 'missing_script_input', `Script input ${expected.inputId} is missing.`, path);
    return;
  }
  if (ghxItemText(input, 'InstanceGuid') !== expected.instanceGuid) {
    error(diagnostics, 'script_input_identity_changed', `Script input ${expected.inputId} identity changed.`, path);
  }
  if (
    ghxItemText(input, 'Name') !== expected.variableName ||
    ghxItemText(input, 'NickName') !== expected.nickname
  ) {
    error(diagnostics, 'script_input_identity_changed', `Script input ${expected.inputId} name changed.`, path);
  }
  const expectedSourceCount = expected.sourceObjectGuid ? '1' : '0';
  if (ghxItemText(input, 'SourceCount') !== expectedSourceCount) {
    error(diagnostics, 'script_rewired', `Script input ${expected.inputId} source count changed.`, path);
  }
  const source = ghxItemText(input, 'Source', '0');
  if (expected.sourceObjectGuid ? source !== expected.sourceObjectGuid : source != null) {
    error(diagnostics, 'script_rewired', `Script input ${expected.inputId} was rewired.`, path);
  }
  if (ghxItemText(input, 'TypeHintID') !== expected.typeHintGuid) {
    error(diagnostics, 'script_input_type_changed', `Script input ${expected.inputId} type hint changed.`, path);
  }
  const converter = ghxChunk(input, 'ConverterData');
  if (!converter || ghxItemText(converter, 'TypeName') !== expected.converterType) {
    error(diagnostics, 'script_input_type_changed', `Script input ${expected.inputId} converter changed.`, path);
  }
}

function validateOutput(
  parameterData: BrepGrasshopperGhxArchiveNode,
  expected: BrepGrasshopperRhinoScriptOutput,
  index: number,
  diagnostics: BrepGrasshopperExecutableGhxDiagnostic[],
): void {
  const path = `script/output:${expected.outputId}`;
  if (ghxItemText(parameterData, 'OutputId', String(index)) !== BREP_GRASSHOPPER_SCRIPT_PARAMETER_GUID) {
    error(diagnostics, 'script_output_type_changed', `Script output ${expected.outputId} parameter type changed.`, path);
  }
  const output = ghxChunk(parameterData, 'OutputParam', String(index));
  if (!output) {
    error(diagnostics, 'missing_script_output', `Script output ${expected.outputId} is missing.`, path);
    return;
  }
  if (ghxItemText(output, 'InstanceGuid') !== expected.instanceGuid) {
    error(diagnostics, 'script_output_identity_changed', `Script output ${expected.outputId} identity changed.`, path);
  }
  if (
    ghxItemText(output, 'Name') !== expected.variableName ||
    ghxItemText(output, 'NickName') !== expected.nickname
  ) {
    error(diagnostics, 'script_output_identity_changed', `Script output ${expected.outputId} name changed.`, path);
  }
  if (ghxItemText(output, 'SourceCount') !== '0') {
    error(diagnostics, 'script_output_rewired', `Script output ${expected.outputId} unexpectedly has a source.`, path);
  }
}

function validateScript(
  object: BrepGrasshopperGhxArchiveNode,
  expected: BrepGrasshopperRhinoScriptPlan,
  diagnostics: BrepGrasshopperExecutableGhxDiagnostic[],
): void {
  const path = 'DefinitionObjects/BrepiaScript';
  if (ghxItemText(object, 'GUID') !== BREP_GRASSHOPPER_RHINO_CSHARP_COMPONENT_GUID) {
    error(diagnostics, 'script_type_changed', 'Brepia C# Script component type changed.', path);
  }
  if (ghxItemText(object, 'Lib') !== BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID) {
    error(diagnostics, 'script_library_changed', 'Brepia C# Script library identity changed.', path);
  }
  const container = objectContainer(object);
  if (!container) {
    error(diagnostics, 'missing_script_container', 'Brepia C# Script Container is missing.', path);
    return;
  }
  if (ghxItemText(container, 'InstanceGuid') !== expected.componentInstanceGuid) {
    error(diagnostics, 'script_identity_changed', 'Brepia C# Script instance identity changed.', path);
  }
  if (ghxItemText(container, 'ScriptComponentVersion') !== '3') {
    error(diagnostics, 'script_version_changed', 'Brepia C# Script persistence version changed.', path);
  }

  const parameterData = ghxChunk(container, 'ParameterData');
  if (!parameterData) {
    error(diagnostics, 'missing_script_parameters', 'Brepia C# Script ParameterData is missing.', path);
    return;
  }
  if (ghxItemText(parameterData, 'InputCount') !== String(expected.inputs.length)) {
    error(diagnostics, 'script_input_count_changed', 'Brepia C# Script input count changed.', path);
  }
  if (ghxItemText(parameterData, 'OutputCount') !== String(expected.outputs.length)) {
    error(diagnostics, 'script_output_count_changed', 'Brepia C# Script output count changed.', path);
  }
  expected.inputs.forEach((input, index) =>
    validateInput(parameterData, input, index, diagnostics),
  );
  expected.outputs.forEach((output, index) =>
    validateOutput(parameterData, output, index, diagnostics),
  );

  const script = ghxChunk(container, 'Script');
  if (!script) {
    error(diagnostics, 'missing_script_source', 'Brepia C# Script source chunk is missing.', path);
    return;
  }
  if (ghxItemText(script, 'Text') !== expectedSourceBase64(expected.source)) {
    error(
      diagnostics,
      'script_source_changed',
      'Embedded Brepia C# source changed and is not safe for automatic round-trip.',
      path,
    );
  }
  const language = ghxChunk(script, 'LanguageSpec');
  if (!language || ghxItemText(language, 'Taxon') !== '*.*.csharp') {
    error(diagnostics, 'script_language_changed', 'Brepia script is no longer C#.', path);
  }
}

export async function validateBrepGrasshopperExecutableGhx(
  input: string,
  expectedContract: unknown,
  mode: 'generated' | 'returned' = 'generated',
): Promise<BrepGrasshopperExecutableGhxValidationResult> {
  const diagnostics: BrepGrasshopperExecutableGhxDiagnostic[] = [];
  const parameters: Record<string, number> = {};
  let root: BrepGrasshopperGhxArchiveNode;
  try {
    root = parseBrepGrasshopperGhxArchive(input);
  } catch (caught) {
    if (caught instanceof BrepGrasshopperGhxArchiveError) {
      error(diagnostics, caught.code, caught.message);
    } else {
      error(diagnostics, 'malformed_xml', 'GHX could not be parsed safely.');
    }
    return { accepted: false, compatibility: 'unsupported', diagnostics, parameters };
  }

  if (root.name !== 'Archive' || root.attributes.name !== 'Root') {
    error(diagnostics, 'invalid_root', 'GHX root must be Archive name="Root".');
  }
  const definition = ghxChunk(root, 'Definition');
  const definitionObjects = definition ? ghxChunk(definition, 'DefinitionObjects') : undefined;
  if (!definitionObjects) {
    error(diagnostics, 'missing_definition_objects', 'GHX DefinitionObjects chunk is missing.');
    return { accepted: false, compatibility: 'unsupported', diagnostics, parameters };
  }

  let packagePlan;
  let scriptPlan;
  try {
    [packagePlan, scriptPlan] = await Promise.all([
      createBrepGrasshopperPackagePlan(expectedContract),
      createBrepGrasshopperRhinoScriptPlan(expectedContract),
    ]);
  } catch (caught) {
    error(
      diagnostics,
      'invalid_expected_contract',
      `Expected Brepia contract cannot produce the supported GHX subset: ${
        caught instanceof Error ? caught.message : String(caught)
      }`,
    );
    return { accepted: false, compatibility: 'unsupported', diagnostics, parameters };
  }

  const objects = ghxChunks(definitionObjects, 'Object');
  const declared = Number.parseInt(ghxItemText(definitionObjects, 'ObjectCount') ?? '', 10);
  if (!Number.isSafeInteger(declared) || declared !== objects.length) {
    error(diagnostics, 'object_count_mismatch', 'GHX ObjectCount does not match serialized objects.');
  }
  if (objects.length !== packagePlan.controls.length + 1) {
    error(
      diagnostics,
      'unexpected_graph_objects',
      'Returned GHX contains objects outside the strict Brepia v1 round-trip graph.',
    );
  }

  const expectedControls = new Map(
    packagePlan.controls.map((control) => [control.instanceGuid, control]),
  );
  const seenControls = new Set<string>();
  let scriptCount = 0;

  objects.forEach((object, index) => {
    const guid = ghxItemText(object, 'GUID')?.toLowerCase();
    if (
      guid === BREP_GRASSHOPPER_GHX_NUMBER_SLIDER_GUID ||
      guid === BREP_GRASSHOPPER_GHX_NUMBER_PARAMETER_GUID
    ) {
      validateNumericControl(
        object,
        expectedControls,
        mode,
        seenControls,
        parameters,
        diagnostics,
        `DefinitionObjects/Object[${index}]`,
      );
      return;
    }
    if (guid === BREP_GRASSHOPPER_RHINO_CSHARP_COMPONENT_GUID) {
      scriptCount += 1;
      if (scriptCount > 1) {
        error(diagnostics, 'duplicate_script', 'GHX contains more than one Brepia C# Script.');
      } else {
        validateScript(object, scriptPlan, diagnostics);
      }
      return;
    }
    error(
      diagnostics,
      'unsupported_object',
      `Grasshopper object ${guid ?? '(missing GUID)'} is outside the strict Brepia v1 graph.`,
      `DefinitionObjects/Object[${index}]`,
    );
  });

  for (const control of packagePlan.controls) {
    if (!seenControls.has(control.instanceGuid)) {
      error(
        diagnostics,
        'missing_parameter_control',
        `Expected Brepia parameter control ${control.inputId} is missing.`,
      );
    }
  }
  if (scriptCount !== 1) {
    error(diagnostics, 'missing_script', 'Expected exactly one Brepia C# Script component.');
  }

  const accepted = diagnostics.length === 0;
  return {
    accepted,
    compatibility: accepted ? 'supported' : 'unsupported',
    diagnostics,
    parameters,
  };
}
