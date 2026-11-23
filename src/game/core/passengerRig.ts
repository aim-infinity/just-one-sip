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
    private seat = 0;
    /** Fast decaying head vibration (rough road). */
    private jitterAmp = 0;
    private jitterPhase = 0;

    constructor(private t: Tuning) {
        this.torso = new Spring(t.torsoStiffness, t.torsoDamping);
        this.head = new Spring(t.headStiffness, t.headDamping);
        this.hand = new Spring(t.handStiffness, t.handDamping);
    }

    reset(seat: number): void {
        this.seat = seat;
        this.torso.reset(seat);
        this.head.reset(seat);
        this.hand.reset(seat);
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
    /** Mouth-to-bottle vertical misalignment (px, signed: + = head above bottle). */
    get misalign(): number {
        return this.head.pos + this.jitter - this.hand.pos;
    }
}
