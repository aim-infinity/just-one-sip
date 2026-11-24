import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../src/game/config/tuning';
import { Bottle } from '../src/game/core/bottle';
import { Rng } from '../src/game/core/rng';
import { Road, generateRoute } from '../src/game/core/road';
import { RideSimulation } from '../src/game/core/simulation';
import { sloshAmount } from '../src/game/core/drinking';

const EPS = 1e-6;
/** Spills live on a separate mess meter, so the bottle itself is always remaining + drunk. */
const total = (b: Bottle) => b.remainingMl + b.consumedMl;

describe('Bottle conservation', () => {
    it('drinking never creates or destroys water, and spills never take any away', () => {
        const b = new Bottle(250);
        const rng = new Rng(42);
        for (let i = 0; i < 5000; i++) {
            const before = b.remainingMl;
            if (rng.chance(0.5)) b.drink(rng.range(-2, 12));
            else {
                b.spill(rng.range(-2, 12));
                expect(b.remainingMl).toBe(before);
            }
            expect(Math.abs(total(b) - 250)).toBeLessThan(EPS);
            expect(b.remainingMl).toBeGreaterThanOrEqual(0);
        }
        expect(b.isEmpty).toBe(true);
    });

    it('cannot drink more than remains; spills only fill the mess meter', () => {
        const b = new Bottle(10);
        b.spill(4);
        expect(b.remainingMl).toBe(10);
        expect(b.spilledMl).toBe(4);
        expect(b.drink(25)).toBe(10);
        expect(b.spill(5)).toBe(0); // nothing left to spill
        expect(b.remainingMl).toBe(0);
    });
});

describe('Full-ride conservation', () => {
    it.each([1, 7, 99, 1234, 98765])('random hold patterns keep the books balanced (seed %i)', (seed) => {
        const t = cloneTuning();
        const route = generateRoute(seed, t);
        const sim = new RideSimulation(t, new Road(route.hazards, route.lengthPx), { seed });
        const rng = new Rng(seed ^ 0xabc);
        let holding = false;
        let steps = 0;
        while (sim.state === 'playing' && steps < 120 * 120) {
            if (rng.chance(0.02)) holding = !holding;
            sim.step(t.fixedStep, holding);
            steps++;
            expect(Math.abs(total(sim.bottle) - t.capacityMl)).toBeLessThan(1e-6);
        }
        expect(sim.isOver).toBe(true); // ended normally or passenger ejected
    });

    it('upright bottle barely spills over a whole ride', () => {
        const t = cloneTuning();
        const route = generateRoute(5, t);
        const sim = new RideSimulation(t, new Road(route.hazards, route.lengthPx), { seed: 5 });
        while (sim.state === 'playing') sim.step(t.fixedStep, false);
        expect(sim.outcome).toBe('arrivedThirsty');
        expect(sim.bottle.consumedMl).toBe(0);
        expect(sim.bottle.spilledMl).toBeLessThan(15);
    });
});

describe('Slosh model', () => {
    const t = cloneTuning();
    it('tipped bottles spill far more than upright ones', () => {
        expect(sloshAmount(t, 1, 1, 1)).toBeGreaterThan(sloshAmount(t, 0, 1, 1) + 5);
    });
    it('bigger jolts spill more', () => {
        expect(sloshAmount(t, 1, 0.5, 1.5)).toBeGreaterThan(sloshAmount(t, 1, 0.5, 0.5));
    });
    it('upright bottles only spill on very hard hits when nearly full', () => {
        expect(sloshAmount(t, 0, 1, 1.0)).toBe(0);
        expect(sloshAmount(t, 0, 0.5, 2.0)).toBe(0);
        expect(sloshAmount(t, 0, 0.95, 1.8)).toBeGreaterThan(0);
    });
});
