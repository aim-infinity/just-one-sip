import Phaser from 'phaser';
import { RS, SAFE, designWidth, setupCamera } from '../render/resolution';
import { DESIGN_HEIGHT } from '../render/palette';
import { HAZARDS } from '../config/hazards';
import { TOP_SPEED_MPS, TUNING, speedPx } from '../config/tuning';
import { DEFAULT_MODS, rideMods, type RideMods } from '../config/ride';
import { randomSeed } from '../core/rng';
import { generateRoute, Road, type Hazard } from '../core/road';
import { computeScore, type RideResult } from '../core/scoring';
import { RideSimulation, type SimEvent } from '../core/simulation';
import { EjectionController } from '../render/EjectionController';
import { Hud } from '../render/Hud';
import { FONT, PALETTE as P } from '../render/palette';
import { drawPauseIcon, drawSpeaker, label, makeButton, makeIconButton, panel, title } from '../render/ui';
import { WorldView } from '../render/WorldView';
import { HEAD } from '../render/AutoView';
import { vibrate } from '../systems/haptics';
import { HoldInput } from '../systems/input';
import { recordRide, saveSettings, settings, type Best } from '../systems/settings';
import { sound } from '../systems/sound';

export interface PlayData {
    mode?: 'ride' | 'tutorial';
    seed?: number;
}

type TutStep = 'hold' | 'release' | 'pothole' | 'oops' | 'done';

const MAX_STEPS_PER_FRAME = 15;

export function isPortraitMobile(): boolean {
    return window.innerHeight > window.innerWidth && matchMedia('(pointer: coarse)').matches;
}

/** ?massive forces a massive pothole onto the route (QA for the ejection event). */
function urlMassive(): boolean {
    return new URLSearchParams(location.search).has('massive');
}

/** Reads ?seed=123 from the URL for reproducible debugging runs. */
function urlSeed(): number | undefined {
    const s = new URLSearchParams(location.search).get('seed');
    return s && /^\d+$/.test(s) ? Number(s) >>> 0 : undefined;
}

export class Play extends Phaser.Scene {
    private sim!: RideSimulation;
    private world!: WorldView;
    private hud!: Hud;
    private hold!: HoldInput;
    private mode: 'ride' | 'tutorial' = 'ride';
    private seed = 0;
    private acc = 0;
    private paused = false;
    private ended = false;
    private pauseLayer?: Phaser.GameObjects.Container;
    private firstPress = false;

    // tutorial
    private tutStep: TutStep = 'hold';
    private tutText?: Phaser.GameObjects.Text;
    private tutPanel?: Phaser.GameObjects.Container;
    private tutTimer = 0;
    private tutHazard?: Hazard;
    private tutSpillAtStart = 0;
    private mods: RideMods = DEFAULT_MODS;
    private lastLineAt = -99;
    private saidFor = new Set<number>();
    /** Last 10 km/h step announced (Dino-style speed-up feedback). */
    private speedStep = 0;
    private ejection?: EjectionController;
    private topButtons: Phaser.GameObjects.Container[] = [];

    constructor() {
        super('Play');
    }

    init(data: PlayData): void {
        this.mode = data.mode ?? 'ride';
        this.seed = data.seed ?? urlSeed() ?? randomSeed();
        this.acc = 0;
        this.paused = false;
        this.ended = false;
        this.firstPress = false;
        this.pauseLayer = undefined;
        this.tutStep = 'hold';
        this.tutTimer = 0;
        this.tutHazard = undefined;
        this.ejection = undefined;
    }

    create(): void {
        setupCamera(this);
        // an ejection leaves the camera scrolled up / shaking: always start clean
        this.cameras.main.resetFX();
        const W = designWidth(this);
        const tutorial = this.mode === 'tutorial';
        this.mods = tutorial ? DEFAULT_MODS : rideMods(settings.driver, settings.weather);
        this.lastLineAt = -99;
        this.saidFor = new Set();
        this.speedStep = 0;
        const route = tutorial ? undefined : generateRoute(this.seed, TUNING, this.mods, { massive: urlMassive() ? 'always' : 'random' });
        const road = route ? new Road(route.hazards, route.lengthPx) : new Road([], Infinity);
        this.sim = new RideSimulation(TUNING, road, { seed: this.seed, practice: tutorial, mods: this.mods });
        this.world = new WorldView(this, this.sim, W);
        this.hud = new Hud(this, W, this.sim, !tutorial);
        this.hold = new HoldInput(this);
        this.hold.onPress = () => {
            sound.unlock();
            sound.startEngine();
            if (!this.firstPress) {
                sound.engineRev();
                this.world.exhaustBurst();
            }
            if (this.mods.weather.id === 'rainy') sound.startRain();
            if (!this.firstPress) {
                this.firstPress = true;
                if (!tutorial) {
                    this.hud.hideHint();
                    this.time.delayedCall(400, () => this.driverSays(this.mods.driver.lines.start, true));
                }
            }
        };

        // top-right controls
        const pauseBtn = makeIconButton(this, W - 56 - SAFE.right, 54, drawPauseIcon, () => this.setPaused(true));
        const sndBtn = makeIconButton(
            this,
            W - 136 - SAFE.right,
            54,
            (g) => drawSpeaker(g, settings.muted),
            () => {
                settings.muted = !settings.muted;
                saveSettings();
                sound.applyMute();
            },
        );
        pauseBtn.setDepth(60);
        sndBtn.setDepth(60);
        this.topButtons = [pauseBtn, sndBtn];

        if (tutorial) this.buildTutorial();
        if (sound.ready) sound.startEngine();
        this.world.weather.onThunder = () => sound.thunder();

        const onHide = () => {
            if (document.hidden) this.setPaused(true);
        };
        const onBlur = () => this.setPaused(true);
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('blur', onBlur);
        const onRestart = () => this.scene.restart({ mode: 'ride' } satisfies PlayData);
        window.addEventListener('jos:restart', onRestart);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('jos:restart', onRestart);
            sound.stopEngine();
            sound.stopRain();
        });

        this.input.keyboard?.on('keydown-ESC', () => this.setPaused(!this.paused));
        this.input.keyboard?.on('keydown-P', () => this.setPaused(!this.paused));
        (window as unknown as { __jos?: unknown }).__jos = { sim: this.sim, scene: this };
        this.cameras.main.fadeIn(250, 255, 216, 154);
    }

    // ─── Main loop ─────────────────────────────────────────────────────────
    update(_t: number, delta: number): void {
        if (isPortraitMobile() && !this.paused && !this.ended) this.setPaused(true);
        if (this.paused) return;
        const dt = Math.min(0.1, delta / 1000);
        const step = TUNING.fixedStep;
        this.acc += dt;
        let n = 0;
        // Don't start the ride until the player first touches (ride mode waits on the hint).
        const running = this.firstPress || this.mode === 'tutorial' || this.sim.time > 0;
        while (running && this.acc >= step && n++ < MAX_STEPS_PER_FRAME) {
            this.sim.step(step, this.hold.holding);
            this.acc -= step;
        }
        if (n >= MAX_STEPS_PER_FRAME) this.acc = 0;
        if (!running) this.acc = 0;

        for (const e of this.sim.drainEvents()) this.handleEvent(e);
        this.world.update(running ? dt : 0);
        this.ejection?.update(dt);
        this.hud.update();
        sound.engineLoad(Math.abs(this.sim.suspension.velocityAt(0.5)) / 300);
        sound.engineSpeed(this.sim.speed / (TOP_SPEED_MPS * this.sim.t.pxPerMeter));
        if (this.mode === 'ride') this.speedMilestones();
        if (this.mode === 'tutorial') this.updateTutorial(dt);
        else this.overconfidentBanter();
    }

    private handleEvent(e: SimEvent): void {
        this.world.onEvent(e);
        const reduced = settings.reducedMotion;
        switch (e.kind) {
            case 'brake': {
                sound.brake(e.severity);
                vibrate(30);
                if (!reduced) this.cameras.main.shake(160, 0.002 * e.severity);
                const lines = this.mods.driver.lines.braking;
                if (e.hazard.type === 'cow') {
                    sound.horn();
                    sound.moo();
                    this.driverSays(['Honk honk!'], true);
                    const cowX = e.hazard.x + e.hazard.width - this.world.camX + 30;
                    this.time.delayedCall(250, () => this.popText('MOO!', 0xffffff, { x: cowX, y: 520 }));
                } else if (e.hazard.type === 'cutIn') {
                    sound.horn();
                    this.driverSays(lines ?? ['Whoa!'], true);
                } else {
                    this.driverSays(this.mods.driver.id === 'impatient' && lines ? [lines[lines.length - 1]] : ['Red light!'], true);
                }
                break;
            }
            case 'skid':
                sound.brake(0.6);
                this.popText('Skiiid!', 0xbfe4ff, this.world.auto.toScreen({ x: 150, y: -10 }));
                break;
            case 'slowing':
                if (this.mods.driver.lines.slowing && Math.random() < 0.5) this.driverSays(this.mods.driver.lines.slowing);
                break;
            case 'go':
                if (e.hazard.type === 'signal') {
                    sound.engineRev();
                    this.world.exhaustBurst();
                    sound.horn();
                    this.driverSays(['Green light!'], true);
                }
                break;
            case 'kick':
                if (e.hazard.type === 'manhole' && e.severity > 0.3) sound.clank();
                if (e.severity > 0.12) sound.bump(e.severity);
                if (e.severity > 0.5) {
                    vibrate(Math.round(12 + e.severity * 25));
                    if (!reduced) this.cameras.main.shake(130, 0.0022 * e.severity);
                }
                break;
            case 'slosh':
                sound.splash(e.ml);
                vibrate([0, 35]);
                if (e.ml >= 1.5) this.popText(`-${Math.round(e.ml)} ml`, P.red, this.world.auto.toScreen(this.world.auto.tipLocal));
                break;
            case 'gulp':
                sound.gulp();
                break;
            case 'sipEnd':
                if (e.drunkMl >= 3) {
                    const m = this.world.auto.toScreen(this.world.auto.mouthLocal);
                    this.popText(`+${Math.round(e.drunkMl)} ml`, P.green, { x: m.x - 30, y: m.y - 40 });
                    if (e.spilledMl < 1) sound.sipSuccess();
                }
                break;
            case 'eject':
                this.onEject();
                break;
            case 'end':
                this.onEnd();
                break;
        }
    }

    private popText(text: string, color: number, at: { x: number; y: number }): void {
        const t = this.add
            .text(at.x, at.y, text, {
                fontFamily: FONT,
                fontSize: '30px',
                color: '#' + color.toString(16).padStart(6, '0'),
                fontStyle: '800',
                stroke: P.inkCss,
                strokeThickness: 6,
            })
            .setOrigin(0.5)
            .setDepth(45);
        this.tweens.add({ targets: t, y: at.y - 70, alpha: 0, duration: 1100, ease: 'Cubic.out', onComplete: () => t.destroy() });
    }

    /** Driver speech, rate-limited so it never spams. */
    private driverSays(lines: string[] | undefined, force = false): void {
        if (!lines?.length) return;
        const now = this.sim.time;
        if (!force && now - this.lastLineAt < 3) return;
        this.lastLineAt = now;
        this.world.say(lines[Math.floor(Math.random() * lines.length)]);
    }

    /** Every 10 km/h the cruising speed climbs, flash a little "Speeding up!" (like Dino's score flash). */
    private speedMilestones(): void {
        if (this.sim.state !== 'playing' || this.sim.time <= 0) return;
        const kmh = (this.sim.cruiseSpeed / this.sim.t.pxPerMeter) * 3.6;
        const step = Math.floor(kmh / 10);
        if (this.speedStep === 0) this.speedStep = step;
        if (step > this.speedStep) {
            this.speedStep = step;
            this.hud.flashSpeed(step * 10);
            vibrate(15);
        }
    }

    /** "Road’s perfect!" — said with total confidence right before a pothole. */
    private overconfidentBanter(): void {
        const lines = this.mods.driver.lines.beforePothole;
        if (!lines || this.sim.state !== 'playing') return;
        const { sec, hazard } = this.sim.timeToNextHazard();
        if (!hazard || this.saidFor.has(hazard.id)) return;
        const holes = ['pothole', 'massivePothole', 'waterlogged', 'manhole'];
        if (holes.includes(hazard.type) && sec < 1.3) {
            this.saidFor.add(hazard.id);
            if (this.sim.time - this.lastLineAt > 2.2) this.driverSays(lines, true);
        }
    }

    private onEnd(): void {
        if (this.sim.outcome === 'ejected') return; // handled by onEject()
        this.ended = true;
        this.hold.enabled = false;
        sound.stopEngine();
        sound.stopRain();
        const result = this.sim.result();
        const won = result.outcome === 'won';
        if (won) {
            sound.victory();
            vibrate([40, 60, 40, 60, 120]);
        } else {
            sound.failure();
            vibrate(200);
        }
        const score = computeScore(result);
        const { best, isNewBest } = recordRide(score, result.consumedMl, won);
        // A short on-screen moment before the results card: the passenger and driver react.
        if (result.outcome === 'ejected') return;
        this.world.auto.endPose = result.outcome;
        this.hud.hideHint();
        const auto = this.world.auto;
        const banner = { won: 'BOTTLE FINISHED!', spilledOut: 'TOO MANY SPLASHES!', arrivedThirsty: 'WE HAVE ARRIVED!' }[result.outcome];
        const t = title(this, designWidth(this) / 2 + 120, 196, banner, 60, won ? '#ffd23f' : '#ffffff').setDepth(55).setScale(0.3);
        this.tweens.add({ targets: t, scale: 1, duration: 420, ease: 'Back.out' });
        if (won) {
            this.world.say(['Nice, all done! 👍', 'Bottle finished!', 'Well done!'][Math.floor(Math.random() * 3)]);
            const colors = [0xffd23f, 0xff6b6b, 0x4fb3f5, 0x2fbf71, 0xffffff];
            for (let i = 0; i < 6; i++) {
                this.time.delayedCall(i * 160, () => {
                    const p = auto.toScreen({ x: HEAD.x - 4 + Math.random() * 80, y: HEAD.y - 40 });
                    this.world.fx.burst(p.x, p.y, 14, { up: 420, spread: 360, color: colors[i % colors.length] });
                });
            }
        } else if (result.outcome === 'spilledOut') {
            this.world.say('Oh no… next time!');
        } else {
            this.world.say("We're here!");
            const p = auto.toScreen({ x: HEAD.x - 34, y: HEAD.y - 55 });
            this.time.delayedCall(500, () => this.popText('So thirsty…', 0xffffff, p));
        }
        this.time.delayedCall(1900, () => {
            const launch = () => this.launchResults(result, score, best, isNewBest);
            // snapshot the moment for the results card (without the banner / bubble)
            t.setVisible(false);
            this.world.hideBubble();
            try {
                const x0 = Math.max(0, auto.container.x - 280) * RS;
                const y0 = 200 * RS;
                this.game.renderer.snapshotArea(x0, y0, 560 * RS, 400 * RS, (img) => {
                    if (this.textures.exists('endshot')) this.textures.remove('endshot');
                    this.textures.addImage('endshot', img as HTMLImageElement);
                    launch();
                });
            } catch {
                launch();
            }
        });
    }

    private launchResults(result: RideResult, score: number, best: Best, isNewBest: boolean): void {
        this.scene.launch('Results', { result, score, best, isNewBest, driver: this.mods.driver.id, weather: this.mods.weather.id });
        this.scene.pause();
    }

    /** Massive pothole hit mid-sip: PASSENGER_EJECTED. Run the launch sequence, then results. */
    private onEject(): void {
        if (this.ejection) return;
        this.ended = true;
        this.hold.release();
        this.hold.enabled = false;
        sound.stopEngine();
        sound.stopRain();
        this.hud.hideHint();
        this.hud.root.setVisible(false);
        for (const b of this.topButtons) b.setVisible(false);
        const result = this.sim.result();
        const score = computeScore(result);
        const { best, isNewBest } = recordRide(score, result.consumedMl, false);
        if (this.textures.exists('endshot')) this.textures.remove('endshot');
        this.ejection = new EjectionController(this, this.world, this.sim, {
            onPeak: (p) => {
                // the results card's photo: the passenger at the top of the flight
                try {
                    const w = 560;
                    const h = 400;
                    const x0 = Phaser.Math.Clamp(p.x - w / 2, 0, Math.max(0, designWidth(this) - w));
                    const y0 = Phaser.Math.Clamp(p.y - h / 2 + 40, 0, DESIGN_HEIGHT - h);
                    this.game.renderer.snapshotArea(x0 * RS, y0 * RS, w * RS, h * RS, (img) => {
                        if (this.textures.exists('endshot')) this.textures.remove('endshot');
                        this.textures.addImage('endshot', img as HTMLImageElement);
                    });
                } catch {
                    /* no photo this time */
                }
                this.time.delayedCall(60, () => {
                    const msg = title(this, designWidth(this) / 2, 150, 'Bro unlocked flight mode.', 58, '#ffd23f')
                        .setScrollFactor(0)
                        .setDepth(55)
                        .setScale(0.3)
                        .setAngle(-3);
                    this.tweens.add({ targets: msg, scale: 1, duration: 380, ease: 'Back.out' });
                });
            },
            onDone: () => {
                sound.failure();
                this.launchResults(result, score, best, isNewBest);
            },
        });
    }

    // ─── Pause ─────────────────────────────────────────────────────────────
    setPaused(p: boolean): void {
        if (p === this.paused || this.ended) return;
        this.paused = p;
        this.hold.release();
        this.hold.enabled = !p;
        if (p) {
            sound.stopEngine();
            sound.stopRain();
            this.showPauseMenu();
        } else {
            this.pauseLayer?.destroy();
            this.pauseLayer = undefined;
            if (this.firstPress || this.mode === 'tutorial') sound.startEngine();
        }
    }

    private showPauseMenu(): void {
        const W = designWidth(this);
        const H = DESIGN_HEIGHT;
        const dim = this.add.rectangle(0, 0, W, H, P.ink, 0.55).setOrigin(0).setInteractive();
        const box = panel(this, W / 2, H / 2, 560, 470);
        const head = title(this, W / 2, H / 2 - 170, 'PAUSED', 56);
        const resume = makeButton(this, W / 2, H / 2 - 70, 'RESUME', () => this.setPaused(false), { width: 320 });
        const restart = makeButton(this, W / 2, H / 2 + 22, 'Restart ride', () => this.scene.restart({ mode: 'ride' }), {
            width: 320,
            height: 64,
            fontSize: 26,
            fill: P.cream,
        });
        const home = makeButton(this, W / 2 - 84, H / 2 + 112, 'Home', () => this.scene.start('Home'), {
            width: 152,
            height: 60,
            fontSize: 24,
            fill: P.cream,
        });
        const motion = makeButton(
            this,
            W / 2 + 84,
            H / 2 + 112,
            settings.reducedMotion ? 'Motion: Low' : 'Motion: Full',
            () => {
                settings.reducedMotion = !settings.reducedMotion;
                saveSettings();
                (motion.list[2] as Phaser.GameObjects.Text).setText(settings.reducedMotion ? 'Motion: Low' : 'Motion: Full');
            },
            { width: 152, height: 60, fontSize: 20, fill: P.cream },
        );
        const tip = label(this, W / 2, H / 2 + 190, 'Tip: sip on smooth road, lower before bumps.', 20, '#6b5b4b', '600');
        this.pauseLayer = this.add.container(0, 0, [dim, box, head, resume, restart, home, motion, tip]).setDepth(100);
        this.input.keyboard?.once('keydown-SPACE', () => this.setPaused(false));
    }

    // ─── Tutorial ──────────────────────────────────────────────────────────
    private buildTutorial(): void {
        const W = designWidth(this);
        const bg = this.add.graphics();
        const text = this.add
            .text(0, 0, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', fontStyle: '800', align: 'center', wordWrap: { width: 640 } })
            .setOrigin(0.5);
        this.tutText = text;
        this.tutPanel = this.add.container(W / 2 + 60, 190, [bg, text]).setDepth(55);
        this.tutPanel.setData('bg', bg);
        const skip = makeButton(this, W - 250 - SAFE.right, 54, 'Skip  ›', () => this.finishTutorial(), {
            width: 150,
            height: 54,
            fontSize: 24,
            fill: P.cream,
        });
        skip.setDepth(60);
        this.setTut('hold');
    }

    private setTut(step: TutStep): void {
        this.tutStep = step;
        this.tutTimer = 0;
        const msgs: Record<TutStep, string> = {
            hold: '👆 Press and HOLD anywhere\nto raise the bottle and drink',
            release: '✋ Nice! Now LET GO\nto lower the bottle',
            pothole: '⚠️ Pothole ahead!\nKeep the bottle DOWN until both wheels pass',
            oops: '💦 Splash! Lower the bottle BEFORE the bump.\nAnother one is coming…',
            done: '🎉 You got it!\nSip on smooth road. Lower before bumps.\nFinish the bottle before your stop.',
        };
        this.tutText!.setText(msgs[step]);
        const bg = this.tutPanel!.getData('bg') as Phaser.GameObjects.Graphics;
        const w = this.tutText!.width + 60;
        const h = this.tutText!.height + 36;
        bg.clear();
        bg.fillStyle(P.ink, 0.8);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
        bg.lineStyle(3, step === 'oops' ? P.red : P.yellow, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
        this.tutPanel!.setScale(0.9);
        this.tweens.add({ targets: this.tutPanel, scale: 1, duration: 260, ease: 'Back.out' });
        if (step === 'pothole' || step === 'oops') this.spawnTutorialPothole();
        if (step === 'done') {
            this.hud.hideHint();
            const W = designWidth(this);
            const btn = makeButton(this, W / 2 + 60, 330, 'START RIDE', () => this.finishTutorial(), {
                emoji: '🛺',
                width: 330,
                height: 82,
                fontSize: 34,
            });
            btn.setDepth(60).setScale(0);
            this.tweens.add({ targets: btn, scale: 1, duration: 320, delay: 300, ease: 'Back.out' });
        }
    }

    private spawnTutorialPothole(): void {
        const d = HAZARDS.pothole;
        const ahead = (designWidth(this) - this.world.autoX) + 80;
        this.tutHazard = this.sim.road.add({ type: 'pothole', x: this.sim.frontX + ahead, width: 95, depth: 15, impact: 1, kicks: d.kicks, block: 0 });
        this.tutSpillAtStart = this.sim.bottle.spilledMl;
    }

    private updateTutorial(dt: number): void {
        const sim = this.sim;
        this.tutTimer += dt;
        switch (this.tutStep) {
            case 'hold':
                if (sim.arm.atLips && sim.alignment > 0.5) {
                    if (this.tutTimer > 0 && sim.bottle.consumedMl > 12) this.setTut('release');
                }
                break;
            case 'release':
                if (sim.arm.state === 'lowered' && this.tutTimer > 0.3) this.setTut('pothole');
                break;
            case 'pothole':
            case 'oops': {
                const h = this.tutHazard;
                if (h && sim.rearX > h.x + h.width + speedPx(sim.t) * 0.5) {
                    const spilled = sim.bottle.spilledMl - this.tutSpillAtStart;
                    this.setTut(spilled > 1 ? 'oops' : 'done');
                }
                break;
            }
        }
    }

    private finishTutorial(): void {
        settings.tutorialSeen = true;
        saveSettings();
        this.scene.start('Setup');
    }
}
