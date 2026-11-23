import { HAZARDS } from '../config/hazards';
import { routePx, speedPxAt, type Tuning } from '../config/tuning';
import { BrakeController } from './brake';
import { brakeFor, DEFAULT_MODS, type RideMods } from '../config/ride';
import { Arm, type ArmState } from './arm';
import { Bottle } from './bottle';
import { CollisionTracker, type CollisionEvent, type Wheel } from './collisions';
import { sloshAmount, stepDrinking } from './drinking';
import { PassengerRig } from './passengerRig';
import { Road, type Hazard } from './road';
import type { Outcome, RideResult } from './scoring';
import { Suspension } from './suspension';

export type SimEvent =
    | { kind: 'contact'; wheel: Wheel; hazard: Hazard }
    | { kind: 'kick'; wheel: Wheel; hazard: Hazard; severity: number }
    | { kind: 'slosh'; ml: number; severity: number }
    | { kind: 'miss'; ml: number }
    | { kind: 'gulp' }
    | { kind: 'sipStart' }
    | { kind: 'sipEnd'; drunkMl: number; spilledMl: number }
    | { kind: 'armState'; state: ArmState }
    | { kind: 'brake'; hazard: Hazard; severity: number }
    | { kind: 'go'; hazard: Hazard; severity: number }
    | { kind: 'skid'; hazard: Hazard; severity: number }
    | { kind: 'slowing'; hazard: Hazard }
    | { kind: 'end'; outcome: Outcome };

export type SimState = 'playing' | 'ended';

export interface SimOptions {
    seed: number;
    /** Practice mode: never ends, bottle refills when empty. */
    practice?: boolean;
    /** Driver + weather. Defaults to plain behaviour. */
    mods?: RideMods;
}

/**
 * The whole ride as pure, deterministic logic. No Phaser, no DOM.
 * Call `step(dt, holding)` with the fixed timestep; read state & drain events.
 */
export class RideSimulation {
    readonly bottle: Bottle;
    readonly arm: Arm;
    readonly suspension: Suspension;
    readonly rig: PassengerRig;
    readonly collisions: CollisionTracker;
    readonly brake = new BrakeController();
    readonly mods: RideMods;
    /** Careful drivers ease off before bumps (1 = full speed). */
    caution = 1;
    private cautionFor: number | null = null;
    /** Current forward speed (px/s), including braking. */
    speed = 0;

    /** Distance travelled = world x of the rear wheel (px). */
    distance = 0;
    time = 0;
    state: SimState = 'playing';
    outcome: Outcome | null = null;
    readonly events: SimEvent[] = [];

    /** Current mouth/bottle alignment, 0..1 (for visuals). */
    alignment = 1;
    /** Seconds since the last jolt (for reactions). */
    sinceJolt = 99;
    lastJoltSeverity = 0;
    /** Water spilled during the current sip. */
    private sipDrunk = 0;
    private sipSpilled = 0;
    private wasAtLips = false;
    private gulpAcc = 0;
    private lastArm: ArmState = 'lowered';
    private readonly collisionBuf: CollisionEvent[] = [];

    constructor(
        public readonly t: Tuning,
        public readonly road: Road,
        public readonly opts: SimOptions,
    ) {
        this.mods = opts.mods ?? DEFAULT_MODS;
        this.bottle = new Bottle(t.capacityMl);
        this.arm = new Arm(t);
        this.suspension = new Suspension(t);
        this.rig = new PassengerRig(t);
        this.collisions = new CollisionTracker(road, this.rearX, this.frontX);
        this.rig.reset(0);
    }

    get rearX(): number {
        return this.distance;
    }
    get frontX(): number {
        return this.distance + this.t.wheelbasePx;
    }
    get lengthPx(): number {
        return this.opts.practice ? Infinity : Math.min(this.road.lengthPx, routePx(this.t));
    }
    get progress(): number {
        return this.opts.practice ? 0 : Math.min(1, this.distance / this.lengthPx);
    }
    get distanceM(): number {
        return this.distance / this.t.pxPerMeter;
    }
    /** Cruising speed (px/s) at the current point of the route, ignoring brakes. */
    get cruiseSpeed(): number {
        return speedPxAt(this.t, this.progress) * this.mods.speedMul;
    }
    get remainingM(): number {
        return Math.max(0, (this.lengthPx - this.distance) / this.t.pxPerMeter);
    }

    step(dt: number, holding: boolean): void {
        if (this.state !== 'playing') return;
        const t = this.t;
        this.time += dt;
        this.sinceJolt += dt;

        // 1. Move the auto forward along the (capped) speed curve, minus any braking.
        const br = this.brake.step(dt);
        if (br === 'go') this.jolt(-HAZARDS[this.brake.hazard!.type].brake!.lurch * this.brake.hazard!.impact, 'go');
        if (br === 'skid') this.jolt(-0.5, 'skid');
        this.updateCaution(dt);
        this.speed = this.cruiseSpeed * this.brake.factor * this.caution;
        this.distance = Math.min(this.distance + this.speed * dt, this.lengthPx);

        // 2. World-space wheel/hazard collisions → suspension impulses.
        const buf = this.collisionBuf;
        buf.length = 0;
        this.collisions.advance('front', this.frontX, buf);
        this.collisions.advance('rear', this.rearX, buf);
        for (const ev of buf) {
            if (ev.kind === 'contact') {
                const bd = HAZARDS[ev.hazard.type].brake;
                if (bd) {
                    // Only the front wheel matters: the driver brakes for what's ahead.
                    if (ev.wheel === 'front' && !this.brake.active) {
                        const b = brakeFor(bd, this.mods);
                        this.brake.start(ev.hazard, b, this.mods.weather.slippery);
                        this.events.push(ev);
                        this.jolt(b.jolt * ev.hazard.impact, 'brake');
                    }
                    continue;
                }
                this.events.push(ev);
                continue;
            }
            // hits scale with how fast you're going (careful drivers slow down → softer)
            const pace = (0.45 + 0.55 * Math.min(1, this.speed / Math.max(1, this.cruiseSpeed))) * this.mods.speedMul;
            const dv = ev.strength * pace * t.kickBasePxPerSec * t.suspensionStrength;
            this.suspension.kick(ev.wheel, dv);
            const feel = ev.wheel === 'rear' ? 1 : t.frontWheelFeel;
            this.rig.kick(dv * feel);
            const rattle = HAZARDS[ev.hazard.type].rattlePx;
            if (rattle > 0) this.rig.rattle(rattle * Math.abs(ev.strength) * pace * feel * t.suspensionStrength);
            const severity = Math.abs(ev.strength) * pace * feel * t.suspensionStrength;
            this.events.push({ kind: 'kick', wheel: ev.wheel, hazard: ev.hazard, severity });
            if (severity > 0.15) {
                this.sinceJolt = 0;
                this.lastJoltSeverity = severity;
            }
            const slosh = this.bottle.spill(sloshAmount(t, this.arm.tip, this.bottle.fill, severity));
            if (slosh > 0) {
                this.sipSpilled += slosh;
                this.events.push({ kind: 'slosh', ml: slosh, severity });
            }
        }

        // 3. Springs.
        this.suspension.step(this.road.heightAt(this.rearX), this.road.heightAt(this.frontX), dt);
        this.rig.step(this.suspension.heightAt(t.seatFraction), dt);

        // 4. Arm & drinking.
        const armState = this.arm.step(holding, dt);
        if (armState !== this.lastArm) {
            this.lastArm = armState;
            this.events.push({ kind: 'armState', state: armState });
        }
        const atLips = this.arm.atLips && !this.bottle.isEmpty;
        if (atLips && !this.wasAtLips) {
            this.sipDrunk = 0;
            this.sipSpilled = 0;
            this.events.push({ kind: 'sipStart' });
        }
        const r = stepDrinking(t, this.arm, this.bottle, this.rig.misalign, dt);
        this.alignment = r.alignment;
        this.sipDrunk += r.drunk;
        this.sipSpilled += r.missed;
        if (r.missed > 0) this.events.push({ kind: 'miss', ml: r.missed });
        this.gulpAcc += r.drunk;
        if (this.gulpAcc >= 7) {
            this.gulpAcc -= 7;
            this.events.push({ kind: 'gulp' });
        }
        if (!atLips && this.wasAtLips) {
            this.events.push({ kind: 'sipEnd', drunkMl: this.sipDrunk, spilledMl: this.sipSpilled });
        }
        this.wasAtLips = atLips;

        // 5. Win / lose. Drink all of it → win. Mess meter full → ride over.
        if (this.opts.practice) {
            if (this.bottle.isEmpty || this.bottle.spilledMl >= t.spillLimitMl) this.bottle.refill();
            return;
        }
        if (this.bottle.spilledMl >= t.spillLimitMl) {
            this.finish('spilledOut');
        } else if (this.bottle.isEmpty) {
            this.finish('won');
        } else if (this.distance >= this.lengthPx) {
            this.finish('arrivedThirsty');
        }
    }

    /**
     * Longitudinal jolt: + = braking (passenger thrown forward, nose dives),
     * − = pulling away (thrown back). Severity ≈ 1 for an emergency stop.
     */
    /** Careful drivers ease off before a bump and until the rear wheel has cleared it. */
    private updateCaution(dt: number): void {
        const c = this.mods.driver.caution;
        if (!c) return;
        const lead = this.cruiseSpeed * c.leadSec;
        const bump = this.road.hazards.find(
            (h) => !HAZARDS[h.type].brake && h.x + h.width > this.rearX - 10 && h.x < this.frontX + lead,
        );
        const target = bump ? c.slowTo : 1;
        if (bump && this.cautionFor !== bump.id) {
            this.cautionFor = bump.id;
            this.events.push({ kind: 'slowing', hazard: bump });
        }
        const rate = target < this.caution ? 3 : 1.4;
        this.caution += Math.sign(target - this.caution) * Math.min(Math.abs(target - this.caution), rate * dt);
    }

    private jolt(severity: number, kind: 'brake' | 'go' | 'skid'): void {
        const t = this.t;
        const s = severity * t.suspensionStrength;
        this.rig.kickX(s * t.brakeKickPxPerSec);
        this.suspension.kick('front', -s * t.brakeDivePxPerSec);
        this.suspension.kick('rear', s * t.brakeDivePxPerSec * 0.5);
        const sev = Math.abs(s);
        if (sev > 0.15) {
            this.sinceJolt = 0;
            this.lastJoltSeverity = sev;
        }
        const hazard = this.brake.hazard!;
        this.events.push({ kind, hazard, severity: sev });
        const slosh = this.bottle.spill(sloshAmount(t, this.arm.tip, this.bottle.fill, sev));
        if (slosh > 0) {
            this.sipSpilled += slosh;
            this.events.push({ kind: 'slosh', ml: slosh, severity: sev });
        }
    }

    private finish(outcome: Outcome): void {
        if (this.wasAtLips) {
            this.events.push({ kind: 'sipEnd', drunkMl: this.sipDrunk, spilledMl: this.sipSpilled });
            this.wasAtLips = false;
        }
        this.state = 'ended';
        this.outcome = outcome;
        this.events.push({ kind: 'end', outcome });
    }

    /** Ms until the front wheel reaches the next hazard (Infinity if none). */
    timeToNextHazard(): { sec: number; hazard?: Hazard } {
        const h = this.road.nextHazardFrom(this.frontX);
        if (!h) return { sec: Infinity };
        return { sec: (h.x - this.frontX) / Math.max(1, this.cruiseSpeed), hazard: h };
    }

    result(): RideResult {
        return {
            outcome: this.outcome ?? 'arrivedThirsty',
            consumedMl: this.bottle.consumedMl,
            spilledMl: this.bottle.spilledMl,
            remainingMl: this.bottle.remainingMl,
            capacityMl: this.bottle.capacityMl,
            distanceM: this.distanceM,
            routeM: this.lengthPx / this.t.pxPerMeter,
            timeSec: this.time,
            seed: this.opts.seed,
        };
    }

    drainEvents(): SimEvent[] {
        return this.events.splice(0, this.events.length);
    }
}
