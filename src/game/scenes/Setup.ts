import Phaser from 'phaser';
import { DRIVERS, DRIVER_IDS, type DriverId } from '../config/drivers';
import { WEATHER, WEATHER_IDS, type WeatherId } from '../config/weather';
import { FONT, PALETTE as P } from '../render/palette';
import { SAFE, designWidth, setupCamera } from '../render/resolution';
import { TEX_SCALE } from '../render/textures';
import { label, makeButton, title } from '../render/ui';
import { saveSettings, settings } from '../systems/settings';
import { sound } from '../systems/sound';

interface Choice {
    root: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    w: number;
    h: number;
}

function drawCard(c: Choice, selected: boolean): void {
    const { bg, w, h } = c;
    bg.clear();
    bg.fillStyle(P.ink, 0.35);
    bg.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 20);
    bg.fillStyle(selected ? P.yellow : P.cream, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    bg.lineStyle(selected ? 5 : 3, P.ink, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
    c.root.setScale(selected ? 1.04 : 1);
}

/** "Choose your ride": pick a driver personality and the weather. */
export class Setup extends Phaser.Scene {
    constructor() {
        super('Setup');
    }

    create(): void {
        setupCamera(this);
        const W = designWidth(this);
        const g = this.add.graphics();
        g.fillGradientStyle(0x7fc8f8, 0x7fc8f8, 0xffd89a, 0xffd89a, 1);
        g.fillRect(0, 0, W, 720);

        title(this, W / 2, 60, 'CHOOSE YOUR RIDE', 54);
        makeButton(this, 110 + SAFE.left, 60, '‹ Home', () => this.scene.start('Home'), { width: 160, height: 54, fontSize: 24, fill: P.cream });

        // ── drivers ──
        label(this, W / 2, 122, 'Your driver', 26, P.inkCss);
        const cw = Math.min(330, (W - 120) / 3);
        const drivers: Record<string, Choice> = {};
        DRIVER_IDS.forEach((id, i) => {
            const d = DRIVERS[id];
            const x = W / 2 + (i - 1) * (cw + 24);
            const y = 262;
            const c: Choice = { root: this.add.container(x, y), bg: this.add.graphics(), w: cw, h: 220 };
            const head = this.add.image(-cw / 2 + 52, -52, 'driverHead').setScale(TEX_SCALE * 1.9);
            const name = this.add.text(-cw / 2 + 96, -78, `${d.name} ${d.emoji}`, { fontFamily: FONT, fontSize: '28px', color: P.inkCss, fontStyle: '800' });
            const trait = this.add.text(-cw / 2 + 96, -44, d.trait.toUpperCase(), { fontFamily: FONT, fontSize: '18px', color: '#b85c00', fontStyle: '800' });
            const blurb = this.add.text(-cw / 2 + 18, 0, d.blurb, { fontFamily: FONT, fontSize: '18px', color: '#4a3a2c', fontStyle: '600', wordWrap: { width: cw - 36 } });
            const quote = this.add.text(-cw / 2 + 18, 58, `“${d.lines.start[0]}”`, {
                fontFamily: FONT,
                fontSize: '17px',
                color: '#6b5b4b',
                fontStyle: 'italic 600',
                wordWrap: { width: cw - 36 },
            });
            c.root.add([c.bg, head, name, trait, blurb, quote]);
            c.root.setSize(cw, 220).setInteractive({ useHandCursor: true });
            c.root.on('pointerup', () => this.pickDriver(id, drivers));
            drivers[id] = c;
        });

        // ── weather ──
        label(this, W / 2, 404, 'Weather', 26, P.inkCss);
        const ww = Math.min(300, (W - 120) / 3);
        const weathers: Record<string, Choice> = {};
        WEATHER_IDS.forEach((id, i) => {
            const w = WEATHER[id];
            const x = W / 2 + (i - 1) * (ww + 24);
            const y = 486;
            const c: Choice = { root: this.add.container(x, y), bg: this.add.graphics(), w: ww, h: 112 };
            const emoji = this.add.text(-ww / 2 + 46, 0, w.emoji, { fontSize: '46px' }).setOrigin(0.5);
            const name = this.add.text(-ww / 2 + 86, -34, w.label, { fontFamily: FONT, fontSize: '28px', color: P.inkCss, fontStyle: '800' });
            const blurb = this.add.text(-ww / 2 + 86, 2, w.blurb, { fontFamily: FONT, fontSize: '16px', color: '#4a3a2c', fontStyle: '600', wordWrap: { width: ww - 100 } });
            c.root.add([c.bg, emoji, name, blurb]);
            c.root.setSize(ww, 112).setInteractive({ useHandCursor: true });
            c.root.on('pointerup', () => this.pickWeather(id, weathers));
            weathers[id] = c;
        });

        this.pickDriver(settings.driver, drivers, true);
        this.pickWeather(settings.weather, weathers, true);

        makeButton(this, W / 2, 640, 'START RIDE  🛺', () => this.go(), { width: 360, height: 84, fontSize: 36 });
        this.input.keyboard?.once('keydown-ENTER', () => this.go());
    }

    private pickDriver(id: DriverId, all: Record<string, Choice>, quiet = false): void {
        settings.driver = id;
        saveSettings();
        for (const [k, c] of Object.entries(all)) drawCard(c, k === id);
        if (!quiet) sound.click();
    }

    private pickWeather(id: WeatherId, all: Record<string, Choice>, quiet = false): void {
        settings.weather = id;
        saveSettings();
        for (const [k, c] of Object.entries(all)) drawCard(c, k === id);
        if (!quiet) sound.click();
    }

    private go(): void {
        sound.unlock();
        sound.horn();
        this.scene.start('Play', { mode: 'ride' });
    }
}
