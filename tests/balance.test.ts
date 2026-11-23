import { describe, expect, it } from 'vitest';
import { HAZARDS } from '../src/game/config/hazards';
import { cloneTuning } from '../src/game/config/tuning';
import { Road, generateRoute } from '../src/game/core/road';
import { RideSimulation } from '../src/game/core/simulation';
import { computeScore } from '../src/game/core/scoring';

/**
 * Balance regression tests using scripted "players": good timing wins,
 * holding the bottle up through every bump fills the 50 ml mess meter.
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

    it('holding the bottle up the whole ride usually loses', () => {
        expect(winRate(alwaysHold)).toBeLessThanOrEqual(0.25);
    });

    it('good timing scores far higher than mashing', () => {
        expect(play(alwaysHold).avgScore).toBeLessThan(play(timely).avgScore * 0.6);
    });

    it('never drinking always loses', () => {
        expect(winRate(neverDrink, 10)).toBe(0);
    });
});
