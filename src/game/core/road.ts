import { HAZARDS, type HazardType, type KickPoint } from '../config/hazards';
import { MASSIVE_POTHOLE, ROUTE_LAYOUT, SECTIONS, sectionAt, type SectionConfig } from '../config/difficulty';
import { DEFAULT_MODS, sectionWeights, type RideMods } from '../config/ride';
import { progressAtFront, routePx, speedPxAt, type Tuning } from '../config/tuning';
import { Rng } from './rng';

export interface Hazard {
    id: number;
    type: HazardType;
    /** World x of the leading edge (px). */
    x: number;
    width: number;
    /** Depth/height magnitude (px). */
    depth: number;
    impact: number;
    kicks: KickPoint[];
    /** Index of the block (combo hazards share a block). */
    block: number;
}

export const hazardEnd = (h: Hazard) => h.x + h.width;

/** Vertical road displacement contributed by one hazard at world x (up = +). */
export function hazardProfile(h: Hazard, x: number): number {
    const u = (x - h.x) / h.width;
    if (u <= 0 || u >= 1) return 0;
    const shape = HAZARDS[h.type].shape;
    if (shape === 'flat') return 0;
    if (shape === 'dip') {
        // steep walls, flat-ish bottom
        const s = Math.sin(Math.PI * u);
        return -h.depth * Math.min(1, s * 1.6);
    }
    if (shape === 'hump') {
        return h.depth * Math.sin(Math.PI * u) ** 1.5;
    }
    // ripple: several small bumps
    return h.depth * Math.sin(Math.PI * u * 6) * Math.sin(Math.PI * u);
}

/**
 * The road: a sorted list of hazards plus queries in world space.
 * Hazards can be inserted during play (tutorial) as long as they are ahead.
 */
export class Road {
    readonly hazards: Hazard[] = [];
    private nextId = 1;

    constructor(
        hazards: Omit<Hazard, 'id'>[] = [],
        public readonly lengthPx = Infinity,
    ) {
        hazards.forEach((h) => this.add(h));
    }

    add(h: Omit<Hazard, 'id'>): Hazard {
        const hz: Hazard = { ...h, id: this.nextId++ };
        let i = this.hazards.length;
        while (i > 0 && this.hazards[i - 1].x > hz.x) i--;
        this.hazards.splice(i, 0, hz);
        return hz;
    }

    heightAt(x: number): number {
        let y = 0;
        for (const h of this.hazards) {
            if (h.x > x) break;
            if (hazardEnd(h) > x) y += hazardProfile(h, x);
        }
        return y;
    }

    /** First hazard whose leading edge is at or ahead of world x. */
    nextHazardFrom(x: number): Hazard | undefined {
        return this.hazards.find((h) => h.x >= x);
    }
}

// ─── Procedural generation ─────────────────────────────────────────────────

export interface RouteLayout {
    seed: number;
    lengthPx: number;
    hazards: Omit<Hazard, 'id'>[];
    /** Seconds of road where a careful player can safely drink. */
    drinkWindowSec: number;
    attempts: number;
}

function makeHazard(rng: Rng, type: HazardType, x: number, block: number, t: Tuning, mul: number): Omit<Hazard, 'id'> {
    const d = HAZARDS[type];
    let width = Math.round(rng.range(d.widthPx[0], d.widthPx[1]));
    // A signal's stop line sits exactly where the front wheel will come to rest.
    if (d.brake && d.brake.slowTo === 0) width = Math.round((frontSpeed(t, x, mul) * d.brake.decelSec) / 2);
    // depth and impact are correlated, so a deeper hole really does hit harder
    const k = rng.next();
    return {
        type,
        x,
        width,
        depth: d.depthPx[0] + (d.depthPx[1] - d.depthPx[0]) * k,
        impact: d.impact[0] + (d.impact[1] - d.impact[0]) * (0.75 * k + 0.25 * rng.next()),
        kicks: d.kicks,
        block,
    };
}

/** Auto speed (px/s) when its front wheel is at world x. */
export function frontSpeed(t: Tuning, x: number, mul = 1): number {
    return speedPxAt(t, progressAtFront(t, x)) * mul;
}

/** Seconds for the front wheel to travel from world x1 to x2 (follows the speed curve, ignores braking). */
export function travelSec(t: Tuning, x1: number, x2: number, mul = 1): number {
    if (x2 <= x1) return 0;
    const n = Math.max(1, Math.ceil((x2 - x1) / 60));
    const dx = (x2 - x1) / n;
    let sec = 0;
    for (let i = 0; i < n; i++) sec += dx / frontSpeed(t, x1 + (i + 0.5) * dx, mul);
    return sec;
}

/** Minimum clear-road seconds after a block whose last hazard is `type`, at speed v (px/s). */
export function minClearSec(t: Tuning, type: HazardType, v: number): number {
    return t.wheelbasePx / v + Math.max(t.reactionTimeSec, HAZARDS[type].minSpacingSec);
}

/** Whether a ride gets a massive pothole: 'random' (MASSIVE_POTHOLE.chance), 'always', 'never'. */
export type MassiveMode = 'random' | 'always' | 'never';

export interface RouteOptions {
    massive?: MassiveMode;
}

/** Route progress at which the massive pothole goes, or null for none. Own RNG stream. */
export function planMassive(seed: number, mode: MassiveMode = 'random'): number | null {
    if (mode === 'never') return null;
    const rng = new Rng((seed ^ 0x5bd1e995) >>> 0);
    const roll = rng.next();
    if (mode === 'random' && roll >= MASSIVE_POTHOLE.chance) return null;
    const [a, b] = MASSIVE_POTHOLE.window;
    return rng.range(a, b);
}

function layoutOnce(seed: number, t: Tuning, relax: number, mods: RideMods, opts: RouteOptions = {}): Omit<RouteLayout, 'attempts' | 'drinkWindowSec'> {
    const mul = mods.speedMul;
    const rng = new Rng(seed);
    const massiveAt = planMassive(seed, opts.massive);
    let massivePlaced = false;
    let prevEnd = t.wheelbasePx;
    const length = routePx(t);
    // Hazards are placed in world space; the front wheel starts at wheelbasePx.
    const finish = length + t.wheelbasePx;
    const end = finish - ROUTE_LAYOUT.finishClearSec * frontSpeed(t, finish, mul);
    const hazards: Omit<Hazard, 'id'>[] = [];
    // first hazard after `firstHazardSec` of actual travel (the auto speeds up as it goes)
    let x = t.wheelbasePx;
    while (travelSec(t, t.wheelbasePx, x, mul) < ROUTE_LAYOUT.firstHazardSec) x += 10;
    let block = 0;

    while (x < end) {
        const section: SectionConfig = sectionAt(progressAtFront(t, x));
        const massive = massiveAt !== null && !massivePlaced && progressAtFront(t, x) >= massiveAt;
        if (massive) {
            // guarantee a long clear run-up so it's visible and avoidable
            x = Math.max(x, prevEnd + MASSIVE_POTHOLE.leadSec * frontSpeed(t, prevEnd, mul));
        }
        const type: HazardType = massive ? 'massivePothole' : rng.weighted(sectionWeights(section, mods));
        const first = makeHazard(rng, type, x, block, t, mul);
        if (first.x + first.width > end) break;
        hazards.push(first);
        if (massive) massivePlaced = true;
        let last = first;

        if (!massive && HAZARDS[type].comboable && section.comboChance > 0 && rng.chance(section.comboChance)) {
            const comboType = rng.pick(COMBO_TYPES);
            // speed rises across the gap, so size it at the (faster) far end
            const gx = last.x + last.width;
            const cx = gx + t.comboGapSec * frontSpeed(t, gx + t.comboGapSec * frontSpeed(t, gx, mul), mul);
            const second = makeHazard(rng, comboType, cx, block, t, mul);
            if (second.x + second.width < end) {
                hazards.push(second);
                last = second;
            }
        }

        block++;
        const v = frontSpeed(t, last.x + last.width, mul);
        const wantSafe = section.safeEvery > 0 && block % section.safeEvery === 0;
        let gap = wantSafe ? section.safeGapSec : rng.range(section.gapSec[0], section.gapSec[1]);
        gap = Math.max(gap * t.obstacleSpacingScale * relax, minClearSec(t, last.type, v));
        if (massive) gap = Math.max(gap, MASSIVE_POTHOLE.trailSec);
        prevEnd = last.x + last.width;
        x = prevEnd + gap * v;
    }
    // Planned but didn't fit before the stop: clear the tail and put it in the last slot.
    if (massiveAt !== null && !massivePlaced) {
        const v = frontSpeed(t, end, mul);
        const lead = MASSIVE_POTHOLE.leadSec * v;
        const w = HAZARDS.massivePothole.widthPx[1];
        const tailEnd = () => (hazards.length ? hazards[hazards.length - 1].x + hazards[hazards.length - 1].width : t.wheelbasePx);
        while (hazards.length && tailEnd() + lead > end - w) hazards.pop();
        hazards.push(makeHazard(rng, 'massivePothole', Math.max(tailEnd() + lead, end - w - lead * 0.5), block, t, mul));
    }
    return { seed, lengthPx: length, hazards };
}

const COMBO_TYPES = (Object.keys(HAZARDS) as HazardType[]).filter((k) => HAZARDS[k].comboable);

/**
 * Estimate how many seconds of genuinely safe drinking a layout offers:
 * time between blocks, minus wheelbase traversal, settling and arm raise.
 * Conservative: ignores the extra (sippable) time spent stopped at signals.
 */
export function drinkWindowSec(hazards: Omit<Hazard, 'id'>[], t: Tuning, lengthPx = routePx(t), mul = 1): number {
    const raise = t.raiseMs / 1000;
    const margin = 0.1;
    const blocks: { start: number; end: number }[] = [];
    for (const h of hazards) {
        const b = blocks[blocks.length - 1];
        if (b && h.x - b.end < t.comboGapSec * frontSpeed(t, h.x, mul) * 1.5) b.end = Math.max(b.end, h.x + h.width);
        else blocks.push({ start: h.x, end: h.x + h.width });
    }
    let total = 0;
    let freeFrom = t.wheelbasePx; // front wheel world x from which the road is clear
    for (const b of blocks) {
        total += Math.max(0, travelSec(t, freeFrom, b.start, mul) - raise - margin);
        // rear wheel must clear the block, then settle
        freeFrom = b.end + t.wheelbasePx + t.settleSec * frontSpeed(t, b.end, mul);
    }
    const finish = lengthPx + t.wheelbasePx;
    total += Math.max(0, travelSec(t, freeFrom, finish, mul) - raise);
    return total;
}

export function requiredDrinkSec(t: Tuning): number {
    return t.capacityMl / t.drinkRateMlPerSec;
}

/**
 * Seeded, constrained generator. Retries with derived seeds until the layout
 * guarantees enough safe drinking time; relaxes spacing as a last resort.
 */
export function generateRoute(seed: number, t: Tuning, mods: RideMods = DEFAULT_MODS, opts: RouteOptions = {}): RouteLayout {
    const need = requiredDrinkSec(t) * ROUTE_LAYOUT.minDrinkWindowRatio;
    let best: RouteLayout | undefined;
    for (let attempt = 0; attempt < ROUTE_LAYOUT.maxAttempts; attempt++) {
        const relax = attempt < ROUTE_LAYOUT.maxAttempts / 2 ? 1 : 1 + (attempt - ROUTE_LAYOUT.maxAttempts / 2) * 0.08;
        const s = (seed + attempt * 7919) >>> 0;
        const layout = layoutOnce(s, t, relax, mods, opts);
        const window = drinkWindowSec(layout.hazards, t, layout.lengthPx, mods.speedMul);
        const candidate: RouteLayout = { ...layout, seed, drinkWindowSec: window, attempts: attempt + 1 };
        if (window >= need) return candidate;
        if (!best || window > best.drinkWindowSec) best = candidate;
    }
    return best!;
}

export { SECTIONS };
