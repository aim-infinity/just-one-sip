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

        // 1 · What happened — headline + verdict, centred on the card.
        // The end-shot polaroid is a corner sticker so it never pushes the column off-centre.
        const hasShot = this.textures.exists('endshot');
        if (hasShot) {
            const ph = this.add.container(cx - 392, 96).setAngle(-8).setScale(0.68);
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
        root.add(title(this, cx, 104, hasShot ? headline(r) : `${won ? '🎉' : '😩'}  ${headline(r)}`, 50, won ? '#ffd23f' : '#ffffff'));
        root.add(label(this, cx, 154, `“${verdict(r)}”`, 24, '#6b5b4b', 'italic 800').setWordWrapWidth(600));

        // 2 · How did I do — stars + score are one hero unit, with the gap to the best.
        const s = stars(r);
        const starText = this.add.text(cx, 202, '★★★'.slice(0, s) + '☆☆☆'.slice(0, 3 - s), {
            fontFamily: FONT,
            fontSize: '34px',
            color: '#f5a623',
            stroke: P.inkCss,
            strokeThickness: 5,
        });
        starText.setOrigin(0.5);
        root.add(starText);
        root.add(label(this, cx, 256, score.toLocaleString(), 72, P.inkCss));

        const gap = best.score - score;
        const bestLine = isNewBest
            ? '🏆 NEW PERSONAL BEST!'
            : gap <= 0
              ? `Matched your best · ${best.score.toLocaleString()}`
              : `Best ${best.score.toLocaleString()}  ·  ${gap.toLocaleString()} to beat`;
        const bestText = label(this, cx, 308, bestLine, isNewBest ? 24 : 20, isNewBest ? '#e67e22' : '#6b5b4b');
        root.add(bestText);
        if (isNewBest) this.tweens.add({ targets: bestText, scale: 1.12, yoyo: true, repeat: -1, duration: 500 });

        // 3 · Why — compact breakdown chips, value first, label under.
        const stats: [string, string, string][] = [
            ['drunk', `${Math.floor(r.consumedMl)} ml`, '#1f6fd0'],
            ['spilled', `${Math.round(r.spilledMl)} ml`, '#c0392b'],
            ['distance', `${Math.round(r.distanceM)} m`, P.inkCss],
        ];
        stats.forEach(([k, v, col], i) => {
            const x = cx + (i - 1) * 190;
            const g = this.add.graphics();
            g.fillStyle(0xffffff, 1);
            g.fillRoundedRect(x - 85, 340, 170, 76, 16);
            g.lineStyle(3, P.ink, 1);
            g.strokeRoundedRect(x - 85, 340, 170, 76, 16);
            root.add(g);
            root.add(label(this, x, 368, v, 32, col));
            root.add(label(this, x, 400, k, 16, '#6b5b4b'));
        });

        // 4 · Context — small, muted.
        const meta: string[] = [];
        if (data.driver && data.weather) {
            const d = DRIVERS[data.driver];
            const w = WEATHER[data.weather];
            meta.push(`${d.emoji} ${d.name}`, `${w.emoji} ${w.label}`);
        }
        if (!won && r.outcome !== 'ejected' && r.outcome !== 'spilledOut') meta.push(`${Math.round(r.remainingMl)} ml left in the bottle`);
        if (meta.length) root.add(label(this, cx, 446, meta.join('  ·  '), 18, '#6b5b4b'));

        // 5 · What next — one primary CTA; Share and Home are secondary and share its edges.
        const again = makeButton(this, cx, 516, 'TRY AGAIN', () => this.retry(), { width: 560, height: 84, fontSize: 40 });
        root.add(again);
        const share = makeButton(this, cx - 144, 614, 'Share 📤', () => this.share(r), {
            width: 272,
            height: 60,
            fontSize: 24,
            fill: 0xffffff,
            textColor: '#1a9e4b',
        });
        const home = makeButton(this, cx + 144, 614, 'Home', () => this.home(), { width: 272, height: 60, fontSize: 24, fill: P.cream });
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
