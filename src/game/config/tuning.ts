/**
 * ─────────────────────────────────────────────────────────────────────────
 *  JUST ONE SIP — GAME TUNING
 * ─────────────────────────────────────────────────────────────────────────
 *  Every number that changes how the game *feels* lives here.
 *
 *  Units:
 *   - distances are in world pixels (px) at the 720px-tall design resolution
 *   - "up" is positive inside the simulation (screen Y is flipped at render)
 *   - time is seconds unless the name ends in `Ms`
 *
 *  The dev-only debug panel (`?debug` or `npm run dev`) mutates the live
 *  `TUNING` object, so changes apply immediately without a restart.
 */
export const TUNING = {
    /** Fixed simulation timestep (s). Physics always advances in these steps. */
    fixedStep: 1 / 120,

    // ── World & route ───────────────────────────────────────────────────
    /** World pixels per metre (used only for the distance read-out). */
    pxPerMeter: 60,
    /** Auto speed in metres per second (7 m/s ≈ 25 km/h — believable city pace). */
    speedMps: 7,
    /** Route length in metres. 280 m at 7 m/s ≈ 40 s ride. */
    routeMeters: 280,

    // ── Auto geometry ───────────────────────────────────────────────────
    /** Distance between rear and front axles (px). The auto art is scaled to match (art is drawn at 190). */
    wheelbasePx: 247,
    wheelRadiusPx: 31,
    /** Where the auto sits horizontally, as a fraction of screen width. */
    autoAnchorFraction: 0.3,
    /** Where the passenger's seat is along the wheelbase (0 = rear axle). */
    seatFraction: 0.12,

    // ── Bottle & drinking ───────────────────────────────────────────────
    capacityMl: 250,
    /** You must have drunk at least this much when the bottle empties to win. */
    winMinConsumedMl: 195,
    /** Flow rate into the mouth while the bottle is correctly at the lips. */
    drinkRateMlPerSec: 11,

    // ── Arm ─────────────────────────────────────────────────────────────
    /** Time to raise the bottle from lap to lips. */
    raiseMs: 400,
    /** Time to lower the bottle from lips to lap. */
    lowerMs: 250,
    /** Arm progress (0..1) at which water can flow — i.e. bottle is at the lips. */
    mouthThreshold: 0.98,

    // ── Suspension (auto body) ──────────────────────────────────────────
    /** Spring stiffness of each wheel corner (1/s²). */
    suspensionStiffness: 230,
    /** Damping of each wheel corner (1/s). */
    suspensionDamping: 11,
    /** Global multiplier on every hazard impulse. 1 = default, 0 = no bumps. */
    suspensionStrength: 1,
    /** Velocity (px/s) of a "1.0" strength kick. */
    kickBasePxPerSec: 260,

    // ── Passenger rig (relative to the seat) ────────────────────────────
    /** Head is loose and wobbly — it lags behind the auto. */
    headStiffness: 150,
    headDamping: 7,
    /** How much of the auto's kick the head receives directly (low = lags more). */
    headKick: 0.15,
    /** Hand/arm is braced — it follows the auto closely. */
    handStiffness: 330,
    handDamping: 22,
    handKick: 0.85,
    torsoStiffness: 260,
    torsoDamping: 14,
    torsoKick: 0.55,
    /** Front-wheel hits are felt less in the rear seat. */
    frontWheelFeel: 0.55,

    // ── Spilling ────────────────────────────────────────────────────────
    /** Vertical head-vs-bottle misalignment (px) tolerated while drinking. */
    alignTolerancePx: 6,
    /** A tipped bottle that misses the mouth gushes at this rate (ml/s, scaled by misalignment). */
    missSpillMlPerSec: 45,
    /** Global multiplier on all spill amounts. */
    spillSensitivity: 1,
    /** ml lost from a severity-1 jolt with the bottle fully tipped. */
    sloshMlPerImpact: 20,
    /** Upright bottles only slosh on jolts stronger than this severity... */
    uprightSloshThreshold: 1.3,
    /** ...and only when fuller than this fraction. */
    uprightSloshMinFill: 0.8,

    // ── Road generation ─────────────────────────────────────────────────
    /** Multiplies every generated gap between hazards. */
    obstacleSpacingScale: 1,
    /** Minimum clear time a player gets after the rear wheel leaves a hazard. */
    reactionTimeSec: 0.75,
    /** Gap between two hazards that form one "combo" block. */
    comboGapSec: 0.35,
    /** How long the auto takes to settle after a hazard (used for fairness checks). */
    settleSec: 0.2,
};

export type Tuning = typeof TUNING;
export type TuningKey = keyof Tuning;

/** Pristine copy for resetting / tests. */
export const DEFAULT_TUNING: Readonly<Tuning> = Object.freeze({ ...TUNING });

export function cloneTuning(overrides: Partial<Tuning> = {}): Tuning {
    return { ...DEFAULT_TUNING, ...overrides };
}

/** Derived helpers. */
export const speedPx = (t: Tuning) => t.speedMps * t.pxPerMeter;
export const routePx = (t: Tuning) => t.routeMeters * t.pxPerMeter;
export const wheelbaseSec = (t: Tuning) => t.wheelbasePx / speedPx(t);
