import type { HazardType } from './hazards';

/**
 * Difficulty is shaped by *timing* and a gently rising, capped speed
 * (see SPEED_PROFILE in tuning.ts). The route is split into three sections by
 * fraction of distance travelled.
 */
export interface SectionConfig {
    name: 'opening' | 'middle' | 'final';
    /** Section applies while route progress < `until` (0..1). */
    until: number;
    /** Relative spawn weights. Omitted / 0 = never in this section. */
    weights: Partial<Record<HazardType, number>>;
    /** Clear-road gap between hazard blocks, in seconds of travel [min, max]. */
    gapSec: [number, number];
    /** Chance a block becomes a two-hazard combo. */
    comboChance: number;
    /** Every N blocks, force a generous safe drinking window (0 = off). */
    safeEvery: number;
    safeGapSec: number;
}

export const SECTIONS: SectionConfig[] = [
    {
        name: 'opening',
        until: 0.25,
        weights: { pothole: 3, speedBreaker: 3, manhole: 2, signal: 1 },
        gapSec: [3.4, 4.2],
        comboChance: 0,
        safeEvery: 0,
        safeGapSec: 0,
    },
    {
        name: 'middle',
        until: 0.75,
        weights: { pothole: 4, speedBreaker: 2, uneven: 2, waterlogged: 1, manhole: 2, rumbleStrip: 2, cow: 1.5, signal: 1, gravel: 1 },
        gapSec: [3.0, 3.9],
        comboChance: 0.2,
        safeEvery: 3,
        safeGapSec: 4.0,
    },
    {
        name: 'final',
        until: 1.01,
        weights: { pothole: 4, speedBreaker: 1, uneven: 2, waterlogged: 3, manhole: 2, rumbleStrip: 1, cow: 2, gravel: 1.5 },
        gapSec: [1.6, 2.4],
        comboChance: 0.35,
        safeEvery: 3,
        safeGapSec: 2.8,
    },
];

/** Hazards allowed in the beginner-friendly opening. */
export const BEGINNER_HAZARDS: HazardType[] = ['pothole', 'speedBreaker', 'manhole', 'signal'];

export const ROUTE_LAYOUT = {
    /** Smooth road at the start so the first sip is easy (s). */
    firstHazardSec: 4.0,
    /** No hazards this close to the destination (s). */
    finishClearSec: 1.2,
    /** Generated route must offer at least this × the time needed to drink the whole bottle without ever drinking over a hazard. */
    minDrinkWindowRatio: 1.05,
    /** Max regeneration attempts before falling back to relaxed spacing. */
    maxAttempts: 24,
};

/**
 * The massive pothole (passenger-ejection easter egg). Never part of the
 * weighted section mix: at most one per ride, decided by its own RNG stream
 * so it doesn't reshuffle the rest of a seed's layout.
 */
export const MASSIVE_POTHOLE = {
    /** Chance a ride contains one. */
    chance: 0.25,
    /** Route progress window where it may appear (keeps it out of the opening). */
    window: [0.4, 0.8] as [number, number],
    /** Clear road before it (s), so it's on screen and readable well before impact. */
    leadSec: 1.8,
    /** Clear road after it (s). */
    trailSec: 1.6,
};

export function sectionAt(progress: number): SectionConfig {
    for (const s of SECTIONS) if (progress < s.until) return s;
    return SECTIONS[SECTIONS.length - 1];
}
