export type Outcome = 'won' | 'arrivedThirsty' | 'spilledOut' | 'ejected';

export interface RideResult {
    outcome: Outcome;
    consumedMl: number;
    spilledMl: number;
    remainingMl: number;
    capacityMl: number;
    distanceM: number;
    routeM: number;
    timeSec: number;
    seed: number;
}

/**
 * Score: reward drinking, punish spilling hard, and reward *clean* finishes
 * more than fast ones — so sipping through every pothole never pays off.
 */
export function computeScore(r: RideResult): number {
    const base = r.consumedMl * 10 - r.spilledMl * 20;
    let bonus = 0;
    if (r.outcome === 'won') {
        const st = stars(r);
        bonus = 1000 + Math.max(0, r.routeM - r.distanceM) * 5 + (st === 3 ? 1000 : st === 2 ? 400 : 0);
    }
    return Math.max(0, Math.round(base + bonus));
}

/** 0–3 stars for the share card. */
export function stars(r: RideResult): number {
    if (r.outcome !== 'won') return r.consumedMl >= r.capacityMl * 0.6 ? 1 : 0;
    if (r.spilledMl < 10) return 3;
    return r.spilledMl < 35 ? 2 : 1;
}

export function headline(r: RideResult): string {
    switch (r.outcome) {
        case 'won':
            return 'BOTTLE FINISHED!';
        case 'spilledOut':
            return 'TOO MANY SPLASHES!';
        case 'ejected':
            return 'FLIGHT MODE ON!';
        default:
            return 'ARRIVED THIRSTY';
    }
}

/** Friendly, light-hearted verdict. Deterministic for a given result. */
export function verdict(r: RideResult): string {
    const { consumedMl: c, spilledMl: s } = r;
    const pool: string[] = [];
    if (r.outcome === 'won') {
        if (s < 1) pool.push('Not a single drop wasted. Smooth sipper!', 'Perfect ride. The potholes never stood a chance.');
        else if (s < 15) pool.push('Hydrated and happy. Nicely timed!', 'Bottle done, shirt (mostly) dry.');
        else pool.push('Bottle done! Your shirt had a sip too.', 'You made it, splashes and all.');
    } else if (r.outcome === 'ejected') {
        pool.push('Bro unlocked flight mode.', 'Lower the bottle before the BIG ones!', 'Next stop: low Earth orbit.', 'The roof had one job.');
    } else if (r.outcome === 'spilledOut') {
        pool.push('The bumps won this round. Try again!', 'Too many splashes this time. Lower before the bumps!', 'Soaked, but not defeated. One more ride?');
    } else if (r.remainingMl < 30) {
        pool.push('So close! Just one more sip.', 'Almost there. Next ride is yours!');
    } else if (c < 80) {
        pool.push('Sip a little earlier on the smooth road.', 'The road kept you busy. Try sipping between bumps!');
    } else {
        pool.push('Good effort! A bit more sipping on smooth road.', 'Halfway hydrated. You’ve got this next time.');
    }
    return pool[Math.abs(Math.round(c * 7 + s * 13 + r.seed)) % pool.length];
}
