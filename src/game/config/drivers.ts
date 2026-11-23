import type { HazardType } from './hazards';

/**
 * Driver personalities. The player never controls the auto — the driver
 * changes the *rhythm* of the ride. All values are multipliers on defaults.
 */
export type DriverId = 'careful' | 'impatient' | 'overconfident';

export interface DriverProfile {
    id: DriverId;
    name: string;
    trait: string;
    blurb: string;
    emoji: string;
    /** Multiplies the whole speed curve. */
    speedMul: number;
    /** Slows down before bumps: target speed factor and how early (s). null = never slows. */
    caution: { slowTo: number; leadSec: number } | null;
    /** Brake behaviour: shorter decel = more sudden; jolt multiplier. */
    brakeDecelMul: number;
    brakeJoltMul: number;
    /** Extra hazard spawn weights added to the middle/final sections. */
    extraWeights: Partial<Record<HazardType, number>>;
    lines: {
        start: string[];
        /** Said ~1 s before a pothole. */
        beforePothole?: string[];
        /** Said while slowing for a bump. */
        slowing?: string[];
        /** Said when braking for something. */
        braking?: string[];
    };
}

export const DRIVERS: Record<DriverId, DriverProfile> = {
    careful: {
        id: 'careful',
        name: 'Shankar',
        trait: 'Careful',
        blurb: 'Slows down for every bump. Softer hits, longer ride.',
        emoji: '🧘',
        speedMul: 0.95,
        caution: { slowTo: 0.75, leadSec: 0.7 },
        brakeDecelMul: 1.3,
        brakeJoltMul: 0.75,
        extraWeights: {},
        lines: {
            start: ['Sit properly saar, I will go slowly.', 'No hurry saar, safe ride.'],
            slowing: ['Slowly, slowly…', 'Bump coming, hold on saar.', 'Careful, careful…'],
            braking: ['Wait, wait…'],
        },
    },
    impatient: {
        id: 'impatient',
        name: 'Raju',
        trait: 'Impatient',
        blurb: 'In a hurry. Slams the brakes when bikes cut in.',
        emoji: '😤',
        speedMul: 1.06,
        caution: null,
        brakeDecelMul: 0.7,
        brakeJoltMul: 1.35,
        extraWeights: { cutIn: 2.5 },
        lines: {
            start: ['Fast-fast, I have next ride saar!', 'Hold tight, shortcut route.'],
            braking: ['Whoa! Where are you going?!', 'Saar, these bikers!', 'No indicator?!', 'Come on, come on…'],
        },
    },
    overconfident: {
        id: 'overconfident',
        name: 'Manju',
        trait: 'Overconfident',
        blurb: 'Fastest driver in the city (he says). Never slows down.',
        emoji: '😎',
        speedMul: 1.1,
        caution: null,
        brakeDecelMul: 0.9,
        brakeJoltMul: 1.1,
        extraWeights: {},
        lines: {
            start: ['Road super saar! Full smooth.', 'Ten minutes, guaranteed!'],
            beforePothole: ['Road super saar!', 'Full smooth, don’t worry!', 'No pothole, nothing saar!', 'Trust me saar!'],
            braking: ['No problem, no problem!'],
        },
    },
};

export const DRIVER_IDS = Object.keys(DRIVERS) as DriverId[];
