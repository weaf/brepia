from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1))


mesh = Path("src/components/viewer/MeshGifPreview.tsx")
replace_once(
    mesh,
    "const fragmentShader = quantizeFragmentShader;\n\nexport function MeshGifPreview({",
    "const fragmentShader = quantizeFragmentShader;\n\nexport type GifDownloadActionResult =\n  | 'prepared'\n  | 'downloaded'\n  | 'unavailable';\n\nexport type GifDownloadHandle = {\n  downloadGIF: () => Promise<GifDownloadActionResult>;\n};\n\nexport function MeshGifPreview({",
)
replace_once(
    mesh,
    "  ref: React.RefObject<{ downloadGIF: () => Promise<void> } | null>;",
    "  ref: React.RefObject<GifDownloadHandle | null>;",
)
replace_once(
    mesh,
    "  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);\n\n  // Cleanup function for Three.js objects",
    "  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);\n  const preparedDownloadRef = useRef<{\n    objectUrl: string;\n    filename: string;\n  } | null>(null);\n\n  const revokePreparedDownload = useCallback(() => {\n    if (!preparedDownloadRef.current) return;\n    URL.revokeObjectURL(preparedDownloadRef.current.objectUrl);\n    preparedDownloadRef.current = null;\n  }, []);\n\n  // Cleanup function for Three.js objects",
)
replace_once(
    mesh,
    "  useEffect(() => {\n    return () => {\n      cleanupThreeJS();\n    };\n  }, [cleanupThreeJS]);\n\n  useEffect(() => {\n    if (externalGltf !== undefined) {",
    "  useEffect(() => {\n    return () => {\n      cleanupThreeJS();\n      revokePreparedDownload();\n    };\n  }, [cleanupThreeJS, revokePreparedDownload]);\n\n  useEffect(() => {\n    revokePreparedDownload();\n    if (externalGltf !== undefined) {",
)
replace_once(
    mesh,
    "  }, [meshId, externalGltf]);",
    "  }, [meshId, externalGltf, revokePreparedDownload]);",
)
old_download = '''  const downloadGIF = useCallback(async () => {\n    if (!canvas) {\n      return;\n    }\n\n    setIsGenerating(true);\n    isGeneratingRef.current = true;\n\n    let buffer: BlobPart | undefined;\n\n    try {\n      buffer = await generateGIF(4, 30);\n    } catch (error) {\n      console.error('Error generating GIF:', error);\n    } finally {\n      setIsGenerating(false);\n      isGeneratingRef.current = false;\n    }\n\n    // Download\n    if (!buffer) {\n      return;\n    }\n\n    const blob = new Blob([buffer], { type: 'image/gif' });\n\n    const objectUrl = URL.createObjectURL(blob);\n    const safeBaseName = getSafeFilename(\n      conversation.title || 'animation',\n      'animation',\n    );\n    const filename = safeBaseName.toLowerCase().endsWith('.gif')\n      ? safeBaseName\n      : `${safeBaseName}.gif`;\n\n    // Keep the anchor attached and the object URL alive long enough for\n    // mobile browsers to hand the download off to their download manager.\n    // Revoking synchronously after click() can turn an otherwise valid\n    // blob download into a no-op on Android/WebKit-based browsers.\n    const link = document.createElement('a');\n    link.href = objectUrl;\n    link.download = filename;\n    link.rel = 'noopener';\n    link.style.display = 'none';\n    document.body.appendChild(link);\n    link.click();\n    link.remove();\n\n    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);\n  }, [canvas, generateGIF, conversation.title, setIsGenerating]);'''
new_download = '''  const downloadGIF = useCallback(\n    async (): Promise<GifDownloadActionResult> => {\n      // Mobile browsers can drop transient user activation while the GIF is\n      // generated. If a GIF is already prepared, perform the anchor click\n      // synchronously before the first await so the download remains tied to\n      // this fresh user gesture.\n      const preparedDownload = preparedDownloadRef.current;\n      if (preparedDownload) {\n        const link = document.createElement('a');\n        link.href = preparedDownload.objectUrl;\n        link.download = preparedDownload.filename;\n        link.rel = 'noopener';\n        link.style.display = 'none';\n        document.body.appendChild(link);\n        link.click();\n        link.remove();\n        return 'downloaded';\n      }\n\n      if (!canvas) {\n        return 'unavailable';\n      }\n\n      setIsGenerating(true);\n      isGeneratingRef.current = true;\n\n      let buffer: BlobPart | undefined;\n\n      try {\n        buffer = await generateGIF(4, 30);\n      } catch (error) {\n        console.error('Error generating GIF:', error);\n      } finally {\n        setIsGenerating(false);\n        isGeneratingRef.current = false;\n      }\n\n      if (!buffer) {\n        return 'unavailable';\n      }\n\n      const blob = new Blob([buffer], { type: 'image/gif' });\n      const objectUrl = URL.createObjectURL(blob);\n      const safeBaseName = getSafeFilename(\n        conversation.title || 'animation',\n        'animation',\n      );\n      const filename = safeBaseName.toLowerCase().endsWith('.gif')\n        ? safeBaseName\n        : `${safeBaseName}.gif`;\n\n      // Keep the prepared URL alive until the user explicitly taps Download\n      // (or until the model changes/unmounts). The second tap is then a pure\n      // synchronous download gesture, which is reliable on Android browsers.\n      preparedDownloadRef.current = { objectUrl, filename };\n      return 'prepared';\n    },\n    [canvas, generateGIF, conversation.title, setIsGenerating],\n  );'''
replace_once(mesh, old_download, new_download)

openscad = Path("src/components/viewer/OpenSCADGifPreview.tsx")
replace_once(
    openscad,
    "import { MeshGifPreview } from './MeshGifPreview';",
    "import {\n  MeshGifPreview,\n  type GifDownloadHandle,\n} from './MeshGifPreview';",
)
replace_once(
    openscad,
    "  ref: React.RefObject<{ downloadGIF: () => Promise<void> } | null>;",
    "  ref: React.RefObject<GifDownloadHandle | null>;",
)
replace_once(
    openscad,
    "  const meshGifRef = useRef<{ downloadGIF: () => Promise<void> } | null>(null);",
    "  const meshGifRef = useRef<GifDownloadHandle | null>(null);",
)
replace_once(
    openscad,
    "  useImperativeHandle(ref, () => ({\n    downloadGIF: async () => {\n      await meshGifRef.current?.downloadGIF();\n    },\n  }));",
    "  useImperativeHandle(ref, () => ({\n    downloadGIF: async () => {\n      const handle = meshGifRef.current;\n      return handle ? handle.downloadGIF() : 'unavailable';\n    },\n  }));",
)

share = Path("src/components/ui/ShareContent.tsx")
replace_once(
    share,
    "import { Suspense, useRef, useState } from 'react';",
    "import { Suspense, useEffect, useRef, useState } from 'react';",
)
replace_once(
    share,
    "import { MeshGifPreview } from '../viewer/MeshGifPreview';",
    "import {\n  MeshGifPreview,\n  type GifDownloadHandle,\n} from '../viewer/MeshGifPreview';",
)
replace_once(
    share,
    "  const [readyToDownload, setReadyToDownload] = useState(false);\n\n  const downloadGifRef = useRef<{ downloadGIF: () => Promise<void> } | null>(\n    null,\n  );",
    "  const [readyToDownload, setReadyToDownload] = useState(false);\n  const [gifPrepared, setGifPrepared] = useState(false);\n\n  const downloadGifRef = useRef<GifDownloadHandle | null>(null);",
)
replace_once(
    share,
    "  const handlePublicClick = () => {\n    onPrivacyChange('public');\n    copyToClipboard();\n  };\n\n  return (",
    "  const handlePublicClick = () => {\n    onPrivacyChange('public');\n    copyToClipboard();\n  };\n\n  useEffect(() => {\n    setGifPrepared(false);\n  }, [meshId, openscadProject]);\n\n  const handleGifAction = async () => {\n    const result = await downloadGifRef.current?.downloadGIF();\n    setGifPrepared(result === 'prepared');\n  };\n\n  return (",
)
replace_once(
    share,
    "          onClick={() => downloadGifRef.current?.downloadGIF()}",
    "          onClick={handleGifAction}",
)
replace_once(
    share,
    "          ) : (\n            'Download GIF'\n          )}",
    "          ) : gifPrepared ? (\n            'Download GIF'\n          ) : (\n            'Generate GIF'\n          )}",
)

print("Applied two-stage mobile GIF download patch")
