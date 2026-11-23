/**
 * Road hazard definitions. Each hazard type is fully data-driven:
 * tweak widths, depths, impact strength and spacing here.
 */
export type HazardType = 'pothole' | 'speedBreaker' | 'uneven' | 'waterlogged';

/** A velocity impulse applied when a wheel reaches `u` (0..1 across the hazard). */
export interface KickPoint {
    u: number;
    /** Signed relative strength. + pushes the wheel up, − drops it. */
    v: number;
}

export type ProfileShape = 'dip' | 'hump' | 'ripple';

export interface HazardDef {
    type: HazardType;
    /** Width range in px. */
    widthPx: [number, number];
    /** Depth (dip) or height (hump) range in px. Always positive here. */
    depthPx: [number, number];
    /** Impact strength range — multiplies every kick. */
    impact: [number, number];
    /** Clear road (s) needed after this hazard's rear-wheel exit before the next block. */
    minSpacingSec: number;
    /** 1 easy … 3 hard. Used by the generator to unlock types per section. */
    difficulty: number;
    shape: ProfileShape;
    kicks: KickPoint[];
    /** Head rattle (px per unit severity) — fast teeth-chattering vibration. 0 = none. */
    rattlePx: number;
}

export const HAZARDS: Record<HazardType, HazardDef> = {
    pothole: {
        type: 'pothole',
        widthPx: [70, 105],
        depthPx: [12, 17],
        impact: [0.9, 1.1],
        minSpacingSec: 0.8,
        difficulty: 1,
        shape: 'dip',
        rattlePx: 0,
        // drop in, then a sharp rebound on the far edge
        kicks: [
            { u: 0.12, v: -0.55 },
            { u: 0.85, v: 1.0 },
        ],
    },
    speedBreaker: {
        type: 'speedBreaker',
        widthPx: [110, 145],
        depthPx: [14, 19],
        impact: [0.62, 0.78],
        minSpacingSec: 0.75,
        difficulty: 1,
        shape: 'hump',
        rattlePx: 0,
        // gradual, predictable rise and fall
        kicks: [
            { u: 0.25, v: 0.8 },
            { u: 0.75, v: -0.4 },
        ],
    },
    uneven: {
        type: 'uneven',
        widthPx: [170, 240],
        depthPx: [4, 6],
        impact: [0.38, 0.48],
        minSpacingSec: 0.7,
        difficulty: 2,
        shape: 'ripple',
        rattlePx: 28,
        // a rattle of small jolts that add up
        kicks: [
            { u: 0.1, v: 0.6 },
            { u: 0.35, v: 0.6 },
            { u: 0.6, v: 0.6 },
            { u: 0.85, v: 0.6 },
        ],
    },
    waterlogged: {
        type: 'waterlogged',
        widthPx: [115, 150],
        depthPx: [18, 23],
        impact: [1.25, 1.45],
        minSpacingSec: 1.0,
        difficulty: 3,
        shape: 'dip',
        rattlePx: 4,
        // you can't see the bottom — it's deep
        kicks: [
            { u: 0.1, v: -0.7 },
            { u: 0.86, v: 1.05 },
        ],
    },
};

export const HAZARD_TYPES = Object.keys(HAZARDS) as HazardType[];
