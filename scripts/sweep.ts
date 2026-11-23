// Dev: parameter sweep for balance. Prints bot win rates per configuration.
import { cloneTuning, speedPx, type Tuning } from '../src/game/config/tuning';
import { ROUTE_LAYOUT } from '../src/game/config/difficulty';
import { HAZARDS } from '../src/game/config/hazards';
import { Road, generateRoute } from '../src/game/core/road';
import { RideSimulation } from '../src/game/core/simulation';

type Bot = (s: RideSimulation, t: Tuning) => boolean;
const big = (h: { type: string }) => h.type === 'pothole' || h.type === 'waterlogged';
const smart: Bot = (s, t) => {
  const v = speedPx(t);
  const nb = s.road.hazards.find((h) => big(h) && h.x >= s.frontX);
  const tn = nb ? (nb.x - s.frontX) / v : 99;
  const rearOn = s.road.hazards.some((h) => big(h) && s.rearX > h.x - 5 && s.rearX < h.x + h.width + v * 0.2);
  return tn > 0.5 && !rearOn;
};
const careful: Bot = (s, t) => {
  const next = s.timeToNextHazard().sec;
  const rearOn = s.road.hazards.some((h) => s.rearX > h.x - 5 && s.rearX < h.x + h.width + speedPx(t) * 0.25);
  return next > 0.55 && !rearOn && s.sinceJolt > 0.25;
};
const sloppy: Bot = (s) => s.timeToNextHazard().sec > 0.2 && Math.floor(s.time * 1.3) % 3 !== 0;
const late: Bot = (s, t) => { // reacts late: lowers only 0.25s before
  const next = s.timeToNextHazard().sec;
  const rearOn = s.road.hazards.some((h) => s.rearX > h.x - 5 && s.rearX < h.x + h.width);
  return next > 0.25 && !rearOn;
};
const always: Bot = () => true;
const bots: [string, Bot][] = [['smart', smart], ['careful', careful], ['late', late], ['sloppy', sloppy], ['always', always]];

function run(over: Partial<Tuning>, sbImpact?: [number, number], ratio?: number) {
  const t = cloneTuning(over);
  if (sbImpact) HAZARDS.speedBreaker.impact = sbImpact;
  if (ratio) ROUTE_LAYOUT.minDrinkWindowRatio = ratio;
  const res: string[] = [];
  let hz = 0, att = 0;
  for (const [name, bot] of bots) {
    let wins = 0, time = 0; const N = 150;
    for (let s = 1; s <= N; s++) {
      const r = generateRoute(s * 31, t);
      if (name === 'smart') { hz += r.hazards.length; att += r.attempts; }
      const sim = new RideSimulation(t, new Road(r.hazards, r.lengthPx), { seed: s });
      while (sim.state === 'playing') sim.step(t.fixedStep, bot(sim, t));
      if (sim.outcome === 'won') { wins++; time += sim.time; }
    }
    res.push(`${name} ${Math.round(100 * wins / N)}%${wins ? '@' + (time / wins).toFixed(0) + 's' : ''}`);
  }
  console.log(JSON.stringify(over), sbImpact ?? '', ratio ?? '', `hz ${(hz / 150).toFixed(1)} att ${(att / 150).toFixed(1)} |`, res.join('  '));
}
const configs: [Partial<Tuning>, [number, number]?, number?][] = [[{}]];
for (const c of configs) run(...c);
