import Phaser from 'phaser';
import type { RideSimulation } from '../core/simulation';
import { settings } from '../systems/settings';
import { sound } from '../systems/sound';
import { vibrate } from '../systems/haptics';
import { HIP, waterPolygon } from './AutoView';
import { DESIGN_HEIGHT, FONT, PALETTE as P } from './palette';
import { RS } from './resolution';
import { RoofBreakEffect } from './RoofBreakEffect';
import type { WorldView } from './WorldView';

type V = { x: number; y: number };

/**
 * Timeline (seconds after the massive-pothole rebound). The impact itself
 * (front wheel drops in, nose dives, suspension compresses) has already been
 * simulated by the time the sequence starts; these phases are the comedy.
 */
export const EJECT_TIMING = {
    /** Passenger jerks up and the head hits the roof. */
    hitRoof: 0.2,
    /** Canopy stretches into a dome and cracks. */
    stretch: 0.3,
    /** Ballistic flight up to the peak. */
    fly: 1.2,
    /** Comedic hang at the top of the flight. */
    pause: 0.45,
    /** Whoosh off into the sky. */
    vanish: 0.35,
    /** Then a beat before the results card. */
    toResults: 0.6,
};

/** How high (design px) the passenger rises before the comedic pause. */
const RISE_PX = 1000;
/** Screen y the camera keeps the passenger's hips at while following. */
const FOLLOW_Y = 300;

const T0 = EJECT_TIMING.hitRoof;
const T1 = T0 + EJECT_TIMING.stretch; // roof breaks
const T2 = T1 + EJECT_TIMING.fly; // peak
const T3 = T2 + EJECT_TIMING.pause; // vanish
const T4 = T3 + EJECT_TIMING.vanish; // gone
const T5 = T4 + EJECT_TIMING.toResults; // results

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export interface EjectionHooks {
    /** Called at the top of the flight (snapshot + message). */
    onPeak: (screen: V) => void;
    /** Sequence over: show results. */
    onDone: () => void;
}

/**
 * The PASSENGER_EJECTED sequence: passenger is launched through the roof,
 * flails into the sky with the camera following, the bottle spins away
 * spraying water, then a comedic pause before the results.
 *
 * Passenger motion after the roof breaks uses the simple ballistic model
 *   y = y0 + v0·t + ½·g·t²   (screen y down, so v0 < 0)
 * with v0 and g chosen so the peak lands exactly at `RISE_PX` after `fly` s.
 *
 * All objects it creates are destroyed with the scene, and the camera is
 * reset in Play.create(), so a restart is always clean.
 */
export class EjectionController {
    private t = 0;
    private readonly reduced = settings.reducedMotion;
    private readonly roof: RoofBreakEffect;
    /** The passenger while inside the cabin (auto-local, under the roof). */
    private readonly flyerIn: Phaser.GameObjects.Graphics;
    /** The passenger in open sky (world space, above everything). */
    private readonly flyerOut: Phaser.GameObjects.Graphics;
    private readonly bottle: Phaser.GameObjects.Graphics;
    private readonly scale: number;
    private readonly seatHand: V;
    private readonly bottleAngle0: number;
    private readonly fill0: number;
    /** Hip position (auto-local) when the roof breaks. */
    private breakHip!: V;
    /** World hip position when the flyer leaves the cabin layer, and the local y it had then. */
    private outAt?: { world: V; localY: number };
    private bottleState?: { x: number; y: number; vx: number; vy: number; rot: number; fill: number; sprayT: number };
    private peaked = false;
    private done = false;
    private vanishAt?: V;
    private readonly v0: number;
    private readonly g: number;

    constructor(
        private scene: Phaser.Scene,
        private world: WorldView,
        private sim: RideSimulation,
        private hooks: EjectionHooks,
    ) {
        const auto = world.auto;
        const pose = auto.seatedPose(sim);
        auto.ejected = true;
        this.scale = auto.container.scaleX;
        this.seatHand = { x: pose.hand.x - HIP.x, y: pose.hand.y - HIP.y };
        this.bottleAngle0 = pose.bottleAngle;
        this.fill0 = sim.bottle.fill;
        // ballistic constants in auto-local units (the container is scaled by `scale`)
        const rise = RISE_PX / this.scale;
        this.v0 = (-2 * rise) / EJECT_TIMING.fly;
        this.g = -this.v0 / EJECT_TIMING.fly;

        this.flyerIn = scene.add.graphics();
        auto.container.addAt(this.flyerIn, auto.container.getIndex(auto.roof));
        this.roof = new RoofBreakEffect(scene, auto);
        this.flyerOut = scene.add.graphics().setDepth(11).setVisible(false).setScale(this.scale);
        this.bottle = scene.add.graphics().setDepth(11).setScale(this.scale).setVisible(false);
        this.buildSky();

        sound.craterThud();
        sound.springBoing();
        vibrate([60, 40, 120]);
        this.shake(220, 0.012);
    }

    update(dt: number): void {
        if (this.done) return;
        this.t += dt;
        const t = this.t;
        const auto = this.world.auto;

        if (t < T1) {
            // ── inside the cabin: jerk up, head hits the roof, roof stretches ──
            let lift: number;
            if (t < T0) {
                lift = 14 * easeOut(t / T0);
            } else {
                const k = (t - T0) / (T1 - T0);
                lift = 14 + 34 * easeOut(k);
                this.roof.setStretch(36 * easeOut(k), Math.max(0, (k - 0.5) * 2));
            }
            if (t >= T0 && t - dt < T0) {
                sound.bump(1.2);
                this.shake(90, 0.004);
            }
            this.drawFlyer(this.flyerIn, Math.min(1, t / T1) * 0.35, lift);
            this.flyerIn.setPosition(HIP.x, HIP.y - lift).setRotation(0);
            this.breakHip = { x: HIP.x, y: HIP.y - lift };
        } else {
            if (!this.roof.broken) this.breakRoof();
            const tf = Math.min(t, T2) - T1;
            // closed-form ballistic in auto-local units
            const localY = this.breakHip.y + this.v0 * tf + 0.5 * this.g * tf * tf;
            const flail = Math.min(1, 0.35 + tf * 3);
            const tumble = Math.sin(tf * 5) * 0.28 * Math.min(1, tf * 3);
            if (!this.outAt && this.breakHip.y - localY < 110) {
                // still squeezing through the hole: stay in the cabin layer
                this.flyerIn.setPosition(this.breakHip.x, localY).setRotation(tumble);
                this.drawFlyer(this.flyerIn, flail, null);
            } else {
                if (!this.outAt) {
                    // fully clear of the roof: hand over to world space (no more pitch coupling)
                    this.outAt = { world: auto.toScreen({ x: this.breakHip.x, y: localY }), localY };
                    this.flyerIn.setVisible(false);
                    this.flyerOut.setVisible(true);
                }
                let wy = this.outAt.world.y + (localY - this.outAt.localY) * this.scale;
                // drift toward the middle of the screen while climbing, so the
                // flight isn't squeezed against the left edge (the auto sits at ~24%)
                const drift = easeOut(Math.min(1, tf / EJECT_TIMING.fly));
                let wx = this.outAt.world.x + (this.world.width * 0.4 - this.outAt.world.x) * drift;
                let s = this.scale;
                if (t >= T2 && t < T3) {
                    // comedic hang at the top
                    wy += Math.sin((t - T2) * 14) * 2;
                    if (!this.peaked) {
                        this.peaked = true;
                        sound.peakDing();
                        this.hooks.onPeak(this.toScreen({ x: wx, y: wy }));
                    }
                } else if (t >= T3) {
                    // whoosh up and away, shrinking
                    const k = Math.min(1, (t - T3) / EJECT_TIMING.vanish);
                    wy -= 520 * k * k;
                    wx += 40 * k;
                    s *= 1 - 0.85 * k;
                    if (t - dt < T3) sound.vanish();
                }
                this.flyerOut.setPosition(wx, wy).setRotation(tumble).setScale(s);
                this.drawFlyer(this.flyerOut, flail, null);
                if (t >= T4 && !this.vanishAt) {
                    this.vanishAt = { x: wx, y: wy };
                    this.flyerOut.setVisible(false);
                    this.twinkle(wx, wy - 20);
                }
                if (t < T3) this.followCamera(wy);
            }
        }

        this.roof.update(dt);
        this.updateBottle(dt);
        if (t >= T5 && !this.done) {
            this.done = true;
            this.hooks.onDone();
        }
    }

    private breakRoof(): void {
        const auto = this.world.auto;
        this.roof.break(this.reduced);
        sound.roofCrack();
        sound.scream();
        sound.slideWhistle(EJECT_TIMING.fly);
        vibrate(90);
        this.shake(200, 0.009);
        const top = auto.toScreen(this.roof.holeTop);
        // flash + comic "KRAK!"
        const flash = this.scene.add.circle(top.x, top.y, 20, 0xfff6d8, 1).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: flash, scale: 3.2, alpha: 0, duration: 180, ease: 'Cubic.out', onComplete: () => flash.destroy() });
        const krak = this.scene.add
            .text(top.x + 70, top.y - 30, 'KRAK!', { fontFamily: FONT, fontSize: '44px', color: '#ffd23f', fontStyle: '800', stroke: P.inkCss, strokeThickness: 8 })
            .setOrigin(0.5)
            .setDepth(45)
            .setAngle(-12)
            .setScale(0.3);
        this.scene.tweens.add({ targets: krak, scale: 1, duration: 180, ease: 'Back.out' });
        this.scene.tweens.add({ targets: krak, alpha: 0, y: krak.y - 40, delay: 500, duration: 400, onComplete: () => krak.destroy() });
        // the bottle leaves the hand and goes its own way
        const hand = auto.toScreen({ x: HIP.x + this.seatHand.x + 6, y: HIP.y + this.seatHand.y + 8 });
        this.bottleState = { x: hand.x, y: hand.y, vx: 170, vy: -980, rot: this.bottleAngle0, fill: this.fill0, sprayT: 0 };
        this.bottle.setVisible(true);
        this.world.say(['Hey?!', 'Wait… where did you go?!', 'My roof!'][Math.floor(Math.random() * 3)], 2400);
    }

    /** Spinning bottle on its own arc, spraying water as it goes. */
    private updateBottle(dt: number): void {
        const b = this.bottleState;
        if (!b) return;
        b.vy += 1300 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += 13 * dt;
        b.sprayT -= dt;
        if (b.fill > 0.02 && b.sprayT <= 0) {
            b.sprayT = 0.045;
            b.fill = Math.max(0, b.fill - 0.035);
            const tip = { x: b.x + Math.sin(b.rot) * 26 * this.scale, y: b.y - Math.cos(b.rot) * 26 * this.scale };
            this.world.fx.burst(tip.x, tip.y, this.reduced ? 2 : 4, { up: 160, spread: 220, dir: Math.sin(b.rot) * 2 });
            if (Math.random() < 0.35) sound.spray();
        }
        const g = this.bottle;
        g.clear();
        g.setPosition(b.x, b.y).setRotation(b.rot);
        const outline = [
            { x: -8, y: 22 },
            { x: -8, y: -12 },
            { x: -4, y: -19 },
            { x: -4, y: -26 },
            { x: 4, y: -26 },
            { x: 4, y: -19 },
            { x: 8, y: -12 },
            { x: 8, y: 22 },
        ];
        g.fillStyle(0xe6f6ff, 0.6);
        g.fillPoints(outline, true);
        const water = waterPolygon(b.rot, b.fill);
        if (water.length >= 3) {
            g.fillStyle(P.waterDeep, 0.85);
            g.fillPoints(water, true);
        }
        g.fillStyle(0x2f6fd8, 1);
        g.fillRect(-8, 1, 16, 9);
        g.lineStyle(2.5, P.ink, 1);
        g.strokePoints(outline, true);
        if (b.y > DESIGN_HEIGHT + 400) {
            this.bottleState = undefined;
            g.setVisible(false);
        }
    }

    /**
     * The cartoon passenger, drawn around the hip (local y down).
     * `flail` 0 = still seated with the bottle at the lips, 1 = full flail.
     * `holdLift` (px) = still gripping the bottle: the hand stays put in the
     * cabin while the body is pushed up by this much (null = let go).
     */
    private drawFlyer(g: Phaser.GameObjects.Graphics, flail: number, holdLift: number | null): void {
        const tt = this.t;
        const lerp = (a: number, b: number) => a + (b - a) * flail;
        const sh: V = { x: 8, y: -36 };
        const head: V = { x: lerp(14, 10), y: lerp(-60, -64) };
        g.clear();

        const limb = (a: V, b: V, c: V, w: number, color: number) => {
            g.lineStyle(w + 6, P.ink, 1);
            g.lineBetween(a.x, a.y, b.x, b.y);
            g.lineBetween(b.x, b.y, c.x, c.y);
            g.lineStyle(w, color, 1);
            g.lineBetween(a.x, a.y, b.x, b.y);
            g.lineBetween(b.x, b.y, c.x, c.y);
        };
        const leg = (phase: number, front: boolean) => {
            const w = Math.sin(tt * 22 + phase);
            const knee = { x: lerp(50, 18 + 16 * w), y: lerp(0, 30) };
            const foot = { x: lerp(55, knee.x - 6 + 14 * Math.sin(tt * 22 + phase + 1.2)), y: lerp(60, 62) };
            limb({ x: 0, y: 0 }, knee, foot, 12, front ? P.pants : 0x30333c);
            g.fillStyle(0x3a2a20, 1);
            g.fillEllipse(foot.x + 5, foot.y + 2, 18, 9);
        };
        const arm = (phase: number, front: boolean) => {
            const s = front ? 1 : -1;
            const w = Math.sin(tt * 19 + phase);
            const elbow = { x: sh.x + s * 20 + 6 * w, y: sh.y - 14 + 8 * w };
            const hand = { x: sh.x + s * 26 + 10 * Math.sin(tt * 19 + phase + 1), y: sh.y - 44 + 6 * Math.cos(tt * 19 + phase) };
            if (front && holdLift !== null) {
                // still gripping the bottle where it was, below the roof, as the body shoots up
                const h = { x: this.seatHand.x + 6, y: this.seatHand.y + holdLift + 8 };
                limb(sh, { x: (sh.x + h.x) / 2 + 6, y: (sh.y + h.y) / 2 + 12 }, h, 8, P.shirt);
                this.drawHeldBottle(g, h);
                return;
            }
            limb(sh, elbow, hand, 8, front ? P.shirt : P.shirtShade);
            g.fillStyle(P.skin, 1);
            g.fillCircle(hand.x, hand.y, 6);
            g.lineStyle(2.5, P.ink, 1);
            g.strokeCircle(hand.x, hand.y, 6);
        };

        arm(Math.PI, false);
        leg(Math.PI, false);
        // torso
        g.lineStyle(34, P.ink, 1);
        g.lineBetween(0, -6, sh.x, sh.y + 6);
        g.lineStyle(28, P.shirt, 1);
        g.lineBetween(0, -6, sh.x, sh.y + 6);
        // soaked patches
        g.fillStyle(0x1f3f8a, 0.55);
        g.fillCircle(6, -24, 5);
        g.fillCircle(2, -14, 4);
        leg(0, true);
        // neck + head
        g.fillStyle(P.skinShade, 1);
        g.fillRect(head.x - 5, sh.y - 12, 10, Math.max(6, head.y + 12 - (sh.y - 12)));
        this.drawShockedHead(g, head, flail);
        arm(0, true);
    }

    private drawHeldBottle(g: Phaser.GameObjects.Graphics, hand: V): void {
        const a = this.bottleAngle0;
        const T = (p: V) => ({ x: hand.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: hand.y + p.x * Math.sin(a) + p.y * Math.cos(a) });
        const pts = [
            { x: -8, y: 22 },
            { x: -8, y: -12 },
            { x: -4, y: -26 },
            { x: 4, y: -26 },
            { x: 8, y: -12 },
            { x: 8, y: 22 },
        ].map(T);
        g.fillStyle(0xe6f6ff, 0.6);
        g.fillPoints(pts, true);
        g.lineStyle(2.5, P.ink, 1);
        g.strokePoints(pts, true);
        g.fillStyle(P.skin, 1);
        g.fillCircle(hand.x, hand.y, 6.5);
    }

    /** Big round eyes, eyebrows up, mouth in a perfect "O", glasses knocked askew. */
    private drawShockedHead(g: Phaser.GameObjects.Graphics, c: V, flail: number): void {
        const { x, y } = c;
        g.fillStyle(P.skin, 1);
        g.fillCircle(x, y, 16);
        g.lineStyle(3, P.ink, 1);
        g.strokeCircle(x, y, 16);
        // hair blown straight up
        g.fillStyle(P.hair, 1);
        g.slice(x - 1, y - 2, 16.5, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(345), false);
        g.fillPath();
        if (flail > 0.4) for (let i = 0; i < 4; i++) g.fillTriangle(x - 12 + i * 7, y - 13, x - 6 + i * 7, y - 13, x - 10 + i * 7 + Math.sin(this.t * 30 + i) * 2, y - 26);
        g.fillStyle(P.skinShade, 1);
        g.fillCircle(x - 3, y + 2, 4);
        g.fillStyle(P.skin, 1);
        g.fillCircle(x + 15.5, y + 1, 3.5);
        const ex = x + 8.5;
        const ey = y - 3;
        g.fillStyle(0xffffff, 1);
        g.fillCircle(ex, ey, 6.5);
        g.lineStyle(2.2, P.ink, 1);
        g.strokeCircle(ex, ey, 6.5);
        g.fillStyle(P.ink, 1);
        g.fillCircle(ex + 0.5, ey - 1, 1.8);
        // glasses knocked up the forehead
        const gy = ey - 4 - 6 * flail;
        g.lineStyle(1.8, 0x34495e, 1);
        g.strokeCircle(ex + 1, gy, 7);
        g.lineBetween(ex + 8, gy - 1, x + 15, y - 6 - 6 * flail);
        // eyebrows way up
        g.lineStyle(2.5, P.hair, 1);
        g.lineBetween(ex - 5, ey - 13 - 3 * flail, ex + 5, ey - 15 - 3 * flail);
        // "O" mouth
        g.fillStyle(0x6b1f1f, 1);
        g.fillEllipse(x + 11, y + 9, 8, 10 + Math.sin(this.t * 25) * 1.5);
        // sweat drops flung off
        if (flail > 0.5) {
            g.fillStyle(P.water, 1);
            const k = (this.t * 2.5) % 1;
            g.fillCircle(x - 18 - k * 14, y - 10 + k * 10, 2.5);
            g.fillCircle(x + 20 + k * 12, y - 16 + k * 8, 2);
        }
    }

    /** Vertical camera follow (side-scroller → vertical tracking). */
    private followCamera(hipWorldY: number): void {
        const cam = this.scene.cameras.main;
        const target = Math.min(0, hipWorldY - FOLLOW_Y);
        cam.scrollY += (target - cam.scrollY) * 0.25;
    }

    private toScreen(p: V): V {
        const cam = this.scene.cameras.main;
        return { x: p.x - cam.scrollX, y: p.y - cam.scrollY };
    }

    private shake(ms: number, k: number): void {
        if (!this.reduced) this.scene.cameras.main.shake(ms, k);
    }

    /** Extend the sky upward so the camera has somewhere to go. */
    private buildSky(): void {
        const s = this.scene;
        const W = this.world.width;
        const wx = this.sim.mods.weather;
        const bottom = wx.night ? 0x111d3c : wx.id === 'rainy' ? 0x5c7d95 : 0x6ec1f5;
        const top = wx.night ? 0x03060f : wx.id === 'rainy' ? 0x3d5468 : 0x2f78d0;
        const H = 2600;
        const sky = s.add.graphics().setDepth(0);
        const bands = 26;
        const c0 = Phaser.Display.Color.IntegerToColor(bottom);
        const c1 = Phaser.Display.Color.IntegerToColor(top);
        for (let i = 0; i < bands; i++) {
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, bands - 1, i);
            sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
            sky.fillRect(0, -((i + 1) * H) / bands, W, H / bands + 1);
        }
        if (wx.night) {
            for (let i = 0; i < 120; i++) {
                sky.fillStyle(0xffffff, 0.4 + ((i * 37) % 60) / 100);
                sky.fillCircle((i * 211) % W, -((i * 131) % H), 1 + (i % 3) * 0.6);
            }
        }
        // clouds to rush past, so the climb feels fast
        for (let i = 0; i < 9; i++) {
            s.add
                .image(((i * 0.37) % 1) * W, -150 - i * 190 - (i % 3) * 40, 'cloud')
                .setDepth(1)
                .setScale((0.7 + (i % 4) * 0.25) / RS)
                .setAlpha(wx.night ? 0.25 : 0.9);
        }
    }

    private twinkle(x: number, y: number): void {
        const g = this.scene.add.graphics().setDepth(12).setPosition(x, y).setScale(0);
        g.fillStyle(0xfff3a0, 1);
        const star = (r: number) => {
            const pts: V[] = [];
            for (let i = 0; i < 8; i++) {
                const rr = i % 2 ? r * 0.35 : r;
                const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
                pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
            }
            g.fillPoints(pts, true);
        };
        star(22);
        g.lineStyle(2.5, 0xffffff, 1);
        g.strokeCircle(0, 0, 6);
        this.scene.tweens.add({ targets: g, scale: 1.3, angle: 90, duration: 160, yoyo: true, hold: 120, ease: 'Sine.out', onComplete: () => g.destroy() });
    }
}
