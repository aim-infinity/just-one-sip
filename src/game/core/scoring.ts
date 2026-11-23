export type Outcome = 'won' | 'arrivedThirsty' | 'spilledOut';

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

/** Score: reward drinking, punish spilling, bonus for finishing early. */
export function computeScore(r: RideResult): number {
    const base = r.consumedMl * 10 - r.spilledMl * 4;
    const win = r.outcome === 'won' ? 1000 + Math.max(0, r.routeM - r.distanceM) * 20 : 0;
    const clean = r.outcome === 'won' && r.spilledMl < 1 ? 500 : 0;
    return Math.max(0, Math.round(base + win + clean));
}

/** 0–3 stars for the share card. */
export function stars(r: RideResult): number {
    if (r.outcome !== 'won') return r.consumedMl >= r.capacityMl * 0.6 ? 1 : 0;
    if (r.spilledMl < 10) return 3;
    return r.spilledMl < 40 ? 2 : 1;
}

export function headline(r: RideResult): string {
    switch (r.outcome) {
        case 'won':
            return 'BOTTLE FINISHED!';
        case 'spilledOut':
            return 'BOTTLE EMPTY. STILL THIRSTY.';
        default:
            return 'ARRIVED THIRSTY';
    }
}

/** Funny contextual verdict. Deterministic for a given result. */
export function verdict(r: RideResult): string {
    const { consumedMl: c, spilledMl: s, capacityMl: cap } = r;
    const left = r.routeM - r.distanceM;
    const pool: string[] = [];
    if (r.outcome === 'won') {
        if (s < 1) pool.push('Not a single drop. Are you even in Bangalore?', 'Smooth operator. The potholes are filing a complaint.');
        else if (left > 60) pool.push('Finished before the driver asked for ₹20 extra.', 'Hydrated with a whole Cubbon Park to spare.');
        else if (s > 50) pool.push('Hydrated. Your shirt is also hydrated.', 'You won, but the seat cover drank a lot too.');
        else pool.push('Hydration achieved. Namma roads defeated.', 'One bottle, zero regrets. Mostly.');
    } else if (r.outcome === 'spilledOut') {
        pool.push("You survived the road. The water didn't.", 'Bangalore drank more than you.');
        if (s > 120) pool.push('Your shirt is now 60% water.');
    } else {
        if (cap - r.remainingMl > 0 && r.remainingMl < 30) pool.push('One sip away from greatness.', 'So close the bottle could taste it.');
        else if (s > c) pool.push('Bangalore drank more than you.', 'The auto floor is very well hydrated.');
        else if (c < 80 && s < 10) pool.push('Too scared to sip. Very relatable.', 'Hydration level: Silk Board.');
        else if (c < 100) pool.push('Hydration level: Silk Board.', 'Meter down. Water level: also down. Barely.');
        else pool.push("Meter's running. The bottle isn't empty.", 'Almost there. Like the metro line.');
    }
    const idx = Math.abs(Math.round(c * 7 + s * 13 + r.seed)) % pool.length;
    return pool[idx];
}
