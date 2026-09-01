from pathlib import Path


def replace_all(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    text = p.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing expected fixture in {path}: {old!r}')
        text = text.replace(old, new)
    p.write_text(text)


replace_all(
    'tests/opencodePersistentSession.test.ts',
    [
        (
            "              code: 'width = 40;\\nheight = 20;\\ncube([width, width, height]);',",
            "              project: project(\n"
            "                'width = 40;\\nheight = 20;\\ncube([width, width, height]);',\n"
            "              ),",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[0] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[0]) },",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[1] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[1]) },",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[2] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[2]) },",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[3] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[3]) },",
        ),
    ],
)

replace_all(
    'tests/cliAgentPersistentSession.test.ts',
    [
        (
            "              code: 'cube([10,10,10]);',",
            "              project: project('cube([10,10,10]);'),",
        ),
        (
            "              code: 'width = 20;\\ncube([width, 20, 10]);',",
            "              project: project('width = 20;\\ncube([width, 20, 10]);'),",
        ),
        (
            "            code: codes[turn - 1],",
            "            project: project(codes[turn - 1]),",
        ),
    ],
)

print('Step 5 remaining project fixtures fixed')
