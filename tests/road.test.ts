import { describe, expect, it } from 'vitest';
import { ROUTE_LAYOUT } from '../src/game/config/difficulty';
import { cloneTuning } from '../src/game/config/tuning';
import { BEGINNER_HAZARDS } from '../src/game/config/difficulty';
import { frontSpeed, generateRoute, minClearSec, requiredDrinkSec, Road, hazardProfile, travelSec } from '../src/game/core/road';

const t = cloneTuning();
const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7 + 1);

describe('Road generation', () => {
    it('is deterministic for a given seed', () => {
        expect(generateRoute(1234, t)).toEqual(generateRoute(1234, t));
        expect(generateRoute(1234, t).hazards).not.toEqual(generateRoute(4321, t).hazards);
    });

    it('never overlaps hazards and respects block spacing', () => {
        for (const seed of SEEDS) {
            const { hazards } = generateRoute(seed, t);
            for (let i = 1; i < hazards.length; i++) {
                const prev = hazards[i - 1];
                const cur = hazards[i];
                const gapSec = travelSec(t, prev.x + prev.width, cur.x);
                expect(gapSec).toBeGreaterThan(0);
                if (cur.block === prev.block) {
                    // combo inside one block: tight but never overlapping
                    expect(gapSec).toBeGreaterThanOrEqual(t.comboGapSec * 0.97);
                } else {
                    // between blocks: rear wheel clears + reaction time
                    expect(gapSec).toBeGreaterThanOrEqual(minClearSec(t, prev.type, frontSpeed(t, prev.x + prev.width)) * 0.97);
                }
            }
        }
    });

    it('opens with smooth road and keeps the finish clear', () => {
        for (const seed of SEEDS) {
            const r = generateRoute(seed, t);
            const first = r.hazards[0];
            expect(travelSec(t, t.wheelbasePx, first.x)).toBeGreaterThanOrEqual(ROUTE_LAYOUT.firstHazardSec * 0.97);
            const last = r.hazards[r.hazards.length - 1];
            const finish = r.lengthPx + t.wheelbasePx;
            expect(travelSec(t, last.x + last.width, finish)).toBeGreaterThanOrEqual(ROUTE_LAYOUT.finishClearSec * 0.97);
        }
    });

    it('only uses beginner hazards in the opening section', () => {
        for (const seed of SEEDS) {
            const r = generateRoute(seed, t);
            const opening = r.hazards.filter((h) => (h.x - t.wheelbasePx) / r.lengthPx < 0.25);
            for (const h of opening) expect(BEGINNER_HAZARDS).toContain(h.type);
        }
    });

    it('gets tighter towards the end (shorter gaps, combos appear)', () => {
        const gaps = { opening: [] as number[], final: [] as number[] };
        let finalCombos = 0;
        for (const seed of SEEDS) {
            const r = generateRoute(seed, t);
            for (let i = 1; i < r.hazards.length; i++) {
                const prev = r.hazards[i - 1];
                const cur = r.hazards[i];
                // classify by where the gap was chosen (end of the previous hazard)
                const p = (prev.x + prev.width - t.wheelbasePx) / r.lengthPx;
                if (cur.block === prev.block) {
                    if (p >= 0.75) finalCombos++;
                    continue;
                }
                const g = travelSec(t, prev.x + prev.width, cur.x);
                if (p < 0.25) gaps.opening.push(g);
                else if (p >= 0.75) gaps.final.push(g);
            }
        }
        const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
        expect(mean(gaps.final)).toBeLessThan(mean(gaps.opening) * 0.8);
        expect(finalCombos).toBeGreaterThan(SEEDS.length * 0.2);
    });

    it('always guarantees enough safe drinking time to win', () => {
        const need = requiredDrinkSec(t) * ROUTE_LAYOUT.minDrinkWindowRatio;
        for (const seed of SEEDS) expect(generateRoute(seed, t).drinkWindowSec).toBeGreaterThanOrEqual(need);
    });

    it('road profile dips for potholes and rises for speed breakers', () => {
        const road = new Road(
            generateRoute(3, t).hazards.filter((h) => h.type === 'pothole' || h.type === 'speedBreaker'),
        );
        for (const h of road.hazards) {
            const mid = hazardProfile(h, h.x + h.width / 2);
            if (h.type === 'pothole') expect(mid).toBeLessThan(0);
            else expect(mid).toBeGreaterThan(0);
            expect(hazardProfile(h, h.x - 1)).toBe(0);
            expect(hazardProfile(h, h.x + h.width + 1)).toBe(0);
        }
    });
});
