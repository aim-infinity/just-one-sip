import { describe, expect, it } from 'vitest';
import { HAZARDS } from '../src/game/config/hazards';
import { cloneTuning } from '../src/game/config/tuning';
import { Road, generateRoute } from '../src/game/core/road';
import { RideSimulation } from '../src/game/core/simulation';
import { computeScore } from '../src/game/core/scoring';

/**
 * Balance regression tests using scripted "players". Spills never block a
 * win, so the guard is: good timing finishes cleanly (stars, score), holding
 * through every bump makes a mess, and never drinking always loses.
 */
const t = cloneTuning();
type Bot = (s: RideSimulation) => boolean;

/** Lowers ~0.3 s before each hazard, resumes once the rear wheel is clear, sits still while braking. */
const timely: Bot = (s) => {
    const next = s.timeToNextHazard().sec;
    const rearOn = s.road.hazards.some(
        (h) => !HAZARDS[h.type].brake && s.rearX > h.x - 5 && s.rearX < h.x + h.width + s.cruiseSpeed * 0.05,
    );
    const braking = s.brake.active && s.brake.phase !== 'hold';
    return next > 0.3 && !rearOn && !braking;
};
const alwaysHold: Bot = () => true;
const neverDrink: Bot = () => false;

function play(bot: Bot, n = 80) {
    let wins = 0;
    let spilled = 0;
    let score = 0;
    for (let i = 1; i <= n; i++) {
        const r = generateRoute(i * 131, t);
        const sim = new RideSimulation(t, new Road(r.hazards, r.lengthPx), { seed: i });
        while (sim.state === 'playing') sim.step(t.fixedStep, bot(sim));
        if (sim.outcome === 'won') wins++;
        spilled += sim.bottle.spilledMl;
        score += computeScore(sim.result());
    }
    return { winRate: wins / n, avgSpilled: spilled / n, avgScore: score / n };
}
const winRate = (bot: Bot, n?: number) => play(bot, n).winRate;

describe('Balance', () => {
    it('a player with good timing almost always wins', () => {
        expect(winRate(timely)).toBeGreaterThanOrEqual(0.9);
    });

    it('holding through every bump makes a mess and scores far lower', () => {
        const good = play(timely);
        const mash = play(alwaysHold);
        expect(mash.avgSpilled).toBeGreaterThan(good.avgSpilled * 1.8);
        expect(mash.avgScore).toBeLessThan(good.avgScore * 0.8);
    });

    it('never drinking always loses', () => {
        expect(winRate(neverDrink, 10)).toBe(0);
    });
});
