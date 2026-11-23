import Phaser from 'phaser';
import type { RideSimulation, SimEvent } from '../core/simulation';
import { settings } from '../systems/settings';
import { AutoView, type Mood } from './AutoView';
import { ParallaxView } from './ParallaxView';
import { RoadView } from './RoadView';
import { SplashFx } from './SplashFx';
import { GROUND_Y, PALETTE as P } from './palette';

/**
 * Decides the passenger's facial expression from recent events.
 * Pure-ish bookkeeping; no drawing.
 */
export class MoodTracker {
    private sinceSpill = 99;
    private lastSpillMl = 0;
    private sinceCleanSip = 99;
    private blinkT = 2;

    onEvent(e: SimEvent): void {
        if (e.kind === 'slosh' || e.kind === 'miss') {
            this.sinceSpill = 0;
            this.lastSpillMl = e.kind === 'slosh' ? Math.max(this.lastSpillMl, e.ml) : this.lastSpillMl + e.ml;
        }
        if (e.kind === 'sipEnd' && e.drunkMl > 4 && e.spilledMl < 1) this.sinceCleanSip = 0;
    }

    update(dt: number, sim: RideSimulation): { mood: Mood; blink: boolean } {
        this.sinceSpill += dt;
        this.sinceCleanSip += dt;
        if (this.sinceSpill > 1.5) this.lastSpillMl = 0;
        this.blinkT -= dt;
        if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 2.5;
        const blink = this.blinkT < 0;

        let mood: Mood = 'calm';
        const next = sim.timeToNextHazard();
        const raised = sim.arm.progress > 0.3;
        if (sim.sinceJolt < 0.35 && sim.lastJoltSeverity > 0.35) mood = 'shock';
        else if (this.sinceSpill < 1.1 && this.lastSpillMl > 3) mood = 'soaked';
        else if (raised && next.sec < 1.2 && (next.hazard?.impact ?? 0) > 0.45) mood = 'nervous';
        else if (sim.arm.atLips && !sim.bottle.isEmpty && sim.alignment > 0.5) mood = 'drinking';
        else if (!raised && next.sec < 0.9 && (next.hazard?.impact ?? 0) > 0.8) mood = 'nervous';
        else if (this.sinceCleanSip < 1.3) mood = 'happy';
        return { mood, blink };
    }
}

/** Everything in the world: parallax, road, hazards, auto, splashes. */
export class WorldView {
    readonly parallax: ParallaxView;
    readonly road: RoadView;
    readonly auto: AutoView;
    readonly fx: SplashFx;
    readonly mood = new MoodTracker();
    readonly autoX: number;
    private lastCamX = 0;

    constructor(
        scene: Phaser.Scene,
        private sim: RideSimulation,
        readonly width: number,
    ) {
        this.autoX = Math.round(width * sim.t.autoAnchorFraction);
        this.parallax = new ParallaxView(scene, width);
        this.road = new RoadView(scene, sim.road, width);
        this.auto = new AutoView(scene);
        this.fx = new SplashFx(scene, settings.reducedMotion);
        this.fx.floorY = GROUND_Y + 20;
        if (Number.isFinite(sim.lengthPx)) this.road.setFinish(sim.lengthPx + sim.t.wheelbasePx + 30);
        this.lastCamX = this.camX;
    }

    get camX(): number {
        return this.sim.rearX - (this.autoX - this.sim.t.wheelbasePx / 2);
    }

    /** React visually to a simulation event. */
    onEvent(e: SimEvent): void {
        this.mood.onEvent(e);
        const a = this.auto;
        if (e.kind === 'slosh') {
            const tip = a.toScreen(a.tipLocal);
            const forward = this.sim.brake.active ? 1.6 : 0;
            this.fx.burst(tip.x, tip.y, Math.min(30, 6 + Math.round(e.ml * 1.6)), { up: 200 + e.severity * 160, spread: 260, dir: forward });
        } else if (e.kind === 'miss') {
            if (Math.random() < Math.min(1, e.ml * 6)) {
                const m = a.toScreen(a.mouthLocal);
                this.fx.burst(m.x - 2, m.y + 4, 1, { up: 40, spread: 70, dir: -0.4 });
            }
        } else if (e.kind === 'contact' && e.hazard.type === 'waterlogged') {
            const x = (e.wheel === 'rear' ? this.sim.rearX : this.sim.frontX) - this.camX;
            this.fx.burst(x, GROUND_Y - 2, settings.reducedMotion ? 6 : 16, { up: 420, spread: 300, color: P.mud });
        }
    }

    update(dt: number): void {
        const camX = this.camX;
        const scroll = camX - this.lastCamX;
        this.lastCamX = camX;
        this.parallax.update(camX, dt, this.width);
        this.road.update(camX, this.sim, this.sim.time);
        const { mood, blink } = this.mood.update(dt, this.sim);
        this.auto.update(this.sim, camX, {
            x: this.autoX,
            mood,
            blink,
            motionScale: settings.reducedMotion ? 0.45 : 1,
        }, dt);
        this.fx.update(dt, Math.min(scroll, this.sim.cruiseSpeed * 0.05));
    }
}
