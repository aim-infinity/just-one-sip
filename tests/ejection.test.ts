import { describe, expect, it } from 'vitest';
import { MASSIVE_POTHOLE } from '../src/game/config/difficulty';
import { DRIVER_IDS } from '../src/game/config/drivers';
import { HAZARDS } from '../src/game/config/hazards';
import { rideMods } from '../src/game/config/ride';
import { WEATHER_IDS } from '../src/game/config/weather';
import { cloneTuning, progressAtFront } from '../src/game/config/tuning';
import { frontSpeed, generateRoute, Road, type Hazard } from '../src/game/core/road';
import { PASSENGER_EJECTED, RideSimulation, type SimEvent } from '../src/game/core/simulation';
import { headline } from '../src/game/core/scoring';

const t = cloneTuning();
const dt = t.fixedStep;

/** A road with one massive pothole 3 s ahead of the front wheel. */
function craterRoad(): { road: Road; hole: Hazard } {
    const d = HAZARDS.massivePothole;
    const road = new Road([], 1e9);
    const hole = road.add({ type: 'massivePothole', x: t.wheelbasePx + 1800, width: 160, depth: 33, impact: 1.6, kicks: d.kicks, block: 0 });
    return { road, hole };
}

/** Step until `until` is true (or the hazard is well behind), feeding `hold(sim)`. */
function ride(sim: RideSimulation, hold: (s: RideSimulation) => boolean, hole: Hazard, extraSec = 1) {
    const events: SimEvent[] = [];
    const endX = hole.x + hole.width + t.wheelbasePx;
    let after = 0;
    while (after < extraSec && sim.time < 20) {
        sim.step(dt, hold(sim));
        events.push(...sim.drainEvents());
        if (sim.rearX > endX || sim.isOver) after += dt;
    }
    return events;
}

describe('Massive pothole: passenger ejection', () => {
    it('drinking through the impact launches the passenger', () => {
        const { road, hole } = craterRoad();
        const sim = new RideSimulation(t, road, { seed: 1 });
        const events = ride(sim, () => true, hole);
        expect(sim.state).toBe(PASSENGER_EJECTED);
        expect(sim.outcome).toBe('ejected');
        expect(events.filter((e) => e.kind === 'eject')).toHaveLength(1);
        expect(headline(sim.result())).toBe('FLIGHT MODE ON!');
    });

    it('releasing when the front wheel reaches the crater is safe', () => {
        const { road, hole } = craterRoad();
        const sim = new RideSimulation(t, road, { seed: 1 });
        const events = ride(sim, (s) => s.frontX < hole.x, hole);
        expect(sim.state).toBe('playing');
        expect(events.some((e) => e.kind === 'eject')).toBe(false);
        // ...but it's still a strong bounce
        const maxKick = Math.max(...events.filter((e) => e.kind === 'kick').map((e) => (e as { severity: number }).severity));
        expect(maxKick).toBeGreaterThan(1.3);
    });

    it('raising the bottle again before the rear wheel hits still ejects', () => {
        const { road, hole } = craterRoad();
        const sim = new RideSimulation(t, road, { seed: 1 });
        const hold = (s: RideSimulation) => s.frontX < hole.x || s.frontX > hole.x + hole.width + 20;
        const events = ride(sim, hold, hole);
        const ej = events.find((e) => e.kind === 'eject');
        expect(ej && ej.kind === 'eject' && ej.wheel).toBe('rear');
    });

    it('stops water immediately and only ejects once', () => {
        const { road, hole } = craterRoad();
        const sim = new RideSimulation(t, road, { seed: 1 });
        ride(sim, () => true, hole, 1e-9);
        expect(sim.state).toBe(PASSENGER_EJECTED);
        const drunk = sim.bottle.consumedMl;
        const spilled = sim.bottle.spilledMl;
        const events: SimEvent[] = [];
        for (let i = 0; i < 600; i++) {
            sim.step(dt, true);
            events.push(...sim.drainEvents());
        }
        expect(sim.bottle.consumedMl).toBe(drunk);
        expect(sim.bottle.spilledMl).toBe(spilled);
        expect(events).toHaveLength(0);
        // the driver brakes to a stop
        expect(sim.speed).toBe(0);
    });

    it('never happens in practice / tutorial rides', () => {
        const { road, hole } = craterRoad();
        const sim = new RideSimulation(t, road, { seed: 1, practice: true });
        const events = ride(sim, () => true, hole);
        expect(events.some((e) => e.kind === 'eject')).toBe(false);
    });
});

describe('Massive pothole: placement', () => {
    it('appears exactly once on every ride, for every driver × weather, with a clear run-up before the stop', () => {
        for (const d of DRIVER_IDS)
            for (const w of WEATHER_IDS) {
                const mods = rideMods(d, w);
                for (let seed = 1; seed <= 60; seed++) {
                    const r = generateRoute(seed * 97, t, mods);
                    const idx = r.hazards.map((h, i) => (h.type === 'massivePothole' ? i : -1)).filter((i) => i >= 0);
                    expect(idx, `${d}/${w}/${seed}`).toHaveLength(1);
                    const h = r.hazards[idx[0]];
                    expect(progressAtFront(t, h.x)).toBeGreaterThanOrEqual(MASSIVE_POTHOLE.window[0]);
                    // fully on the road before the stop
                    expect(h.x + h.width).toBeLessThan(r.lengthPx + t.wheelbasePx);
                    const prev = r.hazards[idx[0] - 1];
                    if (prev) {
                        const gapSec = (h.x - (prev.x + prev.width)) / frontSpeed(t, prev.x + prev.width, mods.speedMul);
                        expect(gapSec, `${d}/${w}/${seed}`).toBeGreaterThanOrEqual(MASSIVE_POTHOLE.leadSec - 0.15);
                    }
                }
            }
    });

    it('lands at a random point: spread across the route, sometimes right near the end', () => {
        const ps: number[] = [];
        for (let seed = 1; seed <= 300; seed++) {
            const h = generateRoute(seed, t).hazards.find((x) => x.type === 'massivePothole')!;
            ps.push(progressAtFront(t, h.x));
        }
        expect(Math.min(...ps)).toBeLessThan(0.45);
        expect(Math.max(...ps)).toBeGreaterThan(0.85);
    });

    it("never appears with massive: 'never'", () => {
        for (let seed = 1; seed <= 40; seed++) {
            expect(generateRoute(seed, t, undefined, { massive: 'never' }).hazards.some((h) => h.type === 'massivePothole')).toBe(false);
        }
    });

    it('a well-timed player never gets ejected', () => {
        let ejections = 0;
        for (let seed = 1; seed <= 30; seed++) {
            const r = generateRoute(seed * 31, t);
            const sim = new RideSimulation(t, new Road(r.hazards, r.lengthPx), { seed });
            while (sim.state === 'playing') {
                const next = sim.timeToNextHazard().sec;
                const rearOn = sim.road.hazards.some((h) => !HAZARDS[h.type].brake && sim.rearX > h.x - 5 && sim.rearX < h.x + h.width + 20);
                sim.step(dt, next > 0.3 && !rearOn && !sim.brake.active);
            }
            if (sim.outcome === 'ejected') ejections++;
        }
        expect(ejections).toBe(0);
    });
});
