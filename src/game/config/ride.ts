import { DRIVERS, type DriverId, type DriverProfile } from './drivers';
import type { BrakeDef, HazardType } from './hazards';
import type { SectionConfig } from './difficulty';
import { WEATHER, type WeatherId, type WeatherProfile } from './weather';

/** Everything the chosen driver + weather change about a ride. */
export interface RideMods {
    driver: DriverProfile;
    weather: WeatherProfile;
    /** Multiplies the speed curve. */
    speedMul: number;
}

export function rideMods(driver: DriverId = 'careful', weather: WeatherId = 'sunny'): RideMods {
    const d = DRIVERS[driver];
    const w = WEATHER[weather];
    return { driver: d, weather: w, speedMul: d.speedMul * w.speedMul };
}

/** Plain behaviour (used by tests, the tutorial and the home-screen demo). */
export const DEFAULT_MODS: RideMods = {
    driver: { ...DRIVERS.careful, speedMul: 1, caution: null, brakeDecelMul: 1, brakeJoltMul: 1, extraWeights: {}, lines: { start: [] } },
    weather: WEATHER.sunny,
    speedMul: 1,
};

/** Section spawn weights after weather multipliers and driver extras. */
export function sectionWeights(s: SectionConfig, m: RideMods): Partial<Record<HazardType, number>> {
    const out: Partial<Record<HazardType, number>> = {};
    for (const [k, v] of Object.entries(s.weights) as [HazardType, number][]) out[k] = v * (m.weather.weightMul[k] ?? 1);
    if (s.name !== 'opening') for (const [k, v] of Object.entries(m.driver.extraWeights) as [HazardType, number][]) out[k] = (out[k] ?? 0) + v;
    return out;
}

/** A hazard's brake behaviour as this driver drives it, in this weather. */
export function brakeFor(def: BrakeDef, m: RideMods): BrakeDef {
    return {
        ...def,
        decelSec: def.decelSec * m.driver.brakeDecelMul * m.weather.brakeDecelMul,
        jolt: def.jolt * m.driver.brakeJoltMul,
    };
}
