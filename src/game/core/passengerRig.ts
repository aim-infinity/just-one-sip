import type { Tuning } from '../config/tuning';
import { Spring } from './spring';

/**
 * The passenger's torso, head and drinking hand, each a spring following the
 * seat. Because the head is loose and the hand is braced, a jolt moves them
 * *differently* — which is exactly what breaks drinking alignment.
 *
 * All offsets are relative to the seat (up = +).
 */
export class PassengerRig {
    readonly torso: Spring;
    readonly head: Spring;
    readonly hand: Spring;
    /** Horizontal (forward = +) offsets — braking throws the head forward. */
    readonly torsoX: Spring;
    readonly headX: Spring;
    readonly handX: Spring;
    private seat = 0;
    /** Fast decaying head vibration (rough road). */
    private jitterAmp = 0;
    private jitterPhase = 0;

    constructor(private t: Tuning) {
        this.torso = new Spring(t.torsoStiffness, t.torsoDamping);
        this.head = new Spring(t.headStiffness, t.headDamping);
        this.hand = new Spring(t.handStiffness, t.handDamping);
        this.torsoX = new Spring(t.torsoXStiffness, t.torsoXDamping);
        this.headX = new Spring(t.headXStiffness, t.headXDamping);
        this.handX = new Spring(t.handXStiffness, t.handXDamping);
    }

    /** Forward (+) / backward (−) jolt from braking or pulling away. */
    kickX(dv: number): void {
        this.torsoX.kick(dv * this.t.brakeTorsoKick);
        this.headX.kick(dv * this.t.brakeHeadKick);
        this.handX.kick(dv * this.t.brakeHandKick);
    }

    reset(seat: number): void {
        this.seat = seat;
        this.torso.reset(seat);
        this.head.reset(seat);
        this.hand.reset(seat);
        this.torsoX.reset();
        this.headX.reset();
        this.handX.reset();
    }

    /** The seat has been kicked with dv; each body part receives its share. */
    kick(dv: number): void {
        this.torso.kick(dv * this.t.torsoKick);
        this.head.kick(dv * this.t.headKick);
        this.hand.kick(dv * this.t.handKick);
    }

    /** Rough-road chatter: the head vibrates quickly relative to the braced hand. */
    rattle(px: number): void {
        this.jitterAmp = Math.max(this.jitterAmp, px);
    }

    step(seat: number, dt: number): void {
        this.seat = seat;
        this.jitterPhase += dt * Math.PI * 2 * 11;
        this.jitterAmp *= Math.exp(-dt * 6);
        if (this.jitterAmp < 0.01) this.jitterAmp = 0;
        this.torso.stiffness = this.t.torsoStiffness;
        this.torso.damping = this.t.torsoDamping;
        this.head.stiffness = this.t.headStiffness;
        this.head.damping = this.t.headDamping;
        this.hand.stiffness = this.t.handStiffness;
        this.hand.damping = this.t.handDamping;
        this.torso.step(seat, dt);
        this.head.step(seat, dt);
        this.hand.step(seat, dt);
        this.torsoX.stiffness = this.t.torsoXStiffness;
        this.torsoX.damping = this.t.torsoXDamping;
        this.headX.stiffness = this.t.headXStiffness;
        this.headX.damping = this.t.headXDamping;
        this.handX.stiffness = this.t.handXStiffness;
        this.handX.damping = this.t.handXDamping;
        this.torsoX.step(0, dt);
        this.headX.step(0, dt);
        this.handX.step(0, dt);
    }

    get torsoOffset(): number {
        return this.torso.pos - this.seat;
    }
    get jitter(): number {
        return this.jitterAmp * Math.sin(this.jitterPhase);
    }
    get headOffset(): number {
        return this.head.pos - this.seat + this.jitter;
    }
    get handOffset(): number {
        return this.hand.pos - this.seat;
    }
    /** Vertical mouth-to-bottle gap (px, + = head above bottle). */
    get misalignY(): number {
        return this.head.pos + this.jitter - this.hand.pos;
    }
    /** Horizontal mouth-to-bottle gap (px, + = head ahead of bottle). */
    get misalignX(): number {
        return this.headX.pos - this.handX.pos;
    }
    /** Total mouth-to-bottle distance (px). */
    get misalign(): number {
        return Math.hypot(this.misalignY, this.misalignX);
    }
}
