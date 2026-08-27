#!/usr/bin/env bash
#
# render.sh — turn a Brepia benchmark .scad into an orbiting GIF (and an optional
# multi-view contact sheet for inspection). Mirrors how Brepia previews models in
# the browser: BOSL2/MCAD on the library path, color() parts preserved, a clean
# orbit around the vertical axis.
#
# Usage:
#   ./render.sh model.scad                 -> model.gif  (orbit)
#   ./render.sh model.scad out.gif         -> out.gif
#   ./render.sh --sheet model.scad         -> model.sheet.png (iso/front/right/top)
#
# Env knobs (sane defaults):
#   FRAMES=36 SIZE=520 ELEV=62 FPS=24 COLORSCHEME=Tomorrow BG=#0d1117
#
set -euo pipefail

# --- locate the OpenSCAD CLI (snapshot/nightly first, then stable) ------------
find_openscad() {
  if [[ -n "${OPENSCAD_BIN:-}" && -x "${OPENSCAD_BIN}" ]]; then echo "${OPENSCAD_BIN}"; return; fi
  for c in \
    "/Applications/OpenSCAD (Nightly).app/Contents/MacOS/OpenSCAD" \
    "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD" \
    "$(command -v openscad 2>/dev/null || true)"; do
    [[ -n "$c" && -x "$c" ]] && { echo "$c"; return; }
  done
  echo "ERROR: OpenSCAD CLI not found. Set OPENSCAD_BIN." >&2; exit 1
}
OSCAD="$(find_openscad)"

# BOSL2 / BOSL / MCAD live here (unzipped from public/libraries/*.zip).
export OPENSCADPATH="${OPENSCADPATH:-/tmp/oscad-libs}"

FRAMES="${FRAMES:-36}"
SIZE="${SIZE:-520}"
ELEV="${ELEV:-62}"
FPS="${FPS:-24}"
COLORSCHEME="${COLORSCHEME:-Tomorrow}"   # clean near-white backdrop
RENDER_FLAG="${RENDER_FLAG:---render}"   # full (manifold) render; --preview is faster but CSG-fuzzy

# --- temp workspace ----------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Resolve SCAD file relative to current working directory, not temp dir.
SHEET=false
if [[ "${1:-}" == "--sheet" ]]; then SHEET=true; shift; fi
IN="${1:?Usage: render.sh [--sheet] model.scad [out.gif]}"
OUT="${2:-${IN%.scad}.gif}"

# --- render one frame --------------------------------------------------------
render_frame() {
  local az="$1" out="$2"
  "$OSCAD" \
    --hardwarnings \
    --colorscheme="$COLORSCHEME" \
    --imgsize="${SIZE},${SIZE}" \
    --camera="0,0,0,${ELEV},0,${az},0" \
    --autocenter --viewall \
    "$RENDER_FLAG" \
    -o "$out" "$IN" >/dev/null 2>&1
}

# --- optional contact sheet -------------------------------------------------
if $SHEET; then
  echo "Rendering contact sheet → ${OUT%.gif}.sheet.png"
  render_frame  45 "$TMP/iso.png"
  render_frame   0 "$TMP/front.png"
  render_frame  90 "$TMP/right.png"
  render_frame 180 "$TMP/back.png"
  magick montage "$TMP/iso.png" "$TMP/front.png" "$TMP/right.png" "$TMP/back.png" \
    -tile 2x2 -geometry +2+2 "${OUT%.gif}.sheet.png"
  exit 0
fi

# --- orbit frames ------------------------------------------------------------
echo "Rendering $FRAMES frames with OpenSCAD…"
for ((i=0; i<FRAMES; i++)); do
  az=$(python3 - <<PY
print(45 + $i * 360 / $FRAMES)
PY
)
  printf '\r  frame %d/%d' "$((i+1))" "$FRAMES"
  render_frame "$az" "$TMP/frame-$(printf '%03d' "$i").png"
done
echo

# --- GIF ---------------------------------------------------------------------
# Optimise frames before GIF assembly. `-layers Optimize` gives a big size win
# while preserving the rendered colours/background.
echo "Assembling GIF → $OUT"
magick -delay "$((100/FPS))" -loop 0 "$TMP"/frame-*.png \
  -layers Optimize "$OUT"

echo "Done: $OUT"
