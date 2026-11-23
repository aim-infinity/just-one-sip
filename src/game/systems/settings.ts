/** Player preferences + personal best, persisted to localStorage (fails soft). */
import type { DriverId } from '../config/drivers';
import type { WeatherId } from '../config/weather';

export interface Settings {
    driver: DriverId;
    weather: WeatherId;
    muted: boolean;
    reducedMotion: boolean;
    haptics: boolean;
    tutorialSeen: boolean;
}

export interface Best {
    score: number;
    consumedMl: number;
    wins: number;
    rides: number;
}

const SETTINGS_KEY = 'jos.settings.v1';
const BEST_KEY = 'jos.best.v1';

function read<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
}

function write(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* private mode / quota — ignore */
    }
}

const prefersReduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const settings: Settings = read<Settings>(SETTINGS_KEY, {
    driver: 'careful',
    weather: 'sunny',
    muted: false,
    reducedMotion: prefersReduced,
    haptics: true,
    tutorialSeen: false,
});

export function saveSettings(): void {
    write(SETTINGS_KEY, settings);
}

export function loadBest(): Best {
    return read<Best>(BEST_KEY, { score: 0, consumedMl: 0, wins: 0, rides: 0 });
}

/** Records a ride; returns { best, isNewBest }. */
export function recordRide(score: number, consumedMl: number, won: boolean): { best: Best; isNewBest: boolean } {
    const best = loadBest();
    const isNewBest = score > best.score;
    best.rides++;
    if (won) best.wins++;
    if (isNewBest) best.score = score;
    best.consumedMl = Math.max(best.consumedMl, consumedMl);
    write(BEST_KEY, best);
    return { best, isNewBest };
}
