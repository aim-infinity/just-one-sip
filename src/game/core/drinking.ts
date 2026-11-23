import type { Tuning } from '../config/tuning';
import type { Arm } from './arm';
import type { Bottle } from './bottle';

export interface DrinkResult {
    drunk: number;
    missed: number;
    /** 0..1 — how well mouth and bottle line up this step (1 = perfect). */
    alignment: number;
}

/** 1 when within tolerance, falling to 0 at twice the tolerance. */
export function alignmentFactor(misalign: number, tolerance: number): number {
    const m = Math.abs(misalign);
    if (m <= tolerance) return 1;
    return Math.max(0, 1 - (m - tolerance) / tolerance);
}

/**
 * Continuous drinking. While the bottle is at the lips and lined up with the
 * mouth, water flows in at the drink rate. When a jolt knocks mouth and bottle
 * apart, the tipped bottle gushes onto the face instead (faster than sipping).
 */
export function stepDrinking(t: Tuning, arm: Arm, bottle: Bottle, misalign: number, dt: number): DrinkResult {
    if (!arm.atLips || bottle.isEmpty) return { drunk: 0, missed: 0, alignment: 1 };
    const flow = t.drinkRateMlPerSec * dt;
    const a = alignmentFactor(misalign, t.alignTolerancePx);
    const drunk = bottle.drink(flow * a);
    const missed = bottle.spill(t.missSpillMlPerSec * dt * (1 - a) * t.spillSensitivity);
    return { drunk, missed, alignment: a };
}

/**
 * Instant slosh when the auto is jolted. Tipped bottles lose a lot, upright
 * bottles only lose water on very hard hits when nearly full.
 * `severity` is |kick strength| (≈1 for a normal pothole rebound).
 */
export function sloshAmount(t: Tuning, tip: number, fill: number, severity: number): number {
    if (fill <= 0) return 0;
    const tipped = t.sloshMlPerImpact * severity * severity * tip * (0.6 + 0.4 * fill);
    let upright = 0;
    if (tip < 0.15 && fill > t.uprightSloshMinFill && severity > t.uprightSloshThreshold) {
        upright = (severity - t.uprightSloshThreshold) * 6;
    }
    return (tipped + upright) * t.spillSensitivity;
}
