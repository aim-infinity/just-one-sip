import type { Tuning } from '../config/tuning';
import { Spring } from './spring';
import type { Wheel } from './collisions';

/**
 * Two-corner suspension. Each axle corner is a damped spring chasing the road
 * height under its wheel, plus velocity kicks from hazard edges.
 * Body height and pitch are derived from the two corners.
 */
export class Suspension {
    readonly rear: Spring;
    readonly front: Spring;

    constructor(private t: Tuning) {
        this.rear = new Spring(t.suspensionStiffness, t.suspensionDamping);
        this.front = new Spring(t.suspensionStiffness, t.suspensionDamping);
    }

    kick(wheel: Wheel, dv: number): void {
        (wheel === 'rear' ? this.rear : this.front).kick(dv);
        // a little transfer to the other axle through the chassis
        (wheel === 'rear' ? this.front : this.rear).kick(dv * 0.25);
    }

    step(rearRoad: number, frontRoad: number, dt: number): void {
        for (const s of [this.rear, this.front]) {
            s.stiffness = this.t.suspensionStiffness;
            s.damping = this.t.suspensionDamping;
        }
        this.rear.step(rearRoad, dt);
        this.front.step(frontRoad, dt);
    }

    /** Body (axle-midpoint) height, up = +. */
    get height(): number {
        return (this.rear.pos + this.front.pos) / 2;
    }

    /** Pitch in radians, nose-up = +. */
    get pitch(): number {
        return Math.atan2(this.front.pos - this.rear.pos, this.t.wheelbasePx);
    }

    /** Height of a point a fraction f along the wheelbase from the rear axle. */
    heightAt(f: number): number {
        return this.rear.pos + (this.front.pos - this.rear.pos) * f;
    }

    /** Vertical velocity at fraction f (for slosh/jolt estimates). */
    velocityAt(f: number): number {
        return this.rear.vel + (this.front.vel - this.rear.vel) * f;
    }
}
