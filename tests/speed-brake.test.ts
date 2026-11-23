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
    it('rises from 6 m/s to a 9 m/s cap and never exceeds it', () => {
        const start = speedPxAt(t, 0) / t.pxPerMeter;
        const end = speedPxAt(t, 1) / t.pxPerMeter;
        expect(start).toBeCloseTo(6, 5);
        expect(end).toBeCloseTo(9, 5);
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

describe('Spills never block a win', () => {
    it('finishing the bottle wins even after a big spill', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        sim.step(dt, false);
        sim.bottle.spill(150);
        while (sim.state === 'playing') sim.step(dt, true);
        expect(sim.outcome).toBe('won');
        expect(sim.bottle.consumedMl).toBeCloseTo(100, 5);
    });

    it('a ride does not end early because of spills', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        sim.bottle.spill(240);
        for (let i = 0; i < 120; i++) sim.step(dt, false);
        expect(sim.state).toBe('playing');
    });

    it('spilling every last drop loses', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        sim.bottle.spill(250);
        sim.step(dt, false);
        expect(sim.outcome).toBe('spilledOut');
    });
});
