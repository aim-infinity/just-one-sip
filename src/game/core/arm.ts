import type { Tuning } from '../config/tuning';

export type ArmState = 'lowered' | 'raising' | 'atMouth' | 'lowering';

/**
 * Hold → raise (≈400 ms). Release → lower (≈250 ms). Fully reversible mid-motion.
 * `progress` is 0 at the lap and 1 at the lips.
 */
export class Arm {
    progress = 0;
    state: ArmState = 'lowered';

    constructor(private t: Tuning) {}

    step(holding: boolean, dt: number): ArmState {
        if (holding) {
            this.progress = Math.min(1, this.progress + dt / (this.t.raiseMs / 1000));
            this.state = this.progress >= 1 ? 'atMouth' : 'raising';
        } else {
            this.progress = Math.max(0, this.progress - dt / (this.t.lowerMs / 1000));
            this.state = this.progress <= 0 ? 'lowered' : 'lowering';
        }
        return this.state;
    }

    /** Bottle is at the lips — water can flow. */
    get atLips(): boolean {
        return this.progress >= this.t.mouthThreshold;
    }

    /** How tipped the bottle is (0 upright … 1 fully tipped). Drives slosh risk. */
    get tip(): number {
        const p = this.progress;
        const x = Math.min(1, Math.max(0, (p - 0.35) / 0.65));
        return x * x * (3 - 2 * x);
    }

    reset(): void {
        this.progress = 0;
        this.state = 'lowered';
    }
}
