export type BrepProductGapTargetId = 'A' | 'B' | 'C' | 'D' | 'E';

export type BrepProductGapTarget = {
  id: BrepProductGapTargetId;
  name: string;
  question: string;
  prompt: string;
  perturbation: {
    label: string;
    value: number;
  };
  allowTerminalWithoutProject?: boolean;
};

const COMMON_BOUNDARY = [
  'Use only the current canonical Native BRep schema exposed by Brepia.',
  'Keep schemaVersion 1.',
  'All published dimensions must be effective on authoritative result geometry; do not add decorative or orphan controls.',
  'Use derived scalar expressions for repeated dimensional relationships instead of baking duplicate values.',
  'Do not invent unsupported node types, raw topology indices, build123d/Python, STEP authority, or hidden geometry.',
  'If the requested shape is not faithfully representable with the supported schema, say so concisely instead of fabricating a workaround.',
].join(' ');

export const BREP_PRODUCT_GAP_TARGETS: Readonly<
  Record<BrepProductGapTargetId, BrepProductGapTarget>
> = {
  A: {
    id: 'A',
    name: 'Hollow enclosure with openings and lid interface',
    question:
      'Does the accepted expression + profile + multi-loop + Boolean surface remain practical, or is shell/thickness a demonstrated product gap?',
    prompt: [
      'Create a native BRep project named Product Gap A Hollow Enclosure.',
      'Model one authoritative hollow electronics enclosure body with an open top.',
      'Nominal overall size is 300 mm wide, 200 mm deep, and 120 mm high with 4 mm walls and a 4 mm bottom.',
      'Include a continuous internal seating ledge or rebate near the open top that could locate a removable lid.',
      'Cut one rectangular cable opening through the front wall, centered horizontally, nominally 60 mm wide by 30 mm high.',
      'Publish Width (id width, default 300, min 240, max 360, step 10 mm), Depth (id depth, default 200, min 160, max 260, step 10 mm), Height (id height, default 120, min 90, max 160, step 5 mm), Wall Thickness (id wall, default 4, min 3, max 6, step 1 mm), and Opening Width (id openingWidth, default 60, min 40, max 90, step 5 mm).',
      'The hollow cavity, ledge, and cable opening must affect the authoritative result rather than existing as disconnected helper geometry.',
      COMMON_BOUNDARY,
    ].join(' '),
    perturbation: { label: 'Width', value: 320 },
  },
  B: {
    id: 'B',
    name: 'Turned mechanical part',
    question:
      'Is bounded full revolve plus Boolean composition sufficient, or is partial, multi-loop, or arbitrary-axis revolve actually required?',
    prompt: [
      'Create a native BRep project named Product Gap B Turned Shaft.',
      'Model one authoritative turned mechanical part using the current full-revolve capability.',
      'The part should have an asymmetric stepped axial/radial profile over a nominal 120 mm overall length, a largest nominal outer diameter of 80 mm, at least one smaller shoulder, and one annular groove or radial recess represented directly in the revolved profile.',
      'Add a concentric through bore with nominal diameter 24 mm using supported Boolean composition if needed.',
      'Publish Outer Diameter (id outerDiameter, default 80, min 60, max 100, step 5 mm), Length (id length, default 120, min 90, max 160, step 5 mm), and Bore Diameter (id boreDiameter, default 24, min 12, max 36, step 2 mm).',
      'Keep the final result a single positive-volume body and preserve the stepped/grooved turned character when dimensions change.',
      COMMON_BOUNDARY,
    ].join(' '),
    perturbation: { label: 'Outer Diameter', value: 90 },
  },
  C: {
    id: 'C',
    name: 'Fabricated mounting plate / flange',
    question:
      'Is the existing finishing/topology surface a real blocker, or merely missing visual/manufacturing polish?',
    prompt: [
      'Create a native BRep project named Product Gap C Mounting Flange.',
      'Model one authoritative fabricated mounting flange or plate, nominally 240 mm by 160 mm by 12 mm.',
      'Use a multi-loop profile for a central circular opening.',
      'Create six equal through bolt holes as a true circular pattern of one supported cutter around a nominal 140 mm bolt-circle diameter, then subtract the pattern from the plate.',
      'Where the current semantic fillet selector can safely finish the outer vertical plate edges without changing hole identity, apply a 5 mm fillet; if that selector cannot express this faithfully, omit the fillet and do not fake it.',
      'Publish Plate Width (id plateWidth, default 240, min 200, max 300, step 10 mm), Bolt Circle Diameter (id boltCircleDiameter, default 140, min 110, max 180, step 5 mm), and Hole Diameter (id holeDiameter, default 12, min 8, max 18, step 1 mm).',
      'The central opening and patterned bolt holes must all cut the authoritative result.',
      COMMON_BOUNDARY,
    ].join(' '),
    perturbation: { label: 'Bolt Circle Diameter', value: 160 },
  },
  D: {
    id: 'D',
    name: 'Architectural / cabinet layout',
    question:
      'Does the accepted language solve ordinary architectural and orthogonal construction without baked relationships or manual repetition?',
    prompt: [
      'Create a native BRep project named Product Gap D Cabinet Layout.',
      'Model one authoritative wall cabinet carcass, nominally 900 mm wide, 400 mm deep, and 1800 mm high, using 18 mm material.',
      'The carcass must include two sides, top, bottom, and a back or rear structural panel, with a large open front.',
      'Add three repeated horizontal shelf panels using one supported pattern operation rather than manually duplicating shelf nodes.',
      'Add a rectangular cable/service opening through the rear panel that actually intersects and removes material.',
      'Use derived dimensions so internal widths and placements follow overall dimensions and material thickness.',
      'Publish Width (id width, default 900, min 700, max 1100, step 50 mm), Height (id height, default 1800, min 1500, max 2200, step 100 mm), Depth (id depth, default 400, min 300, max 500, step 25 mm), Material Thickness (id materialThickness, default 18, min 12, max 25, step 1 mm), and Shelf Spacing (id shelfSpacing, default 400, min 300, max 500, step 25 mm).',
      'Prefer one authoritative single result when touching panel geometry can be validly unified; otherwise use the existing explicit instance-set semantics and make that choice clear in the final message.',
      COMMON_BOUNDARY,
    ].join(' '),
    perturbation: { label: 'Width', value: 1000 },
  },
  E: {
    id: 'E',
    name: 'Bent path-based object',
    question: 'Is sweep/path modeling the next true representational gap?',
    prompt: [
      'Create a native BRep project named Product Gap E Bent Handrail.',
      'Model a constant circular-section handrail whose centerline follows two perpendicular straight legs joined by one smooth tangent 90 degree bend.',
      'Use nominal straight-leg lengths of 1000 mm and 700 mm, nominal centerline bend radius 150 mm, and nominal tube diameter 40 mm.',
      'Publish Bend Radius (id bendRadius, default 150, min 100, max 250, step 10 mm) and Tube Diameter (id tubeDiameter, default 40, min 30, max 60, step 5 mm).',
      'The smooth bend must be true defining path geometry. Do not approximate the bend with many unrelated boxes, cylinders, short facets, or decorative disconnected pieces merely to satisfy the request.',
      COMMON_BOUNDARY,
    ].join(' '),
    perturbation: { label: 'Bend Radius', value: 180 },
    allowTerminalWithoutProject: true,
  },
};

export function brepProductGapTarget(
  id: string | undefined,
): BrepProductGapTarget {
  const normalized = id?.trim().toUpperCase() as
    BrepProductGapTargetId | undefined;
  const target = normalized ? BREP_PRODUCT_GAP_TARGETS[normalized] : undefined;
  if (!target) {
    throw new Error(
      `BREPIA_BREP_GAP_TARGET must be one of ${Object.keys(BREP_PRODUCT_GAP_TARGETS).join(', ')}.`,
    );
  }
  return target;
}
