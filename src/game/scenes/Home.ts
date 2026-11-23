import Phaser from 'phaser';
import { designWidth, setupCamera } from '../render/resolution';
import { HAZARDS } from '../config/hazards';
import { TUNING } from '../config/tuning';
import { Road } from '../core/road';
import { RideSimulation } from '../core/simulation';
import { FONT, PALETTE as P } from '../render/palette';
import { drawSpeaker, label, makeButton, makeIconButton, title } from '../render/ui';
import { WorldView } from '../render/WorldView';
import { loadBest, saveSettings, settings } from '../systems/settings';
import { sound } from '../systems/sound';

export function goFullscreen(): void {
    // Android: fullscreen + landscape lock. iOS Safari ignores this gracefully.
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (!coarse) return;
    try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
            el.requestFullscreen({ navigationUI: 'hide' })
                .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
                .catch(() => undefined);
        }
    } catch {
        /* not supported */
    }
}

/** Title screen: the auto drives along while the passenger demonstrates sipping. */
export class Home extends Phaser.Scene {
    private sim!: RideSimulation;
    private world!: WorldView;
    private acc = 0;
    private nextBump = 0;

    constructor() {
        super('Home');
    }

    create(): void {
        setupCamera(this);
        const W = designWidth(this);
        this.acc = 0;
        this.sim = new RideSimulation(TUNING, new Road([], Infinity), { seed: 1, practice: true });
        this.world = new WorldView(this, this.sim, W);
        this.nextBump = 900;

        const cx = Math.round(W * 0.7);
        const logo = title(this, cx, 128, 'JUST ONE SIP', 92, '#ffffff');
        logo.setDepth(40);
        const drop = this.add.text(cx + logo.width / 2 + 8, 92, '💧', { fontSize: '58px' }).setOrigin(0.5).setDepth(40);
        this.tweens.add({ targets: drop, y: 102, angle: 12, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
        this.tweens.add({ targets: logo, scale: 1.03, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

        const card = this.add.graphics().setDepth(39);
        card.fillStyle(P.ink, 0.55);
        card.fillRoundedRect(cx - 300, 192, 600, 118, 24);
        label(this, cx, 251, 'Finish your 250 ml water bottle before the auto\nreaches your stop. Bangalore roads have other plans.', 24, '#ffffff', '600')
            .setDepth(40)
            .setLineSpacing(2);

        makeButton(this, cx, 386, 'START RIDE  🛺', () => this.start(false), { width: 340, height: 86, fontSize: 38, depth: 40 });
        makeButton(this, cx - 95, 486, 'How to play', () => this.start(true), {
            width: 210,
            height: 58,
            fontSize: 24,
            fill: P.cream,
            depth: 40,
        });

        const motionBtn = makeButton(
            this,
            cx + 125,
            486,
            settings.reducedMotion ? 'Motion: Low' : 'Motion: Full',
            () => {
                settings.reducedMotion = !settings.reducedMotion;
                saveSettings();
                (motionBtn.list[2] as Phaser.GameObjects.Text).setText(settings.reducedMotion ? 'Motion: Low' : 'Motion: Full');
            },
            { width: 200, height: 58, fontSize: 22, fill: P.cream, depth: 40 },
        );

        const snd = makeIconButton(
            this,
            W - 56,
            54,
            (g) => drawSpeaker(g, settings.muted),
            () => {
                settings.muted = !settings.muted;
                saveSettings();
                sound.applyMute();
            },
        );
        snd.setDepth(40);

        const best = loadBest();
        if (best.rides > 0) {
            this.add
                .text(cx, 552, `🏆 Best ${best.score.toLocaleString()} pts   ·   ${best.wins} bottle${best.wins === 1 ? '' : 's'} finished`, {
                    fontFamily: FONT,
                    fontSize: '22px',
                    color: '#ffffff',
                    fontStyle: '800',
                    stroke: P.inkCss,
                    strokeThickness: 5,
                })
                .setOrigin(0.5)
                .setDepth(40);
        }

        this.input.keyboard?.once('keydown-ENTER', () => this.start(false));
        // any first touch unlocks audio
        this.input.once('pointerdown', () => sound.unlock());
    }

    private start(tutorial: boolean): void {
        sound.unlock();
        sound.horn();
        goFullscreen();
        const tut = tutorial || !settings.tutorialSeen;
        this.cameras.main.fadeOut(220, 255, 216, 154);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
            tut ? this.scene.start('Play', { mode: 'tutorial' }) : this.scene.start('Setup'),
        );
    }

    update(_t: number, delta: number): void {
        const dt = Math.min(0.1, delta / 1000);
        const sim = this.sim;
        // keep a speed breaker coming every few seconds for the demo
        if (sim.frontX + 1600 > this.nextBump) {
            const d = HAZARDS.speedBreaker;
            sim.road.add({ type: 'speedBreaker', x: this.nextBump, width: 120, depth: 15, impact: 0.6, kicks: d.kicks, block: 0 });
            this.nextBump += 2600;
        }
        // demo AI: sip on smooth road, lower before bumps
        const next = sim.timeToNextHazard().sec;
        const holding = next > 0.9 && next < 4.6 && sim.time % 3 > 0.6;
        this.acc += dt;
        while (this.acc >= TUNING.fixedStep) {
            sim.step(TUNING.fixedStep, holding);
            this.acc -= TUNING.fixedStep;
        }
        for (const e of sim.drainEvents()) this.world.onEvent(e);
        this.world.update(dt);
        // drop stale hazards
        while (sim.road.hazards.length && sim.road.hazards[0].x + 1400 < sim.rearX) sim.road.hazards.shift();
    }
}
