import { describe, expect, it } from 'vitest';
import { HAZARDS } from '../src/game/config/hazards';
import { cloneTuning, speedPx } from '../src/game/config/tuning';
import { Road } from '../src/game/core/road';
import { RideSimulation, type SimEvent } from '../src/game/core/simulation';

const t = cloneTuning();
const dt = t.fixedStep;

function pothole(x: number) {
    const d = HAZARDS.pothole;
    return { type: 'pothole' as const, x, width: 90, depth: 14, impact: 1, kicks: d.kicks, block: 0 };
}

function runUntil(sim: RideSimulation, seconds: number) {
    const out: (SimEvent & { at: number })[] = [];
    while (sim.time < seconds && sim.state === 'playing') {
        sim.step(dt, false);
        for (const e of sim.drainEvents()) out.push({ ...e, at: sim.time });
    }
    return out;
}

describe('Collision timing (world space)', () => {
    it('front wheel hits first, rear wheel exactly one wheelbase later', () => {
        const hx = 1200;
        const sim = new RideSimulation(t, new Road([pothole(hx)], 1e9), { seed: 1, practice: true });
        const ev = runUntil(sim, 5).filter((e) => e.kind === 'contact');
        expect(ev.map((e) => (e as { wheel: string }).wheel)).toEqual(['front', 'rear']);

        const v = speedPx(t);
        const frontExpected = (hx - t.wheelbasePx) / v;
        const rearExpected = hx / v;
        expect(Math.abs(ev[0].at - frontExpected)).toBeLessThanOrEqual(dt + 1e-9);
        expect(Math.abs(ev[1].at - rearExpected)).toBeLessThanOrEqual(dt + 1e-9);
        expect(ev[1].at - ev[0].at).toBeCloseTo(t.wheelbasePx / v, 1);
    });

    it('each wheel fires every kick point once, in order', () => {
        const sim = new RideSimulation(t, new Road([pothole(800)], 1e9), { seed: 1, practice: true });
        const kicks = runUntil(sim, 5).filter((e) => e.kind === 'kick');
        expect(kicks).toHaveLength(HAZARDS.pothole.kicks.length * 2);
        const front = kicks.filter((k) => (k as { wheel: string }).wheel === 'front');
        expect(front).toHaveLength(HAZARDS.pothole.kicks.length);
    });

    it('suspension does not move before the front wheel reaches the hazard', () => {
        const hx = 1500;
        const sim = new RideSimulation(t, new Road([pothole(hx)], 1e9), { seed: 1, practice: true });
        const v = speedPx(t);
        runUntil(sim, (hx - t.wheelbasePx) / v - 0.05);
        expect(Math.abs(sim.suspension.height)).toBeLessThan(1e-9);
        runUntil(sim, (hx - t.wheelbasePx) / v + 0.3);
        expect(Math.abs(sim.suspension.height)).toBeGreaterThan(1);
    });

    it('a bump while drinking breaks alignment and spills', () => {
        const sim = new RideSimulation(t, new Road([pothole(900)], 1e9), { seed: 1, practice: true });
        let worst = 1;
        while (sim.time < 4) {
            sim.step(dt, true);
            worst = Math.min(worst, sim.alignment);
        }
        expect(worst).toBeLessThan(1);
        expect(sim.bottle.spilledMl).toBeGreaterThan(5);
    });

    it('hazards inserted ahead during play are still detected', () => {
        const road = new Road([], 1e9);
        const sim = new RideSimulation(t, road, { seed: 1, practice: true });
        runUntil(sim, 1);
        road.add(pothole(sim.frontX + 300));
        const ev = runUntil(sim, 4).filter((e) => e.kind === 'contact');
        expect(ev).toHaveLength(2);
    });
});
