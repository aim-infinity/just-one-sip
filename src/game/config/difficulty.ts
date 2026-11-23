import type { HazardType } from './hazards';

/**
 * Difficulty is shaped by *timing*, never by runaway speed.
 * The route is split into three sections by fraction of distance travelled.
 */
export interface SectionConfig {
    name: 'opening' | 'middle' | 'final';
    /** Section applies while route progress < `until` (0..1). */
    until: number;
    /** Relative spawn weights. 0 = never in this section. */
    weights: Record<HazardType, number>;
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
        weights: { pothole: 3, speedBreaker: 3, uneven: 0, waterlogged: 0 },
        gapSec: [3.4, 4.2],
        comboChance: 0,
        safeEvery: 0,
        safeGapSec: 0,
    },
    {
        name: 'middle',
        until: 0.75,
        weights: { pothole: 4, speedBreaker: 2, uneven: 2, waterlogged: 1 },
        gapSec: [3.0, 3.9],
        comboChance: 0.2,
        safeEvery: 3,
        safeGapSec: 4.0,
    },
    {
        name: 'final',
        until: 1.01,
        weights: { pothole: 4, speedBreaker: 1, uneven: 2, waterlogged: 3 },
        gapSec: [1.9, 2.7],
        comboChance: 0.35,
        safeEvery: 3,
        safeGapSec: 3.2,
    },
];

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

export function sectionAt(progress: number): SectionConfig {
    for (const s of SECTIONS) if (progress < s.until) return s;
    return SECTIONS[SECTIONS.length - 1];
}
