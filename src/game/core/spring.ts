/**
 * 1-D damped spring, integrated with semi-implicit Euler.
 * Stable at the 120 Hz fixed step for the stiffness values we use (ω·dt < 0.2).
 */
export class Spring {
    pos = 0;
    vel = 0;

    constructor(
        public stiffness: number,
        public damping: number,
    ) {}

    step(target: number, dt: number): void {
        const acc = this.stiffness * (target - this.pos) - this.damping * this.vel;
        this.vel += acc * dt;
        this.pos += this.vel * dt;
    }

    kick(dv: number): void {
        this.vel += dv;
    }

    reset(pos = 0): void {
        this.pos = pos;
        this.vel = 0;
    }
}
