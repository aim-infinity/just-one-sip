import type { HazardType } from './hazards';

/**
 * Weather changes how the *same* road plays, without new systems:
 *  - rain: puddles partially hide potholes, braking is slippery (longer stops
 *    plus a skid jolt), more waterlogged roads, slightly slower traffic
 *  - night: reduced visibility; headlight + street lamps light the road
 */
export type WeatherId = 'sunny' | 'rainy' | 'night';

export interface WeatherProfile {
    id: WeatherId;
    label: string;
    emoji: string;
    blurb: string;
    speedMul: number;
    /** Multiplies hazard spawn weights. */
    weightMul: Partial<Record<HazardType, number>>;
    /** Slippery braking: decel takes longer and the auto skids once. */
    slippery: boolean;
    brakeDecelMul: number;
    /** Potholes partly covered by puddles (visual only). */
    puddles: boolean;
    night: boolean;
}

export const WEATHER: Record<WeatherId, WeatherProfile> = {
    sunny: {
        id: 'sunny',
        label: 'Sunny',
        emoji: '☀️',
        blurb: 'Clear skies, clear potholes.',
        speedMul: 1,
        weightMul: {},
        slippery: false,
        brakeDecelMul: 1,
        puddles: false,
        night: false,
    },
    rainy: {
        id: 'rainy',
        label: 'Rainy',
        emoji: '🌧️',
        blurb: 'Puddles hide potholes. Brakes slip.',
        speedMul: 0.95,
        weightMul: { waterlogged: 2.5, uneven: 1.4, speedBreaker: 0.8 },
        slippery: true,
        brakeDecelMul: 1.5,
        puddles: true,
        night: false,
    },
    night: {
        id: 'night',
        label: 'Night',
        emoji: '🌙',
        blurb: 'Only the headlight and street lamps.',
        speedMul: 1,
        weightMul: {},
        slippery: false,
        brakeDecelMul: 1,
        puddles: false,
        night: true,
    },
};

export const WEATHER_IDS = Object.keys(WEATHER) as WeatherId[];
