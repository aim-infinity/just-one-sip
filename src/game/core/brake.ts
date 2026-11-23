import type { BrakeDef } from '../config/hazards';
import type { Hazard } from './road';

export type BrakePhase = 'decel' | 'hold' | 'recover';

/**
 * The driver braking for a cow or a red light. Produces a speed factor
 * (1 = normal, 0 = stopped) and reports when it's time to pull away.
 */
export class BrakeController {
    hazard: Hazard | null = null;
    phase: BrakePhase = 'decel';
    private def: BrakeDef | null = null;
    private t = 0;
    factor = 1;

    get active(): boolean {
        return this.hazard !== null;
    }

    start(hazard: Hazard, def: BrakeDef): void {
        this.hazard = hazard;
        this.def = def;
        this.phase = 'decel';
        this.t = 0;
    }

    /** Advances the brake. Returns 'go' on the frame the driver pulls away. */
    step(dt: number): 'go' | null {
        const d = this.def;
        if (!d || !this.hazard) {
            this.factor = 1;
            return null;
        }
        this.t += dt;
        const ease = (x: number) => x * x * (3 - 2 * x);
        if (this.phase === 'decel') {
            const k = Math.min(1, this.t / d.decelSec);
            // brake hard first, then ease off (feels like a real stop)
            this.factor = 1 - (1 - d.slowTo) * Math.sqrt(k);
            if (k >= 1) {
                this.phase = 'hold';
                this.t = 0;
            }
        } else if (this.phase === 'hold') {
            this.factor = d.slowTo;
            if (this.t >= d.holdSec) {
                this.phase = 'recover';
                this.t = 0;
                return 'go';
            }
        } else {
            const k = Math.min(1, this.t / d.recoverSec);
            this.factor = d.slowTo + (1 - d.slowTo) * ease(k);
            if (k >= 1) {
                this.hazard = null;
                this.def = null;
                this.factor = 1;
            }
        }
        return null;
    }
}
