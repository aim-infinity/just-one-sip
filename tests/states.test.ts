import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../src/game/config/tuning';
import { Arm } from '../src/game/core/arm';
import { Road } from '../src/game/core/road';
import { RideSimulation, type SimEvent } from '../src/game/core/simulation';
import { computeScore, verdict } from '../src/game/core/scoring';

const t = cloneTuning();
const dt = t.fixedStep;

function run(arm: Arm, holding: boolean, seconds: number) {
    for (let i = 0; i < Math.round(seconds / dt); i++) arm.step(holding, dt);
}

describe('Arm state machine', () => {
    it('starts lowered', () => {
        expect(new Arm(t).state).toBe('lowered');
    });

    it('hold → raising → atMouth in ≈400 ms', () => {
        const arm = new Arm(t);
        run(arm, true, 0.2);
        expect(arm.state).toBe('raising');
        expect(arm.atLips).toBe(false);
        run(arm, true, 0.21);
        expect(arm.state).toBe('atMouth');
        expect(arm.atLips).toBe(true);
    });

    it('release → lowering → lowered in ≈250 ms', () => {
        const arm = new Arm(t);
        run(arm, true, 1);
        run(arm, false, 0.1);
        expect(arm.state).toBe('lowering');
        run(arm, false, 0.16);
        expect(arm.state).toBe('lowered');
        expect(arm.tip).toBe(0);
    });

    it('releasing mid-raise reverses smoothly from the current position', () => {
        const arm = new Arm(t);
        run(arm, true, 0.2); // halfway
        const p = arm.progress;
        arm.step(false, dt);
        expect(arm.state).toBe('lowering');
        expect(arm.progress).toBeLessThan(p);
        expect(arm.progress).toBeGreaterThan(p - 0.1);
    });
});

describe('Ride state transitions', () => {
    it('drinking continuously on a smooth road wins', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        const events: SimEvent[] = [];
        while (sim.state === 'playing') {
            sim.step(dt, true);
            events.push(...sim.drainEvents());
        }
        expect(sim.outcome).toBe('won');
        expect(sim.bottle.consumedMl).toBeCloseTo(250, 5);
        const kinds = events.map((e) => e.kind);
        expect(kinds).toContain('sipStart');
        expect(kinds).toContain('gulp');
        expect(kinds[kinds.length - 1]).toBe('end');
        // ≈ raise time + capacity / drink rate
        const expected = t.raiseMs / 1000 + t.capacityMl / t.drinkRateMlPerSec;
        expect(Math.abs(sim.time - expected)).toBeLessThan(0.15);
    });

    it('never drinking arrives thirsty at the destination', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        while (sim.state === 'playing') sim.step(dt, false);
        expect(sim.outcome).toBe('arrivedThirsty');
        expect(sim.distanceM).toBeCloseTo(t.routeMeters, 3);
        expect(sim.time).toBeGreaterThan(39);
        expect(sim.time).toBeLessThan(41);
    });

    it('spilling the bottle empty before drinking enough loses', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        sim.bottle.spill(200);
        while (sim.state === 'playing') sim.step(dt, true);
        expect(sim.outcome).toBe('spilledOut');
    });

    it('practice mode never ends and refills', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1, practice: true });
        for (let i = 0; i < 120 * 60; i++) sim.step(dt, true);
        expect(sim.state).toBe('playing');
    });

    it('stepping an ended ride does nothing', () => {
        const sim = new RideSimulation(t, new Road([], 1e9), { seed: 1 });
        while (sim.state === 'playing') sim.step(dt, false);
        const d = sim.distance;
        sim.step(dt, true);
        expect(sim.distance).toBe(d);
    });
});

describe('Scoring', () => {
    it('wins outscore losses and verdicts are non-empty', () => {
        const base = { consumedMl: 200, spilledMl: 50, remainingMl: 0, capacityMl: 250, distanceM: 200, routeM: 280, timeSec: 30, seed: 3 };
        const won = computeScore({ ...base, outcome: 'won' });
        const lost = computeScore({ ...base, remainingMl: 10, consumedMl: 190, outcome: 'arrivedThirsty' });
        expect(won).toBeGreaterThan(lost);
        for (const outcome of ['won', 'arrivedThirsty', 'spilledOut'] as const) {
            expect(verdict({ ...base, outcome }).length).toBeGreaterThan(5);
        }
    });
});
