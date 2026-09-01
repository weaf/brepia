from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    found = text.count(old)
    if found != expected:
        raise SystemExit(f"{path}: expected {expected}, found {found}: {old[:100]!r}")
    p.write_text(text.replace(old, new))


replace_exact(
    "src/components/viewer/MeshGifPreview.tsx",
    """    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = getSafeFilename(
      conversation.title || 'animation',
      'animation',
    );
    link.click();

    URL.revokeObjectURL(link.href);
""",
    """    const objectUrl = URL.createObjectURL(blob);
    const safeBaseName = getSafeFilename(
      conversation.title || 'animation',
      'animation',
    );
    const filename = safeBaseName.toLowerCase().endsWith('.gif')
      ? safeBaseName
      : `${safeBaseName}.gif`;

    // Keep the anchor attached and the object URL alive long enough for
    // mobile browsers to hand the download off to their download manager.
    // Revoking synchronously after click() can turn an otherwise valid
    // blob download into a no-op on Android/WebKit-based browsers.
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
""",
)

replace_exact(
    "src/components/TextAreaChat.tsx",
    """  ArrowUp,
  ImagePlus,
  Images,
""",
    """  ArrowUp,
  ImagePlus,
  FileUp,
  Images,
""",
)

replace_exact(
    "src/components/TextAreaChat.tsx",
    """                    input.accept = `${VALID_IMAGE_FORMATS.join(', ')}, ${
                      type === 'creative'
                        ? SUPPORTED_MESH_EXTENSIONS.join(', ')
                        : '.stl'
                    }`;
""",
    """                    input.accept = VALID_IMAGE_FORMATS.join(', ');
""",
)

image_button_tail = """                </Button>
              </div>
            )}

            {onTypeChange && (
"""
mesh_button = """                </Button>
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant=\"outline\"
                  className=\"flex h-8 w-8 items-center gap-2 rounded-lg border border-[#2a2a2a] bg-adam-background-2 p-0 text-sm text-adam-text-secondary hover:bg-adam-bg-secondary-dark\"
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept =
                      type === 'creative'
                        ? `${SUPPORTED_MESH_EXTENSIONS.join(', ')}, application/octet-stream`
                        : '.stl, model/stl, application/sla, application/vnd.ms-pki.stl, application/octet-stream';
                    input.onchange = () => handleItemsChange(input.files);
                    input.click();
                  }}
                  disabled={disabled}
                  aria-label={
                    type === 'creative' ? 'Upload 3D model' : 'Upload STL model'
                  }
                >
                  <FileUp className=\"h-5 w-5\" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {type === 'creative' ? 'Upload 3D model' : 'Upload STL model'}
              </TooltipContent>
            </Tooltip>

            {onTypeChange && (
"""
replace_exact("src/components/TextAreaChat.tsx", image_button_tail, mesh_button)

print("Applied Step 2 mobile download/upload closeout patch.")
