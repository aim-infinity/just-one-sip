import Phaser from 'phaser';
import { designWidth, setupCamera } from '../render/resolution';
import { DESIGN_HEIGHT } from '../render/palette';
import { headline, verdict, stars, type RideResult } from '../core/scoring';
import { FONT, PALETTE as P } from '../render/palette';
import { label, makeButton, panel, title } from '../render/ui';
import { DRIVERS, type DriverId } from '../config/drivers';
import { WEATHER, type WeatherId } from '../config/weather';
import type { Best } from '../systems/settings';
import { shareResult } from '../systems/share';

export interface ResultsData {
    driver?: DriverId;
    weather?: WeatherId;
    result: RideResult;
    score: number;
    best: Best;
    isNewBest: boolean;
}

/** Overlay shown on top of the paused Play scene. */
export class Results extends Phaser.Scene {
    constructor() {
        super('Results');
    }

    create(data: ResultsData): void {
        setupCamera(this);
        const { result: r, score, best, isNewBest } = data;
        const W = designWidth(this);
        const H = DESIGN_HEIGHT;
        const cx = W / 2;
        const won = r.outcome === 'won';

        this.add.rectangle(0, 0, W, H, P.ink, 0.6).setOrigin(0).setInteractive();
        const root = this.add.container(0, 0);
        root.add(panel(this, cx, H / 2 + 14, 860, 640, won ? 0xfff3c4 : P.cream));

        // a "photo" of how the ride ended, pinned to the corner of the card
        const hasShot = this.textures.exists('endshot');
        if (hasShot) {
            const ph = this.add.container(cx - 340, 132).setAngle(-6);
            const frame = this.add.graphics();
            frame.fillStyle(P.ink, 0.3);
            frame.fillRect(-104, -74, 216, 166);
            frame.fillStyle(0xffffff, 1);
            frame.fillRect(-110, -80, 216, 166);
            frame.lineStyle(3, P.ink, 1);
            frame.strokeRect(-110, -80, 216, 166);
            const img = this.add.image(-2, -10, 'endshot');
            img.setScale(196 / img.width);
            const tape = this.add.rectangle(-2, -84, 70, 18, 0xffe9a8, 0.9).setAngle(4);
            ph.add([frame, img, tape]);
            root.add(ph);
        }
        const head = title(this, hasShot ? cx + 70 : cx, 104, hasShot ? headline(r) : `${won ? '🎉' : '😩'}  ${headline(r)}`, 54, won ? '#ffd23f' : '#ffffff');
        root.add(head);

        const s = stars(r);
        const starText = this.add.text(cx, 160, '★★★'.slice(0, s) + '☆☆☆'.slice(0, 3 - s), {
            fontFamily: FONT,
            fontSize: '40px',
            color: '#f5a623',
            stroke: P.inkCss,
            strokeThickness: 5,
        });
        starText.setOrigin(0.5);
        root.add(starText);

        if (data.driver && data.weather) {
            const d = DRIVERS[data.driver];
            const w = WEATHER[data.weather];
            starText.x = cx - 170;
            root.add(label(this, cx + 110, 160, `${d.emoji} ${d.name} · ${w.emoji} ${w.label}`, 22, '#6b5b4b'));
        }
        root.add(label(this, hasShot ? cx + 70 : cx, 210, `“${verdict(r)}”`, 28, P.inkCss, 'italic 800').setWordWrapWidth(hasShot ? 620 : 780));

        // stat cards
        const stats: [string, string, string][] = [
            ['DRUNK', `${Math.floor(r.consumedMl)} ml`, '#1f6fd0'],
            ['SPILLED', `${Math.round(r.spilledMl)} ml`, '#c0392b'],
            ['DISTANCE', `${Math.round(r.distanceM)} m`, P.inkCss],
        ];
        stats.forEach(([k, v, col], i) => {
            const x = cx + (i - 1) * 250;
            const g = this.add.graphics();
            g.fillStyle(0xffffff, 1);
            g.fillRoundedRect(x - 110, 246, 220, 108, 18);
            g.lineStyle(3, P.ink, 1);
            g.strokeRoundedRect(x - 110, 246, 220, 108, 18);
            root.add(g);
            root.add(label(this, x, 274, k, 20, '#6b5b4b'));
            root.add(label(this, x, 318, v, 42, col));
        });

        const need = won ? '' : r.outcome === 'spilledOut' ? '   ·   Every drop went on the floor' : `   ·   ${Math.round(r.remainingMl)} ml still in the bottle`;
        root.add(label(this, cx, 386, `Score ${score.toLocaleString()}${need}`, 28));
        const bestLine = isNewBest ? '🏆 NEW PERSONAL BEST!' : `Personal best: ${best.score.toLocaleString()}`;
        const bestText = label(this, cx, 422, bestLine, 24, isNewBest ? '#e67e22' : '#6b5b4b');
        root.add(bestText);
        if (isNewBest) this.tweens.add({ targets: bestText, scale: 1.12, yoyo: true, repeat: -1, duration: 500 });

        const again = makeButton(this, cx, 508, 'TRY AGAIN', () => this.retry(), { width: 360, height: 90, fontSize: 40 });
        root.add(again);
        const share = makeButton(this, cx - 190, 614, 'Share 📤', () => this.share(r), {
            width: 230,
            height: 64,
            fontSize: 26,
            fill: 0x25d366,
            textColor: '#ffffff',
        });
        const home = makeButton(this, cx + 190, 614, 'Home', () => this.home(), { width: 230, height: 64, fontSize: 26, fill: P.cream });
        root.add([share, home]);

        root.setScale(0.9).setAlpha(0);
        root.setPosition(cx * 0.1, H * 0.05);
        this.tweens.add({ targets: root, scale: 1, x: 0, y: 0, alpha: 1, duration: 320, ease: 'Back.out' });

        this.time.delayedCall(600, () => {
            this.input.keyboard?.once('keydown-ENTER', () => this.retry());
            this.input.keyboard?.once('keydown-SPACE', () => this.retry());
        });
    }

    private retry(): void {
        this.scene.stop('Play');
        this.scene.start('Play', { mode: 'ride' });
    }

    private home(): void {
        this.scene.stop('Play');
        this.scene.start('Home');
    }

    private async share(r: RideResult): Promise<void> {
        const img = this.textures.get('autoIcon').getSourceImage() as HTMLCanvasElement;
        const out = await shareResult(r, img);
        const msg =
            out === 'shared'
                ? 'Shared! 🙌'
                : out === 'downloaded'
                  ? 'Result card saved + text copied 📋'
                  : out === 'copied'
                    ? 'Copied to clipboard 📋'
                    : out === 'cancelled'
                      ? ''
                      : 'Sharing not available here';
        if (!msg) return;
        const t = label(this, designWidth(this) / 2, DESIGN_HEIGHT - 30, msg, 24, '#ffffff').setDepth(10);
        t.setStroke(P.inkCss, 6);
        this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
    }
}
