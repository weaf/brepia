from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1))


mesh = Path("src/components/viewer/MeshGifPreview.tsx")
replace_once(
    mesh,
    "        link.click();\n        link.remove();\n        return 'downloaded';",
    "        link.click();\n        link.remove();\n\n        preparedDownloadRef.current = null;\n        window.setTimeout(\n          () => URL.revokeObjectURL(preparedDownload.objectUrl),\n          1000,\n        );\n        return 'downloaded';",
)

download_menu = Path("src/components/viewer/DownloadMenu.tsx")
replace_once(
    download_menu,
    "import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';",
    "import {\n  ReactNode,\n  useCallback,\n  useEffect,\n  useMemo,\n  useRef,\n  useState,\n} from 'react';",
)
replace_once(
    download_menu,
    "import { MeshGifPreview } from './MeshGifPreview';",
    "import {\n  MeshGifPreview,\n  type GifDownloadHandle,\n} from './MeshGifPreview';",
)
replace_once(
    download_menu,
    "  const [isGifReady, setIsGifReady] = useState(false);\n  const gifRef = useRef<{ downloadGIF: () => Promise<void> } | null>(null);",
    "  const [isGifReady, setIsGifReady] = useState(false);\n  const [isGifPrepared, setIsGifPrepared] = useState(false);\n  const gifRef = useRef<GifDownloadHandle | null>(null);",
)
replace_once(
    download_menu,
    "  const [isDownloadingFBX, setIsDownloadingFBX] = useState(false);\n\n  // Check if this model supports both GLB and FBX (quad topology models)",
    "  const [isDownloadingFBX, setIsDownloadingFBX] = useState(false);\n\n  useEffect(() => {\n    setIsGifPrepared(false);\n  }, [meshData.id]);\n\n  // Check if this model supports both GLB and FBX (quad topology models)",
)
old_download = '''  const downloadGIF = useCallback(() => {\n    posthog.capture('3d_model_download', {\n      meshId: meshData.id,\n      model_name: meshData?.prompt.model || 'Unknown Model',\n      format: 'GIF',\n      conversation_id: conversation.id,\n    });\n\n    setIsDownloadingGIF(true);\n\n    setTimeout(async () => {\n      try {\n        if (gifRef.current && isGifReady) {\n          await gifRef.current.downloadGIF();\n        }\n      } catch (error) {\n        Sentry.captureException(error, {\n          extra: {\n            meshId: meshData.id,\n            format: 'GIF',\n          },\n        });\n\n        toast({\n          title: 'Error',\n          description: 'Failed to generate GIF. Please try again.',\n          variant: 'destructive',\n        });\n      } finally {\n        setIsDownloadingGIF(false);\n        setIsDropdownOpen(false);\n      }\n    }, 0);\n  }, [isGifReady, meshData, conversation.id, toast]);'''
new_download = '''  const downloadGIF = useCallback(async () => {\n    posthog.capture('3d_model_download', {\n      meshId: meshData.id,\n      model_name: meshData?.prompt.model || 'Unknown Model',\n      format: 'GIF',\n      conversation_id: conversation.id,\n    });\n\n    setIsDownloadingGIF(true);\n\n    try {\n      if (gifRef.current && isGifReady) {\n        // Do not defer this call through setTimeout. When the GIF has already\n        // been prepared, MeshGifPreview performs its anchor click before its\n        // first await, preserving the fresh user activation from this menu\n        // selection on mobile browsers.\n        const result = await gifRef.current.downloadGIF();\n        setIsGifPrepared(result === 'prepared');\n      }\n    } catch (error) {\n      Sentry.captureException(error, {\n        extra: {\n          meshId: meshData.id,\n          format: 'GIF',\n        },\n      });\n\n      toast({\n        title: 'Error',\n        description: 'Failed to generate GIF. Please try again.',\n        variant: 'destructive',\n      });\n    } finally {\n      setIsDownloadingGIF(false);\n      setIsDropdownOpen(false);\n    }\n  }, [isGifReady, meshData, conversation.id, toast]);'''
replace_once(download_menu, old_download, new_download)
replace_once(
    download_menu,
    "                label=\"Downloading GIF\"",
    "                label=\"Preparing GIF\"",
)
replace_once(
    download_menu,
    "              {isDownloadingGIF ? 'Downloading...' : 'Animation'}",
    "              {isDownloadingGIF\n                ? 'Preparing...'\n                : isGifPrepared\n                  ? 'Download'\n                  : 'Generate animation'}",
)

print("Applied DownloadMenu two-stage GIF follow-up")
