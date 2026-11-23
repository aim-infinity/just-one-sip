// Dev: balance check. `npm run balance` — prints scripted-player win rates,
// average ride time, hazards per route and generator retries.
import { cloneTuning, type Tuning } from '../src/game/config/tuning';
import { HAZARDS } from '../src/game/config/hazards';
import { Road, generateRoute } from '../src/game/core/road';
import { RideSimulation } from '../src/game/core/simulation';
import { DEFAULT_MODS, rideMods, type RideMods } from '../src/game/config/ride';
import { DRIVER_IDS } from '../src/game/config/drivers';

type Bot = (s: RideSimulation) => boolean;
const big = (h: { type: keyof typeof HAZARDS }) => HAZARDS[h.type].impact[1] >= 0.75 || !!HAZARDS[h.type].brake;
const rearOn = (s: RideSimulation, f: (h: { type: keyof typeof HAZARDS }) => boolean, pad: number) =>
  s.road.hazards.some((h) => f(h) && !HAZARDS[h.type].brake && s.rearX > h.x - 5 && s.rearX < h.x + h.width + s.cruiseSpeed * pad);
const nextSec = (s: RideSimulation, f: (h: { type: keyof typeof HAZARDS }) => boolean) => {
  const h = s.road.hazards.find((h) => f(h) && h.x >= s.frontX);
  return h ? (h.x - s.frontX) / s.cruiseSpeed : 99;
};
const braking = (s: RideSimulation) => s.brake.active && s.brake.phase !== 'hold';
const all = () => true;
export const BOTS: [string, Bot][] = [
  ['timely', (s) => nextSec(s, all) > 0.3 && !rearOn(s, all, 0.05) && !braking(s)],
  ['smart', (s) => nextSec(s, big) > 0.4 && !rearOn(s, big, 0.1) && !braking(s)],
  ['sloppy', (s) => nextSec(s, all) > 0.2 && Math.floor(s.time * 1.3) % 3 !== 0],
  ['always', () => true],
];

export function run(t: Tuning, N = 150, label = '', mods: RideMods = DEFAULT_MODS) {
  const res: string[] = [];
  let hz = 0, att = 0;
  for (const [name, bot] of BOTS) {
    let wins = 0, time = 0, spill = 0;
    for (let s = 1; s <= N; s++) {
      const r = generateRoute(s * 31, t, mods);
      if (name === 'timely') { hz += r.hazards.length; att += r.attempts; }
      const sim = new RideSimulation(t, new Road(r.hazards, r.lengthPx), { seed: s, mods });
      while (sim.state === 'playing') sim.step(t.fixedStep, bot(sim));
      if (sim.outcome === 'won') { wins++; time += sim.time; }
      spill += sim.bottle.spilledMl;
    }
    res.push(`${name} ${Math.round((100 * wins) / N)}%${wins ? '@' + (time / wins).toFixed(0) + 's' : ''} sp${(spill / N).toFixed(0)}`);
  }
  console.log(label, `hz ${(hz / N).toFixed(1)} att ${(att / N).toFixed(1)} |`, res.join('  '));
}

if (!process.env.NO_MAIN) {
  run(cloneTuning(), 100, 'neutral        ');
  for (const d of DRIVER_IDS) for (const w of ['sunny', 'rainy'] as const) run(cloneTuning(), 100, `${d.padEnd(13)} ${w.padEnd(6)}`, rideMods(d, w));
}
