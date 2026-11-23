/** Small deterministic PRNG (mulberry32). Same seed → same road. */
export class Rng {
    private s: number;

    constructor(seed: number) {
        this.s = seed >>> 0 || 0x9e3779b9;
    }

    next(): number {
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min: number, max: number): number {
        return min + (max - min) * this.next();
    }

    chance(p: number): boolean {
        return this.next() < p;
    }

    pick<T>(items: T[]): T {
        return items[Math.floor(this.next() * items.length) % items.length];
    }

    weighted<K extends string>(weights: Partial<Record<K, number>>): K {
        const entries = (Object.entries(weights) as [K, number | undefined][]).filter((e): e is [K, number] => (e[1] ?? 0) > 0);
        const total = entries.reduce((a, [, w]) => a + w, 0);
        let r = this.next() * total;
        for (const [k, w] of entries) {
            r -= w;
            if (r <= 0) return k;
        }
        return entries[entries.length - 1][0];
    }
}

export function randomSeed(): number {
    return (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
}
