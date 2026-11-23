import Phaser from 'phaser';
import type { RideSimulation } from '../core/simulation';
import { FONT, PALETTE as P } from './palette';
import { TEX_SCALE } from './textures';

/**
 * In-ride HUD: water drunk (with the win line), spilled, route progress and
 * distance remaining. Text objects are only re-rendered when values change.
 */
export class Hud {
    private drunkText: Phaser.GameObjects.Text;
    private spillText: Phaser.GameObjects.Text;
    private distText: Phaser.GameObjects.Text;
    private bars: Phaser.GameObjects.Graphics;
    private routeAuto: Phaser.GameObjects.Image;
    private hint: Phaser.GameObjects.Container;
    private last = { drunk: -1, spill: -1, dist: -1 };
    private readonly routeX0: number;
    private readonly routeX1: number;
    readonly root: Phaser.GameObjects.Container;
    private hintVisible = true;

    constructor(
        private scene: Phaser.Scene,
        width: number,
        private sim: RideSimulation,
        showRoute = true,
    ) {
        const s = scene;
        this.root = s.add.container(0, 0).setDepth(50);

        // ── water card ──
        const card = s.add.graphics();
        card.fillStyle(P.ink, 0.35);
        card.fillRoundedRect(18, 18, 330, 104, 20);
        card.fillStyle(P.cream, 0.95);
        card.fillRoundedRect(16, 14, 330, 104, 20);
        card.lineStyle(3, P.ink, 1);
        card.strokeRoundedRect(16, 14, 330, 104, 20);
        const lbl = s.add.text(96, 22, 'DRUNK', { fontFamily: FONT, fontSize: '17px', color: '#6b5b4b', fontStyle: '800' });
        this.drunkText = s.add.text(96, 36, '', { fontFamily: FONT, fontSize: '32px', color: P.inkCss, fontStyle: '800' });
        this.spillText = s.add.text(96, 92, '', { fontFamily: FONT, fontSize: '17px', color: '#c0392b', fontStyle: '800' });
        this.bars = s.add.graphics();
        this.root.add([card, lbl, this.drunkText, this.spillText, this.bars]);

        // ── route ──
        this.routeX0 = width / 2 - 170;
        this.routeX1 = width / 2 + 170;
        this.distText = s.add
            .text(width / 2, 66, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: '800', stroke: P.inkCss, strokeThickness: 5 })
            .setOrigin(0.5, 0);
        const route = s.add.graphics();
        route.fillStyle(P.ink, 0.45);
        route.fillRoundedRect(this.routeX0 - 6, 34, this.routeX1 - this.routeX0 + 12, 16, 8);
        route.fillStyle(0xffffff, 0.9);
        route.fillRoundedRect(this.routeX0, 38, this.routeX1 - this.routeX0, 8, 4);
        // finish flag
        route.fillStyle(P.ink, 1);
        route.fillRect(this.routeX1 + 1, 12, 4, 40);
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 4; c++) {
                route.fillStyle((r + c) % 2 ? 0x111111 : 0xffffff, 1);
                route.fillRect(this.routeX1 + 5 + c * 6, 12 + r * 6, 6, 6);
            }
        route.lineStyle(2, P.ink, 1);
        route.strokeRect(this.routeX1 + 5, 12, 24, 18);
        this.routeAuto = s.add.image(this.routeX0, 30, 'autoIcon').setScale(0.13 * TEX_SCALE).setOrigin(0.5, 0.85);
        if (showRoute) {
            this.root.add([route, this.distText, this.routeAuto]);
            const d = sim.mods.driver;
            const wx = sim.mods.weather;
            const badge = s.add
                .text(width / 2, 100, `${d.emoji} ${d.name} (${d.trait}) · ${wx.emoji} ${wx.label}`, {
                    fontFamily: FONT,
                    fontSize: '18px',
                    color: '#ffffff',
                    fontStyle: '800',
                    stroke: P.inkCss,
                    strokeThickness: 4,
                })
                .setOrigin(0.5, 0);
            this.root.add(badge);
        }
        else {
            route.destroy();
            this.distText.destroy();
            this.routeAuto.destroy();
        }

        // ── hold hint ──
        const hintBg = s.add.graphics();
        const hintText = s.add
            .text(0, 0, 'HOLD anywhere to sip   ·   LET GO before bumps', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: '800' })
            .setOrigin(0.5);
        const hw = hintText.width + 90;
        hintBg.fillStyle(P.ink, 0.72);
        hintBg.fillRoundedRect(-hw / 2, -26, hw, 52, 26);
        const finger = s.add.text(-hw / 2 + 30, 0, '👆', { fontSize: '28px' }).setOrigin(0.5);
        this.hint = s.add.container(width / 2, 670, [hintBg, hintText, finger]).setDepth(50);
        s.tweens.add({ targets: finger, y: -6, yoyo: true, repeat: -1, duration: 450, ease: 'Sine.inOut' });

        this.update();
    }

    hideHint(): void {
        if (!this.hintVisible) return;
        this.hintVisible = false;
        this.scene.tweens.add({ targets: this.hint, alpha: 0, y: 700, duration: 400, onComplete: () => this.hint.setVisible(false) });
    }

    showHint(): void {
        this.hintVisible = true;
        this.hint.setVisible(true).setAlpha(1).setY(670);
    }

    update(): void {
        const sim = this.sim;
        const b = sim.bottle;
        const t = sim.t;
        const drunk = Math.floor(b.consumedMl);
        const spill = Math.round(b.spilledMl);
        const dist = Math.ceil(sim.remainingM);

        if (drunk !== this.last.drunk || spill !== this.last.spill) {
            this.drunkText.setText(`${drunk} / ${t.capacityMl} ml`);
            const lim = Math.round(t.spillLimitMl);
            this.spillText.setText(spill > 0 ? `💦 ${spill} / ${lim} ml spilled` : `Spill limit ${lim} ml`);
            this.spillText.setColor(spill > 0 ? '#c0392b' : '#3f8f5a');
        }
        // the mess meter pulses when you're close to the limit
        const danger = b.spilledMl / Math.max(1, t.spillLimitMl);
        this.spillText.setAlpha(danger > 0.7 ? 0.5 + 0.5 * Math.abs(Math.sin(sim.time * 8)) : 1);
        if (dist !== this.last.dist && this.distText.active) this.distText.setText(`${dist} m to go`);
        this.last = { drunk, spill, dist };

        // bottle gauge + drink bar (redrawn each frame — cheap)
        const g = this.bars;
        g.clear();
        const bx = 34;
        const by = 26;
        const bw = 44;
        const bh = 82;
        g.fillStyle(0xe6f6ff, 1);
        g.fillRoundedRect(bx, by + 12, bw, bh - 12, 8);
        g.fillRect(bx + 14, by, 16, 14);
        const fh = (bh - 16) * b.fill;
        g.fillStyle(P.waterDeep, 1);
        g.fillRoundedRect(bx + 4, by + bh - 4 - fh, bw - 8, fh, 5);
        g.lineStyle(3, P.ink, 1);
        g.strokeRoundedRect(bx, by + 12, bw, bh - 12, 8);
        g.strokeRect(bx + 14, by, 16, 12);

        const x0 = 96;
        const w = 232;
        const y = 76;
        g.fillStyle(0xd9cdb5, 1);
        g.fillRoundedRect(x0, y, w, 12, 6);
        const frac = Math.min(1, b.consumedMl / t.capacityMl);
        if (frac > 0) {
            g.fillStyle(P.water, 1);
            g.fillRoundedRect(x0, y, Math.max(12, w * frac), 12, 6);
        }


        if (this.routeAuto.active) {
            this.routeAuto.x = this.routeX0 + (this.routeX1 - this.routeX0) * sim.progress;
        }
    }
}
