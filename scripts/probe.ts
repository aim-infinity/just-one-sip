// Dev probe: prints physics/feasibility numbers used for balancing.
import { cloneTuning } from '../src/game/config/tuning';
import { HAZARDS, HAZARD_TYPES } from '../src/game/config/hazards';
import { Road, generateRoute, requiredDrinkSec } from '../src/game/core/road';
import { RideSimulation } from '../src/game/core/simulation';

const t = cloneTuning();
for (const type of HAZARD_TYPES) {
  const d = HAZARDS[type];
  const mid = (a: [number, number]) => (a[0] + a[1]) / 2;
  const road = new Road([{ type, x: 600, width: mid(d.widthPx), depth: mid(d.depthPx), impact: mid(d.impact), kicks: d.kicks, block: 0 }]);
  const sim = new RideSimulation(t, road, { seed: 1, practice: true });
  let peak = 0, body = 0, spilled = 0;
  for (let i = 0; i < 120 * 3; i++) { sim.step(t.fixedStep, sim.time > 0.4); peak = Math.max(peak, Math.abs(sim.rig.misalign)); body = Math.max(body, Math.abs(sim.suspension.height)); }
  spilled = sim.bottle.spilledMl;
  // upright
  const sim2 = new RideSimulation(t, new Road([{ type, x: 600, width: mid(d.widthPx), depth: mid(d.depthPx), impact: mid(d.impact), kicks: d.kicks, block: 0 }]), { seed: 1, practice: true });
  for (let i = 0; i < 360; i++) sim2.step(t.fixedStep, false);
  console.log(type.padEnd(13), 'peakMisalign', peak.toFixed(1), 'bodyPeak', body.toFixed(1), 'spill@mouth', spilled.toFixed(1), 'spillUpright', sim2.bottle.spilledMl.toFixed(1));
}
let min = 1e9, sum = 0, n = 200, hz = 0, attempts = 0;
for (let s = 1; s <= n; s++) { const r = generateRoute(s * 97, t); min = Math.min(min, r.drinkWindowSec); sum += r.drinkWindowSec; hz += r.hazards.length; attempts += r.attempts; }
console.log('need', requiredDrinkSec(t).toFixed(1), 's; window min', min.toFixed(1), 'avg', (sum / n).toFixed(1), 'hazards avg', (hz / n).toFixed(1), 'attempts avg', (attempts / n).toFixed(2));
// Bot win rates live in scripts/sweep.ts (`npm run balance`).
