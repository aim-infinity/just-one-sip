import { describe, expect, it } from 'vitest';
import { DRIVER_IDS } from '../src/game/config/drivers';
import { HAZARDS } from '../src/game/config/hazards';
import { rideMods } from '../src/game/config/ride';
import { cloneTuning } from '../src/game/config/tuning';
import { WEATHER_IDS } from '../src/game/config/weather';
import { Road, generateRoute } from '../src/game/core/road';
import { RideSimulation, type SimEvent } from '../src/game/core/simulation';

const t = cloneTuning();
const dt = t.fixedStep;

function pothole(x: number) {
    return { type: 'pothole' as const, x, width: 90, depth: 14, impact: 1, kicks: HAZARDS.pothole.kicks, block: 0 };
}
function cow(x: number) {
    return { type: 'cow' as const, x, width: 240, depth: 0, impact: 1, kicks: [], block: 0 };
}

function peakBody(driver: 'careful' | 'impatient' | 'overconfident') {
    const sim = new RideSimulation(t, new Road([pothole(900)], 1e9), { seed: 1, practice: true, mods: rideMods(driver, 'sunny') });
    let peak = 0;
    const events: SimEvent[] = [];
    while (sim.time < 4) {
        sim.step(dt, false);
        for (const e of sim.drainEvents()) {
            events.push(e);
            if (e.kind === 'kick') peak = Math.max(peak, e.severity);
        }
    }
    return { peak, events };
}

describe('Driver personalities', () => {
    it('careful Pothole Pandey slows for bumps, so hits are softer', () => {
        const careful = peakBody('careful');
        const over = peakBody('overconfident');
        expect(careful.peak).toBeLessThan(over.peak * 0.85);
        expect(careful.events.some((e) => e.kind === 'slowing')).toBe(true);
    });

    it('overconfident Bumper Babu drives faster and never slows', () => {
        const over = new RideSimulation(t, new Road([], 1e9), { seed: 1, mods: rideMods('overconfident', 'sunny') });
        const careful = new RideSimulation(t, new Road([], 1e9), { seed: 1, mods: rideMods('careful', 'sunny') });
        expect(over.cruiseSpeed).toBeGreaterThan(careful.cruiseSpeed * 1.1);
        expect(peakBody('overconfident').events.some((e) => e.kind === 'slowing')).toBe(false);
    });

    it('impatient Turbo Tiwari meets scooters cutting in, and brakes harder', () => {
        let cutIns = 0;
        for (let s = 1; s <= 30; s++) cutIns += generateRoute(s, t, rideMods('impatient', 'sunny')).hazards.filter((h) => h.type === 'cutIn').length;
        expect(cutIns).toBeGreaterThan(10);
        for (let s = 1; s <= 30; s++) expect(generateRoute(s, t, rideMods('careful', 'sunny')).hazards.some((h) => h.type === 'cutIn')).toBe(false);

        const jolt = (d: 'careful' | 'impatient') => {
            const sim = new RideSimulation(t, new Road([cow(900)], 1e9), { seed: 1, practice: true, mods: rideMods(d, 'sunny') });
            let worst = 0;
            while (sim.time < 4) {
                sim.step(dt, false);
                worst = Math.max(worst, Math.abs(sim.rig.headX.pos));
            }
            return worst;
        };
        expect(jolt('impatient')).toBeGreaterThan(jolt('careful') * 1.3);
    });
});

describe('Weather', () => {
    it('rain makes braking slippery (longer stop + a skid)', () => {
        const run = (w: 'sunny' | 'rainy') => {
            const sim = new RideSimulation(t, new Road([cow(900)], 1e9), { seed: 1, practice: true, mods: rideMods('overconfident', w) });
            const kinds: string[] = [];
            while (sim.time < 5) {
                sim.step(dt, false);
                kinds.push(...sim.drainEvents().map((e) => e.kind));
            }
            return kinds;
        };
        expect(run('rainy')).toContain('skid');
        expect(run('sunny')).not.toContain('skid');
    });

    it('rain brings more waterlogged roads', () => {
        const count = (w: 'sunny' | 'rainy') => {
            let n = 0;
            for (let s = 1; s <= 60; s++) n += generateRoute(s, t, rideMods('careful', w)).hazards.filter((h) => h.type === 'waterlogged').length;
            return n;
        };
        expect(count('rainy')).toBeGreaterThan(count('sunny') * 1.5);
    });
});

describe('Balance for every driver × weather', () => {
    const timely = (s: RideSimulation) => {
        const next = s.timeToNextHazard().sec;
        const rearOn = s.road.hazards.some((h) => !HAZARDS[h.type].brake && s.rearX > h.x - 5 && s.rearX < h.x + h.width + s.cruiseSpeed * 0.05);
        const braking = s.brake.active && s.brake.phase !== 'hold';
        return next > 0.3 && !rearOn && !braking;
    };
    for (const d of DRIVER_IDS)
        for (const w of WEATHER_IDS) {
            it(`${d} / ${w}: good timing wins, holding constantly usually loses`, () => {
                const mods = rideMods(d, w);
                let good = 0;
                let mash = 0;
                const N = 30;
                for (let i = 1; i <= N; i++) {
                    const r = generateRoute(i * 977, t, mods);
                    for (const [bot, inc] of [
                        [timely, () => good++],
                        [() => true, () => mash++],
                    ] as const) {
                        const sim = new RideSimulation(t, new Road(r.hazards, r.lengthPx), { seed: i, mods });
                        while (sim.state === 'playing') sim.step(dt, bot(sim));
                        if (sim.outcome === 'won') inc();
                    }
                }
                expect(good / N).toBeGreaterThanOrEqual(0.85);
                expect(mash / N).toBeLessThanOrEqual(0.35);
            });
        }
});
