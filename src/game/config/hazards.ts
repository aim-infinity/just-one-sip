/**
 * Road hazard catalogue. Each hazard type is fully data-driven: tweak sizes,
 * impact, spacing and behaviour here. Visuals live in render/hazardArt.ts,
 * keyed by the same type name.
 *
 * Two families:
 *  - **bumps** move the wheels vertically (kicks at points across the hazard)
 *  - **brakes** make the driver slow down/stop, throwing the passenger forward
 */
export type HazardType =
    | 'pothole'
    | 'massivePothole'
    | 'speedBreaker'
    | 'uneven'
    | 'waterlogged'
    | 'manhole'
    | 'rumbleStrip'
    | 'gravel'
    | 'cow'
    | 'signal'
    | 'cutIn';

/** A velocity impulse applied when a wheel reaches `u` (0..1 across the hazard). */
export interface KickPoint {
    u: number;
    /** Signed relative strength. + pushes the wheel up, − drops it. */
    v: number;
}

export type ProfileShape = 'dip' | 'hump' | 'ripple' | 'flat';

export interface BrakeDef {
    /** Seconds to slow from full speed to `slowTo`. */
    decelSec: number;
    /** Speed factor at the bottom of the brake (0 = full stop). */
    slowTo: number;
    /** Seconds spent at `slowTo`. */
    holdSec: number;
    /** Seconds to get back to full speed. */
    recoverSec: number;
    /** Forward jolt severity when braking starts (× impact). */
    jolt: number;
    /** Backward lurch severity when pulling away again (× impact). */
    lurch: number;
}

export interface HazardDef {
    type: HazardType;
    /** Width range in px. For brake hazards: trigger point → obstacle. */
    widthPx: [number, number];
    /** Depth (dip) or height (hump) range in px. Always positive here. */
    depthPx: [number, number];
    /** Impact strength range — multiplies every kick / jolt. */
    impact: [number, number];
    /** Clear road (s) needed after this hazard's rear-wheel exit before the next block. */
    minSpacingSec: number;
    /** 1 easy … 3 hard (informational; sections decide what appears where). */
    difficulty: number;
    shape: ProfileShape;
    kicks: KickPoint[];
    /** Head rattle (px per unit severity) — fast teeth-chattering vibration. 0 = none. */
    rattlePx: number;
    /** Present for hazards that make the driver brake (front wheel triggers). */
    brake?: BrakeDef;
    /** Can appear as the second half of a combo block. */
    comboable: boolean;
}

const even = (n: number, v: number, alt = false): KickPoint[] =>
    Array.from({ length: n }, (_, i) => ({ u: (i + 0.5) / n, v: alt && i % 2 ? -v * 0.8 : v }));

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
        comboable: true,
        // drop in, then a sharp rebound on the far edge
        kicks: [
            { u: 0.12, v: -0.55 },
            { u: 0.85, v: 1.0 },
        ],
    },
    massivePothole: {
        type: 'massivePothole',
        // A crater, not a pothole. Exactly one per ride (placed by
        // MASSIVE_POTHOLE in difficulty.ts, never from section weights) and
        // drawn with barricades so it's unmistakable. Drinking through its
        // rebound launches the passenger through the roof (see simulation.ts).
        // Its punishment is ejection: since it's on every ride, surviving it
        // hits like a normal pothole (kick strength); the much deeper profile
        // still makes the wheel visibly drop further.
        widthPx: [150, 175],
        depthPx: [22, 26],
        impact: [1.0, 1.1],
        minSpacingSec: 1.4,
        difficulty: 3,
        shape: 'dip',
        rattlePx: 6,
        comboable: false,
        kicks: [
            { u: 0.1, v: -0.7 },
            { u: 0.88, v: 0.9 },
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
        comboable: true,
        // a longer rolling rise, then a jolt as the auto comes down
        kicks: [
            { u: 0.3, v: 0.5 },
            { u: 0.8, v: -0.95 },
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
        rattlePx: 12,
        comboable: true,
        // repair patch: small vibrations you can usually keep drinking through
        kicks: even(4, 0.45),
    },
    waterlogged: {
        type: 'waterlogged',
        widthPx: [115, 150],
        // uncertain depth: every puddle looks the same, some are shallow,
        // some are much deeper (impact scales with the hidden depth)
        depthPx: [8, 24],
        impact: [0.6, 1.5],
        minSpacingSec: 1.0,
        difficulty: 3,
        shape: 'dip',
        rattlePx: 4,
        comboable: false,
        // you can't see the bottom — it's deep
        kicks: [
            { u: 0.1, v: -0.7 },
            { u: 0.86, v: 1.05 },
        ],
    },
    manhole: {
        type: 'manhole',
        widthPx: [52, 62],
        depthPx: [6, 8],
        impact: [0.75, 0.9],
        minSpacingSec: 0.7,
        difficulty: 1,
        shape: 'dip',
        rattlePx: 10,
        comboable: true,
        // small, sharp, clanky
        kicks: [
            { u: 0.2, v: -0.5 },
            { u: 0.8, v: 0.85 },
        ],
    },
    rumbleStrip: {
        type: 'rumbleStrip',
        widthPx: [150, 190],
        depthPx: [3, 4],
        impact: [0.3, 0.36],
        minSpacingSec: 0.6,
        difficulty: 1,
        shape: 'ripple',
        rattlePx: 22,
        comboable: true,
        // brrrrrrr — sippable if you accept a little loss
        kicks: even(7, 0.5),
    },
    gravel: {
        type: 'gravel',
        widthPx: [360, 460],
        depthPx: [3, 5],
        impact: [0.36, 0.44],
        minSpacingSec: 0.8,
        difficulty: 2,
        shape: 'ripple',
        rattlePx: 26,
        comboable: false,
        // metro-construction diversion: long, loose, rattly
        kicks: even(9, 0.55, true),
    },
    cow: {
        type: 'cow',
        widthPx: [230, 260],
        depthPx: [0, 0],
        impact: [0.95, 1.1],
        minSpacingSec: 1.2,
        difficulty: 2,
        shape: 'flat',
        rattlePx: 0,
        comboable: false,
        kicks: [],
        // sudden brake for a cow ambling across
        brake: { decelSec: 0.35, slowTo: 0.18, holdSec: 0.45, recoverSec: 0.9, jolt: 1.1, lurch: 0.45 },
    },
    signal: {
        type: 'signal',
        widthPx: [120, 140],
        depthPx: [0, 0],
        impact: [0.9, 1],
        minSpacingSec: 0.9,
        difficulty: 1,
        shape: 'flat',
        rattlePx: 0,
        comboable: false,
        kicks: [],
        // red light: gentle stop, a free sip, then the lurch when it goes green
        brake: { decelSec: 0.7, slowTo: 0, holdSec: 1.8, recoverSec: 1.0, jolt: 0.55, lurch: 0.5 },
    },
    cutIn: {
        type: 'cutIn',
        widthPx: [200, 230],
        depthPx: [0, 0],
        impact: [1.0, 1.1],
        minSpacingSec: 1.1,
        difficulty: 2,
        shape: 'flat',
        rattlePx: 0,
        comboable: false,
        kicks: [],
        // a scooter swerves in from the left — sudden hard brake
        brake: { decelSec: 0.25, slowTo: 0.35, holdSec: 0.2, recoverSec: 0.8, jolt: 1.15, lurch: 0.4 },
    },
};

export const HAZARD_TYPES = Object.keys(HAZARDS) as HazardType[];

/** Brake-family hazards that only some drivers meet (not in the base sections). */
export const DRIVER_ONLY: HazardType[] = ['cutIn'];

/** Hazards worth lowering the bottle for (used for reactions / warnings). */
export const isMajor = (type: HazardType) => {
    const d = HAZARDS[type];
    return !!d.brake || d.impact[1] >= 0.75;
};
