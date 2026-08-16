---
name: pcad-openscad-review
description: Use when creating or repairing a pCAD OpenSCAD model. Requires validation with pcad_validate before returning the final JSON artifact.
---

# pCAD OpenSCAD review

Use this workflow for every pCAD CAD request.

1. Produce one complete OpenSCAD candidate with meaningful named parameters.
2. Call `pcad_validate` with that entire candidate.
3. Read every diagnostic. Correct the whole script, not a fragment, and
   validate again if it failed.
4. Use at most three validation calls. Do not return a non-empty `code` value
   unless the last validation response says `valid: true`.
5. Return exactly one JSON object with `code` and `message`, never markdown or
   an explanation around it.

The validator is the compile authority. A visually plausible draft is not a
valid pCAD artifact until it passes.
