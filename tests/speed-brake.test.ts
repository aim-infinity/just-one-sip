import { describe, expect, it } from 'vitest';
import { HAZARDS } from '../src/game/config/hazards';
import { cloneTuning, SPEED_PROFILE, speedPxAt } from '../src/game/config/tuning';
import { Road } from '../src/game/core/road';
import { RideSimulation, type SimEvent } from '../src/game/core/simulation';

const t = cloneTuning();
const dt = t.fixedStep;

function cow(x: number) {
    return { type: 'cow' as const, x, width: 240, depth: 0, impact: 1, kicks: [], block: 0 };
}
function signal(x: number) {
    return { type: 'signal' as const, x, width: 130, depth: 0, impact: 1, kicks: [], block: 0 };
}

describe('Speed ramp', () => {
    it('climbs fast (Dino-style) from 5 m/s (18 km/h) to a 22.3 m/s (80 km/h) top speed and never exceeds it', () => {
        const start = speedPxAt(t, 0) / t.pxPerMeter;
        const end = speedPxAt(t, 1) / t.pxPerMeter;
        expect(start).toBeCloseTo(5, 5);
        expect(end).toBeCloseTo(22.3, 5);
        // the climb is quick: top speed is reached within the first fifth of the route
        expect(speedPxAt(t, 0.1)).toBeGreaterThan(speedPxAt(t, 0) * 2);
        expect(speedPxAt(t, 0.2) / t.pxPerMeter).toBeCloseTo(22.3, 5);
        let prev = 0;
        for (let p = 0; p <= 1.2; p += 0.01) {
            const v = speedPxAt(t, p) / t.pxPerMeter;
            expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
            expect(v).toBeLessThanOrEqual(Math.max(...SPEED_PROFILE.map((k) => k[1])) + 1e-9);
            prev = v;
        }
    });

    it('a full ride without hazards still takes about 40 seconds', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        while (sim.state === 'playing') sim.step(dt, false);
        expect(sim.time).toBeGreaterThan(37);
        expect(sim.time).toBeLessThan(44);
    });
});

describe('Braking hazards', () => {
    it('a cow makes the auto slow down hard, then recover', () => {
        const sim = new RideSimulation(t, new Road([cow(900)], 1e9), { seed: 1, practice: true });
        const events: SimEvent[] = [];
        let minSpeed = Infinity;
        while (sim.time < 5) {
            sim.step(dt, false);
            events.push(...sim.drainEvents());
            minSpeed = Math.min(minSpeed, sim.speed);
        }
        expect(events.filter((e) => e.kind === 'brake')).toHaveLength(1);
        expect(events.filter((e) => e.kind === 'go')).toHaveLength(1);
        expect(minSpeed).toBeLessThan(sim.cruiseSpeed * 0.3);
        expect(sim.speed).toBeCloseTo(sim.cruiseSpeed, 3);
    });

    it('a red signal brings the auto to a full stop for a while', () => {
        const sim = new RideSimulation(t, new Road([signal(700)], 1e9), { seed: 1, practice: true });
        let stoppedFor = 0;
        while (sim.time < 6) {
            sim.step(dt, false);
            if (sim.speed < 1) stoppedFor += dt;
        }
        expect(stoppedFor).toBeGreaterThan(HAZARDS.signal.brake!.holdSec * 0.9);
    });

    it('braking throws the head forward, breaking alignment mid-sip', () => {
        const sim = new RideSimulation(t, new Road([cow(1100)], 1e9), { seed: 1, practice: true });
        let worstX = 0;
        let worstAlign = 1;
        while (sim.time < 4) {
            sim.step(dt, true);
            worstX = Math.max(worstX, sim.rig.misalignX);
            worstAlign = Math.min(worstAlign, sim.alignment);
        }
        expect(worstX).toBeGreaterThan(t.alignTolerancePx);
        expect(worstAlign).toBeLessThan(1);
        expect(sim.bottle.spilledMl).toBeGreaterThan(3);
    });

    it('rear wheel does not trigger a second brake', () => {
        const sim = new RideSimulation(t, new Road([cow(800)], 1e9), { seed: 1, practice: true });
        let brakes = 0;
        while (sim.time < 6) {
            sim.step(dt, false);
            brakes += sim.drainEvents().filter((e) => e.kind === 'brake').length;
        }
        expect(brakes).toBe(1);
    });
});

describe('Spill limit (mess meter)', () => {
    it('spills never reduce the water you can drink', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        sim.step(dt, false);
        sim.bottle.spill(30);
        expect(sim.bottle.remainingMl).toBe(t.capacityMl);
        while (sim.state === 'playing') sim.step(dt, true);
        expect(sim.outcome).toBe('won');
        expect(sim.bottle.consumedMl).toBeCloseTo(t.capacityMl, 5);
    });

    it('the ride ends as soon as the spill limit is reached', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        sim.step(dt, false);
        sim.bottle.spill(t.spillLimitMl - 1);
        sim.step(dt, false);
        expect(sim.state).toBe('playing');
        sim.bottle.spill(1);
        sim.step(dt, false);
        expect(sim.outcome).toBe('spilledOut');
        expect(sim.bottle.remainingMl).toBeGreaterThan(200);
    });

    it('practice mode resets instead of ending', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1, practice: true });
        sim.bottle.spill(t.spillLimitMl + 5);
        sim.step(dt, false);
        expect(sim.state).toBe('playing');
        expect(sim.bottle.spilledMl).toBe(0);
    });
});
