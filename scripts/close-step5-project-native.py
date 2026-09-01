from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# Persistence/retry/restore regression now uses a real multi-file snapshot.
replace_once(
    'tests/importedArtifact.test.ts',
    "      files: [{ path: 'bracket.scad', content: source }],",
    "      files: [\n"
    "        { path: 'bracket.scad', content: source },\n"
    "        {\n"
    "          path: 'lib/support.scad',\n"
    "          content: 'module support_part() { sphere(r = 2); }\\n',\n"
    "        },\n"
    "      ],",
)
replace_once(
    'tests/importedArtifact.test.ts',
    "    expect(entrypointCode).not.toBe(code);\n",
    "    expect(entrypointCode).not.toBe(code);\n"
    "    expect(parameterEditedArtifact.project.files).toContainEqual({\n"
    "      path: 'lib/support.scad',\n"
    "      content: 'module support_part() { sphere(r = 2); }\\n',\n"
    "    });\n",
)

# Built-in Parametric instructions: the complete artifact is the complete project.
replace_once(
    'config/ai/instructions/generative.md',
    """The build_parametric_model tool input is the artifact shown to the user:

- title: short object name
- version: \"v1\"
- code: complete raw OpenSCAD code, no markdown, no code fences
""",
    """The build_parametric_model tool input is the complete artifact shown to the user:

- title: short object name
- version: \"v1\"
- project: complete normalized OpenSCAD project snapshot with `schemaVersion: 1`, a stable `entrypointPath`, and every required `{ path, content }` source file

For follow-up CAD edits, preserve every unchanged support file from the current artifact, change only files required by the request, and keep `entrypointPath` stable unless restructuring is genuinely necessary. You may edit the entrypoint, support files, or both. Every stored path must be a relative `.scad` project path. Never return a legacy top-level `code` field and never omit a support file required by the returned source.
""",
)
replace_once(
    'config/ai/instructions/generative.md',
    'build_parametric_model again with a corrected complete script.',
    'build_parametric_model again with a corrected complete project snapshot.',
)
replace_once(
    'config/ai/instructions/generative.md',
    'a corrected complete OpenSCAD script.',
    'a corrected complete OpenSCAD project snapshot.',
)
replace_once(
    'config/ai/instructions/generative.md',
    "Your build_parametric_model call's `code` should look like:",
    "For a one-file model, the entrypoint file inside `build_parametric_model.project.files` can look like:",
)

Path('config/ai/instructions/tool-build-parametric-model.md').write_text(
    "Create or update the complete normalized OpenSCAD project artifact. The `project` field is a full snapshot: preserve unchanged support files, change only files required by the request, keep `entrypointPath` stable when possible, and never emit a legacy top-level `code` field. After the browser compiles it, inspect the returned multi-view preview sheet and call this tool again with another complete project snapshot if the model needs a revision.\n"
)

Path('config/ai/instructions/transport-opencode.md').write_text("""You are an OpenCode CAD worker reached from pCAD.

Treat <current_pcad_artifact> as the authoritative complete OpenSCAD project currently shown by pCAD.
Use the supplied pCAD system and task context faithfully.
The model for the session is selected by pCAD; do not change it.

Tool and environment guidance:

- Work from the supplied conversation and complete normalized CAD project state.
- Preserve every unchanged support file across follow-up edits and change only files required by the request.
- You may intentionally edit the entrypoint, support files, or both; keep `entrypointPath` stable unless restructuring is genuinely necessary.
- Use pcad_validate when it is available to validate the complete OpenSCAD project before returning it.
- Do not use unrelated filesystem, shell, network, web, or external tools for the CAD task.
- pCAD converts the completed structured project artifact into its build_parametric_model call; do not wait for that tool inside OpenCode.
- Never return a legacy top-level `code` field or omit a support file required by the returned source.

Continuation behavior:

- When <pcad_build_result> is present, continue the same CAD task from the authoritative project snapshot.
- If another geometry revision is needed, return a corrected complete project snapshot.
- If the current project already satisfies the task, return the concise final user-facing message.
- When <pcad_validation_failure> is present, correct the complete OpenSCAD project using the supplied compiler diagnostics and return the corrected project without explaining the failed draft.
""")

Path('config/ai/instructions/transport-codex.md').write_text("""You are a Codex CAD worker reached from pCAD.

Treat <current_pcad_artifact> as the authoritative complete OpenSCAD project currently shown by pCAD.
Use the supplied pCAD system and task context faithfully.
The model for the session is selected by pCAD; do not change it.

Environment guidance:

- Work from the supplied conversation and complete normalized CAD project state.
- Preserve every unchanged support file across follow-up edits and change only files required by the request.
- You may intentionally edit the entrypoint, support files, or both; keep `entrypointPath` stable unless restructuring is genuinely necessary.
- Do not depend on filesystem changes, network access, external files, or unrelated tools for the CAD task.
- pCAD converts the completed structured project artifact into its build_parametric_model call; do not wait for that tool inside Codex.
- Never return a legacy top-level `code` field or omit a support file required by the returned source.

Continuation behavior:

- When <pcad_build_result> is present, continue the same CAD task from the authoritative project snapshot.
- If another geometry revision is needed, return a corrected complete project snapshot.
- If the current project already satisfies the task, return the concise final user-facing message.
""")

# Plan closeout: Step 5 complete, Step 6 next.
replace_once(
    'docs/multifile_openscad_workspace_plan.md',
    '### Step 5 — Project-native AI editing and message persistence — NEXT',
    '### Step 5 — Project-native AI editing and message persistence — COMPLETE',
)
replace_once(
    'docs/multifile_openscad_workspace_plan.md',
    "Before implementation, inspect current `shared/chatAi.ts`, Parametric tool schemas/instructions, AI message persistence, `metadata.originalCode` or equivalent baseline handling, OpenCode/external-agent transport, and current conversation restore/retry behavior.\n",
    "Step 5 closeout confirms `shared/chatAi.ts` and persisted `build_parametric_model` parts already use full project artifacts; retry/branch/restore keep the selected message-tree project snapshot; Customizer `metadata.originalCode` remains an entrypoint-only reset baseline while parameter edits replace only the entrypoint inside the full project; and OpenCode/Codex now receive, validate and return complete normalized projects rather than `{code,...}` payloads. New external-agent writes reject the legacy top-level `code` contract.\n",
)
replace_once(
    'docs/multifile_openscad_workspace_plan.md',
    'Steps 1–4 are complete. Start Step 5 in a fresh chat after reconciling the current branch implementation against this plan and `docs/multifile_openscad_workspace_status.md`.',
    'Steps 1–5 are complete. Step 6 is next and must begin from the verified Step 5 checkpoint after reconciling the current branch against this plan and `docs/multifile_openscad_workspace_status.md`.',
)

# Status closeout.
status = Path('docs/multifile_openscad_workspace_status.md')
text = status.read_text()
text = text.replace('Steps 1–4 are complete and manually accepted.', 'Steps 1–4 are complete and manually accepted. Step 5 is implemented and automatically verified.', 1)
anchor = '## UX follow-up outside the current step\n'
step5 = """## Step 5 — complete

AI editing and message persistence are project-native end to end:

- `shared/chatAi.ts` continues to define `build_parametric_model` with `{ title, version, project }`; no top-level artifact `code` was reintroduced;
- persisted AI tool parts carry the complete normalized `OpenScadProject`, so DB-style JSON reload, history restore, retry branches and active-branch follow-ups retain the selected full project snapshot;
- Customizer parameters intentionally remain entrypoint-focused; `metadata.originalCode` remains only the entrypoint reset/default baseline, while parameter changes replace the entrypoint content inside the existing complete project and preserve support files;
- built-in Parametric instructions now require complete normalized project snapshots, preservation of unchanged support files, targeted entrypoint/support-file edits, stable `entrypointPath` when possible and safe relative `.scad` paths;
- OpenCode streaming and OpenCode/Codex CLI transports now send `<current_pcad_artifact>` as the complete project rather than an `<openscad>` single-file wrapper;
- external-agent final results use `{ project, message }`, normalize the returned project and emit `build_parametric_model` with `project`; legacy `{ code, message }` results no longer create CAD tool calls;
- server-side external-agent validation materializes the complete normalized project into an isolated temporary directory and compiles its actual entrypoint, so project-local support-file references are validated together. This is validation-only and does not implement the Step 6 conversation-workspace mirror.

Step 5 regression coverage verifies multi-file follow-up context, unchanged support-file preservation, intentional support-file revision, stable entrypoint handling, project-only external-agent result parsing, DB-style persistence, Customizer entrypoint edits, retry branch isolation and restored-history project continuity.

Primary Step 5 implementation checkpoints:

- `4c7eb483be5b5aad93dc5ddb1ef92d912200c76f` — project-native external-agent result contract;
- `d15f54b` — project-native OpenCode/Codex transports, complete-project validation and multi-file transport regressions.

Automated Step 5 implementation verification before closeout:

- dependency audit: PASS, 0 vulnerabilities;
- 52 test files / 420 tests: PASS;
- typecheck: PASS;
- lint with zero warnings: PASS;
- production client/SSR/Nitro build: PASS;
- `git diff --check`: PASS.

"""
if anchor not in text:
    raise SystemExit('missing status UX anchor')
text = text.replace(anchor, step5 + anchor, 1)
text = text.replace('- Step 5 full multi-file AI/external-agent editing protocol and message persistence;\n', '', 1)
start = text.find('## Fresh-chat handoff for Step 5\n')
if start < 0:
    raise SystemExit('missing Step 5 handoff')
text = text[:start] + """## Next — Step 6

Step 6 is now the next bounded implementation step: project-native local conversation-workspace snapshots. Reconcile the existing best-effort local mirror against the complete persisted `OpenScadProject` artifact before changing it. Do not mix Step 7 relative assets or later workspace UX into Step 6.
"""
status.write_text(text)

print('Step 5 closeout codemod applied')
