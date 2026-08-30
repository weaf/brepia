from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:140]!r}")
    write(path, text.replace(old, new, 1))


replace_once(
    'src/lib/defaultModels.ts',
    "  if (normalized && selectableModels) {\n    const selectableIds = new Set(selectableModels.map((model) => model.id));\n    if (selectableIds.has(normalized)) return normalized;\n    return selectableModels[0]?.id ?? UNCONFIGURED_MODEL_ID;\n  }\n\n  if (normalized && creativeModelEnabled(normalized)) return normalized;\n",
    "  if (selectableModels) {\n    const selectableIds = new Set(selectableModels.map((model) => model.id));\n    if (normalized && selectableIds.has(normalized)) return normalized;\n    return selectableModels[0]?.id ?? UNCONFIGURED_MODEL_ID;\n  }\n\n  if (normalized && creativeModelEnabled(normalized)) return normalized;\n",
)

for path in ['src/server/imageGen.ts', 'src/server/falMesh.ts']:
    text = read(path)
    text = text.replace('generateImageWithGptImage2', 'generateImageWithOpenAiImageTool')
    text = text.replace('GptImage2Result', 'OpenAiImageResult')
    text = text.replace('gpt-image-2', 'configured OpenAI image model')
    write(path, text)

replace_once(
    'src/server/imageGen.ts',
    '// const response = await openAI.responses.create({',
    'const response = await openAI.responses.create({',
)

print('Applied routing verification fixes')
