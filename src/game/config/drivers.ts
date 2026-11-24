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
        name: 'Pothole Pandey',
        trait: 'Careful',
        blurb: 'Slows down for every bump. Softer hits, longer ride.',
        emoji: '🧘',
        speedMul: 0.95,
        caution: { slowTo: 0.75, leadSec: 0.7 },
        brakeDecelMul: 1.3,
        brakeJoltMul: 0.75,
        extraWeights: {},
        lines: {
            start: ['Sit back, I’ll take it easy.', 'No rush. We’ll get there.'],
            slowing: ['Easy now…', 'Bump ahead, hold on.', 'Careful…'],
            braking: ['Hold on…'],
        },
    },
    impatient: {
        id: 'impatient',
        name: 'Turbo Tiwari',
        trait: 'Impatient',
        blurb: 'In a hurry. Slams the brakes when bikes cut in.',
        emoji: '😤',
        speedMul: 1.06,
        caution: null,
        brakeDecelMul: 0.7,
        brakeJoltMul: 1.35,
        extraWeights: { cutIn: 2.5 },
        lines: {
            start: ['Hold tight, I know a shortcut.', 'Let’s go, I’ve got another ride after this.'],
            braking: ['Whoa!', 'Watch it!', 'No signal?!', 'Come on…'],
        },
    },
    overconfident: {
        id: 'overconfident',
        name: 'Bumper Babu',
        trait: 'Overconfident',
        blurb: 'Fastest driver in the city (he says). Never slows down.',
        emoji: '😎',
        speedMul: 1.1,
        caution: null,
        brakeDecelMul: 0.9,
        brakeJoltMul: 1.1,
        extraWeights: {},
        lines: {
            start: ['Smooth road today, trust me.', 'Ten minutes, guaranteed!'],
            beforePothole: ['Road’s perfect!', 'Smooth all the way!', 'Not a bump in sight!', 'Trust me!'],
            braking: ['No problem!'],
        },
    },
};

export const DRIVER_IDS = Object.keys(DRIVERS) as DriverId[];
