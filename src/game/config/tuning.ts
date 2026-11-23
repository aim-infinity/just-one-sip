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
    /** World pixels per metre. Matches the auto's drawn size (≈2.5 m wheelbase-to-bumper),
     *  so on-screen speed looks like the real m/s value. */
    pxPerMeter: 100,
    /** Multiplies the whole speed curve (see SPEED_PROFILE below). 1 = default. */
    speedScale: 1,
    /** Route length in metres. ≈40 s ride along SPEED_PROFILE. */
    routeMeters: 290,

    // ── Auto geometry ───────────────────────────────────────────────────
    /** Distance between rear and front axles (px). The auto art is scaled to match (art is drawn at 190). */
    wheelbasePx: 247,
    wheelRadiusPx: 31,
    /** Where the auto sits horizontally, as a fraction of screen width. */
    autoAnchorFraction: 0.24,
    /** Where the passenger's seat is along the wheelbase (0 = rear axle). */
    seatFraction: 0.12,

    // ── Bottle & drinking ───────────────────────────────────────────────
    capacityMl: 250,
    /** Finish the bottle before your stop to win — spills never block a win.
     *  You only lose by arriving with water left, or by spilling every last drop. */
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

    // ── Braking (cows, signals) — throws the passenger forward ─────────
    /** Horizontal velocity (px/s) of a severity-1 braking jolt. */
    brakeKickPxPerSec: 150,
    /** Head is thrown forward the most, the braced hand the least. */
    brakeHeadKick: 1.0,
    brakeTorsoKick: 0.55,
    brakeHandKick: 0.3,
    /** Nose-dive of the auto body per unit braking severity (px/s). */
    brakeDivePxPerSec: 120,
    headXStiffness: 120,
    headXDamping: 8,
    torsoXStiffness: 220,
    torsoXDamping: 14,
    handXStiffness: 300,
    handXDamping: 20,

    // ── Spilling ────────────────────────────────────────────────────────
    /** Vertical head-vs-bottle misalignment (px) tolerated while drinking. */
    alignTolerancePx: 6,
    /** A tipped bottle that misses the mouth gushes at this rate (ml/s, scaled by misalignment). */
    missSpillMlPerSec: 45,
    /** Global multiplier on all spill amounts. */
    spillSensitivity: 1,
    /** ml lost from a severity-1 jolt with the bottle fully tipped. */
    sloshMlPerImpact: 24,
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

/**
 * Speed curve over the route: [progress 0..1, metres/second].
 * Capped at 9 m/s (≈32 km/h) — difficulty comes from timing, not runaway speed.
 */
export const SPEED_PROFILE: [number, number][] = [
    [0, 6],
    [0.3, 6.6],
    [0.7, 8],
    [1, 9],
];

/** Speed (px/s) at a given route progress (0..1). */
export function speedPxAt(t: Tuning, progress: number): number {
    const p = Math.min(1, Math.max(0, progress));
    let mps = SPEED_PROFILE[SPEED_PROFILE.length - 1][1];
    for (let i = 1; i < SPEED_PROFILE.length; i++) {
        const [p1, v1] = SPEED_PROFILE[i];
        if (p <= p1) {
            const [p0, v0] = SPEED_PROFILE[i - 1];
            mps = v0 + ((v1 - v0) * (p - p0)) / (p1 - p0 || 1);
            break;
        }
    }
    return mps * t.speedScale * t.pxPerMeter;
}

/** Starting speed (px/s) — also the constant speed of practice/tutorial rides. */
export const speedPx = (t: Tuning) => speedPxAt(t, 0);
export const routePx = (t: Tuning) => t.routeMeters * t.pxPerMeter;
/** Route progress (0..1) when the *front* wheel is at world x. */
export const progressAtFront = (t: Tuning, x: number) => (x - t.wheelbasePx) / routePx(t);
