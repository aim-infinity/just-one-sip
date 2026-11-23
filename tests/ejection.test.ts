import { describe, expect, it } from 'vitest';
import { MASSIVE_POTHOLE } from '../src/game/config/difficulty';
import { HAZARDS } from '../src/game/config/hazards';
import { cloneTuning, progressAtFront } from '../src/game/config/tuning';
import { frontSpeed, generateRoute, planMassive, Road, type Hazard } from '../src/game/core/road';
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
    it('is rare: roughly MASSIVE_POTHOLE.chance of rides', () => {
        let n = 0;
        for (let s = 1; s <= 2000; s++) if (planMassive(s) !== null) n++;
        expect(n / 2000).toBeGreaterThan(MASSIVE_POTHOLE.chance - 0.05);
        expect(n / 2000).toBeLessThan(MASSIVE_POTHOLE.chance + 0.05);
    });

    it('appears at most once, outside the opening, with a clear run-up', () => {
        for (let seed = 1; seed <= 60; seed++) {
            const r = generateRoute(seed * 97, t, undefined, { massive: 'always' });
            const idx = r.hazards.map((h, i) => (h.type === 'massivePothole' ? i : -1)).filter((i) => i >= 0);
            expect(idx).toHaveLength(1);
            const h = r.hazards[idx[0]];
            const p = progressAtFront(t, h.x);
            expect(p).toBeGreaterThanOrEqual(MASSIVE_POTHOLE.window[0]);
            expect(p).toBeLessThan(0.95);
            const prev = r.hazards[idx[0] - 1];
            if (prev) {
                const gapSec = (h.x - (prev.x + prev.width)) / frontSpeed(t, prev.x + prev.width);
                expect(gapSec).toBeGreaterThanOrEqual(MASSIVE_POTHOLE.leadSec - 0.15);
            }
        }
    });

    it("never appears with massive: 'never', and rides without one keep their old layout", () => {
        for (let seed = 1; seed <= 40; seed++) {
            const never = generateRoute(seed, t, undefined, { massive: 'never' });
            expect(never.hazards.some((h) => h.type === 'massivePothole')).toBe(false);
            const normal = generateRoute(seed, t);
            if (!normal.hazards.some((h) => h.type === 'massivePothole')) expect(normal.hazards).toEqual(never.hazards);
        }
    });

    it('a well-timed player never gets ejected', () => {
        let ejections = 0;
        for (let seed = 1; seed <= 30; seed++) {
            const r = generateRoute(seed * 31, t, undefined, { massive: 'always' });
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
