from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected block in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# Streaming OpenCode transport: artifact snapshots and validation become project-native.
replace_once(
    "src/server/opencode.ts",
    "import { env } from './env';\n",
    "import { env } from './env';\nimport {\n  normalizeOpenScadProject,\n  type OpenScadProject,\n} from '@shared/openScadProject';\n",
)
replace_once(
    "src/server/opencode.ts",
    "import { validateOpenScad } from './openScadValidation';",
    "import { validateOpenScadProject } from './openScadValidation';",
)
replace_once(
    "src/server/opencode.ts",
    """type ParametricArtifactSnapshot = {
  title: string;
  version: string;
  code: string;
};

function parseArtifactInput(
  value: unknown,
): ParametricArtifactSnapshot | undefined {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return undefined;
    }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return undefined;
  }
  const record = candidate as Record<string, unknown>;
  if (typeof record['code'] !== 'string' || !record['code'].trim()) {
    return undefined;
  }
  return {
    title:
      typeof record['title'] === 'string' && record['title'].trim()
        ? record['title'].trim()
        : 'Current pCAD model',
    version:
      typeof record['version'] === 'string' && record['version'].trim()
        ? record['version'].trim()
        : 'v1',
    code: record['code'],
  };
}
""",
    """type ParametricArtifactSnapshot = {
  title: string;
  version: string;
  project: OpenScadProject;
};

function parseArtifactInput(
  value: unknown,
): ParametricArtifactSnapshot | undefined {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return undefined;
    }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return undefined;
  }
  const record = candidate as Record<string, unknown>;
  let project: OpenScadProject;
  try {
    project = normalizeOpenScadProject(record['project'] as OpenScadProject);
  } catch {
    return undefined;
  }
  return {
    title:
      typeof record['title'] === 'string' && record['title'].trim()
        ? record['title'].trim()
        : 'Current pCAD model',
    version:
      typeof record['version'] === 'string' && record['version'].trim()
        ? record['version'].trim()
        : 'v1',
    project,
  };
}
""",
)
replace_once(
    "src/server/opencode.ts",
    """        `title: ${artifact.title}`,
        `version: ${artifact.version}`,
        '<openscad>',
        artifact.code,
        '</openscad>',
""",
    """        JSON.stringify({
          title: artifact.title,
          version: artifact.version,
          project: artifact.project,
        }),
""",
)
replace_once(
    "src/server/opencode.ts",
    "if (result.code) {\n    return finishWithParametricToolCall(text, finishPart);\n  }",
    "if (result.project) {\n    return finishWithParametricToolCall(text, finishPart);\n  }",
)
replace_once(
    "src/server/opencode.ts",
    """      const candidate = parseAgentResult(resultText);
      if (!candidate.code) break;

      const validation = await validateOpenScad(candidate.code, ac.signal);
""",
    """      const candidate = parseAgentResult(resultText);
      if (!candidate.project) break;

      const validation = await validateOpenScadProject(
        candidate.project,
        ac.signal,
      );
""",
)
replace_once(
    "src/server/opencode.ts",
    """        state.totalText = JSON.stringify({
          code: '',
          message: `OpenSCAD validation failed after ${runtime.validationAttempts} attempts: ${validation.diagnostics ?? 'unknown compiler error'}`,
        });
""",
    """        state.totalText = JSON.stringify({
          message: `OpenSCAD validation failed after ${runtime.validationAttempts} attempts: ${validation.diagnostics ?? 'unknown compiler error'}`,
        });
""",
)

# CLI OpenCode/Codex transport: pass and return the same complete project snapshot.
replace_once(
    "src/server/cliAgents.ts",
    "import { env } from './env';\n",
    "import { env } from './env';\nimport {\n  normalizeOpenScadProject,\n  type OpenScadProject,\n} from '@shared/openScadProject';\n",
)
replace_once(
    "src/server/cliAgents.ts",
    """type ParametricArtifactSnapshot = {
  title: string;
  version: string;
  code: string;
};
""",
    """type ParametricArtifactSnapshot = {
  title: string;
  version: string;
  project: OpenScadProject;
};
""",
)
replace_once(
    "src/server/cliAgents.ts",
    """  const record = candidate as Record<string, unknown>;
  if (typeof record['code'] !== 'string' || !record['code'].trim()) {
    return undefined;
  }
  return {
""",
    """  const record = candidate as Record<string, unknown>;
  let project: OpenScadProject;
  try {
    project = normalizeOpenScadProject(record['project'] as OpenScadProject);
  } catch {
    return undefined;
  }
  return {
""",
)
replace_once(
    "src/server/cliAgents.ts",
    """    code: record['code'],
  };
}
""",
    """    project,
  };
}
""",
)
replace_once(
    "src/server/cliAgents.ts",
    """        `title: ${artifact.title}`,
        `version: ${artifact.version}`,
        '<openscad>',
        artifact.code,
        '</openscad>',
""",
    """        JSON.stringify({
          title: artifact.title,
          version: artifact.version,
          project: artifact.project,
        }),
""",
)
replace_once(
    "src/server/cliAgents.ts",
    "if (result.code) {",
    "if (result.project) {",
)
replace_once(
    "src/server/cliAgents.ts",
    """            code: result.code,
            message: result.message || 'Model generated.',
""",
    """            project: result.project,
            message: result.message || 'Model generated.',
""",
)
replace_once(
    "src/server/cliAgents.ts",
    "finishReason: finishReason(result.code ? 'tool-calls' : 'stop'),",
    "finishReason: finishReason(result.project ? 'tool-calls' : 'stop'),",
)

# Validate a complete normalized project in an isolated temporary directory.
Path("src/server/openScadValidation.ts").write_text("""import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  OPENSCAD_COMPILE_TIMEOUT_MS,
  OPENSCAD_MAX_OUTPUT_BYTES,
} from '@/lib/openScadLimits';
import {
  normalizeOpenScadProject,
  type OpenScadProject,
} from '@shared/openScadProject';

export type OpenScadValidation = {
  valid: boolean;
  exitCode: number | null;
  outputBytes: number;
  diagnostics: string | null;
};

function compile(
  sourcePath: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<{ exitCode: number | null; diagnostics: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      '/usr/bin/openscad',
      ['--export-format', 'binstl', '--quiet', '-o', outputPath, sourcePath],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let diagnostics = '';
    const stop = () => child.kill('SIGKILL');
    const timer = setTimeout(stop, OPENSCAD_COMPILE_TIMEOUT_MS);
    signal?.addEventListener('abort', stop, { once: true });
    child.stderr.on('data', (chunk: Buffer) => {
      diagnostics = `${diagnostics}${chunk}`.slice(-12_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      resolve({ exitCode, diagnostics: diagnostics.trim() });
    });
  });
}

function invalid(diagnostics: string): OpenScadValidation {
  return { valid: false, exitCode: null, outputBytes: 0, diagnostics };
}

export async function validateOpenScadProject(
  project: OpenScadProject,
  signal?: AbortSignal,
): Promise<OpenScadValidation> {
  let normalized: OpenScadProject;
  try {
    normalized = normalizeOpenScadProject(project);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : String(error));
  }

  const dir = await mkdtemp(join(tmpdir(), 'pcad-openscad-project-'));
  const outputPath = join(dir, 'candidate.stl');
  try {
    for (const file of normalized.files) {
      const target = join(dir, ...file.path.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
    }

    const sourcePath = join(dir, ...normalized.entrypointPath.split('/'));
    const result = await compile(sourcePath, outputPath, signal);
    if (result.exitCode !== 0) {
      return {
        valid: false,
        exitCode: result.exitCode,
        outputBytes: 0,
        diagnostics: result.diagnostics || null,
      };
    }

    const outputBytes = (await stat(outputPath)).size;
    if (outputBytes > OPENSCAD_MAX_OUTPUT_BYTES) {
      return {
        valid: false,
        exitCode: result.exitCode,
        outputBytes,
        diagnostics: `OpenSCAD output exceeds ${OPENSCAD_MAX_OUTPUT_BYTES} bytes.`,
      };
    }

    return {
      valid: true,
      exitCode: result.exitCode,
      outputBytes,
      diagnostics: result.diagnostics || null,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function validateOpenScad(
  code: string,
  signal?: AbortSignal,
): Promise<OpenScadValidation> {
  return validateOpenScadProject(
    {
      schemaVersion: 1,
      entrypointPath: 'candidate.scad',
      files: [{ path: 'candidate.scad', content: code }],
    },
    signal,
  );
}
""")

print("Step 5 source codemod applied")
