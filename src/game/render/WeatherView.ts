import Phaser from 'phaser';
import type { WeatherProfile } from '../config/weather';
import { GROUND_Y } from './palette';
import { TEX_SCALE } from './textures';
import type { Light } from './hazardArt';

/** Street-lamp x positions inside the 2040-px 'props' tile (see textures.ts). */
const LAMP_XS = [120, 900, 1650];
const PROPS_TILE = 2040;
const PROPS_FACTOR = 0.85;
const DARK_TOP = 220;

interface Drop {
    x: number;
    y: number;
    len: number;
    v: number;
}

/**
 * Weather overlays:
 *  - rainy: rain streaks, wet-road reflections, occasional lightning
 *  - night: a darkness layer with light "punched out" by the headlight,
 *    street lamps, the cabin light and reflective hazards
 * Sunny draws nothing.
 */
export class WeatherView {
    private rain?: Phaser.GameObjects.Graphics;
    private wet?: Phaser.GameObjects.Graphics;
    private flash?: Phaser.GameObjects.Rectangle;
    private drops: Drop[] = [];
    private nextFlash = 8;
    private dark?: Phaser.GameObjects.RenderTexture;
    private glowStamp?: Phaser.GameObjects.Image;
    private beamStamp?: Phaser.GameObjects.Image;
    private lampGlows: Phaser.GameObjects.Image[] = [];
    private beamGlow?: Phaser.GameObjects.Image;
    onThunder?: () => void;

    constructor(
        private scene: Phaser.Scene,
        private width: number,
        readonly weather: WeatherProfile,
        reduced: boolean,
    ) {
        if (weather.id === 'rainy') {
            this.wet = scene.add.graphics().setDepth(5.5);
            this.rain = scene.add.graphics().setDepth(30);
            const n = reduced ? 50 : 120;
            for (let i = 0; i < n; i++) {
                this.drops.push({ x: Math.random() * (width + 200), y: Math.random() * 720, len: 14 + Math.random() * 16, v: 900 + Math.random() * 500 });
            }
            this.flash = scene.add.rectangle(0, 0, width, 720, 0xffffff, 0).setOrigin(0).setDepth(31);
            this.nextFlash = 6 + Math.random() * 8;
        }
        if (weather.night) {
            this.dark = scene.add.renderTexture(0, DARK_TOP, width, 720 - DARK_TOP).setOrigin(0).setDepth(20);
            this.glowStamp = scene.make.image({ key: 'glow', add: false }).setOrigin(0.5);
            this.beamStamp = scene.make.image({ key: 'beam', add: false }).setOrigin(0, 0.5);
            for (let i = 0; i < 4; i++) {
                this.lampGlows.push(scene.add.image(0, 0, 'glow').setDepth(21).setTint(0xffd27a).setAlpha(0.55).setScale(TEX_SCALE * 0.45).setBlendMode(Phaser.BlendModes.ADD));
            }
            this.beamGlow = scene.add.image(0, 0, 'beam').setOrigin(0, 0.5).setDepth(21).setTint(0xfff1b0).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD);
        }
    }

    /** Screen x positions of street lamps currently on screen. */
    private lampXs(camX: number): number[] {
        const off = (((camX * PROPS_FACTOR) % PROPS_TILE) + PROPS_TILE) % PROPS_TILE;
        const xs: number[] = [];
        for (let k = 0; k < 2; k++) for (const lx of LAMP_XS) {
            const x = lx + 34 - off + k * PROPS_TILE;
            if (x > -150 && x < this.width + 150) xs.push(x);
        }
        return xs;
    }

    update(dt: number, camX: number, headlamp: { x: number; y: number; rot: number }, cabin: { x: number; y: number }, lights: Light[]): void {
        if (this.rain) this.updateRain(dt, camX);
        if (this.dark) this.updateNight(camX, headlamp, cabin, lights);
    }

    private updateRain(dt: number, camX: number): void {
        const g = this.rain!;
        g.clear();
        g.lineStyle(2, 0xcfe3f5, 0.55);
        for (const d of this.drops) {
            d.y += d.v * dt;
            d.x -= d.v * 0.25 * dt;
            if (d.y > 720) {
                d.y = -20;
                d.x = Math.random() * (this.width + 200);
            }
            g.lineBetween(d.x, d.y, d.x + d.len * 0.25, d.y - d.len);
        }
        // wet road: soft reflections that scroll with the road
        const w = this.wet!;
        w.clear();
        w.fillStyle(0x9fb8cc, 0.14);
        w.fillRect(0, 530, this.width, 86);
        w.lineStyle(3, 0xdbe9f5, 0.25);
        const off = camX % 180;
        for (let x = -off; x < this.width; x += 180) {
            w.lineBetween(x, 590, x + 70, 590);
            w.lineBetween(x + 90, 548, x + 130, 548);
        }
        this.nextFlash -= dt;
        if (this.nextFlash <= 0 && this.flash) {
            this.nextFlash = 9 + Math.random() * 10;
            this.flash.setFillStyle(0xffffff, 0.55);
            this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 380, ease: 'Cubic.out' });
            this.onThunder?.();
        }
    }

    private updateNight(camX: number, lamp: { x: number; y: number; rot: number }, cabin: { x: number; y: number }, lights: Light[]): void {
        const rt = this.dark!;
        const glow = this.glowStamp!;
        const beam = this.beamStamp!;
        const Y = (y: number) => y - DARK_TOP;
        rt.clear();
        rt.fill(0x060a1c, 0.82);
        // headlight cone
        beam.setPosition(lamp.x, Y(lamp.y + 4)).setRotation(lamp.rot + 0.13).setScale(TEX_SCALE * 1.1, TEX_SCALE * 0.75).setAlpha(1);
        rt.erase(beam);
        // pool where the beam hits the road
        glow.setAlpha(0.9).setRotation(0);
        glow.setPosition(lamp.x + 330, Y(GROUND_Y + 10)).setScale(TEX_SCALE * 2.6, TEX_SCALE * 0.7);
        rt.erase(glow);
        // cabin light so you can always see the passenger and the bottle
        glow.setAlpha(0.8).setPosition(cabin.x, Y(cabin.y)).setScale(TEX_SCALE * 1.5, TEX_SCALE * 1.3);
        rt.erase(glow);
        // street lamps: a bright head and a pool on the road
        const xs = this.lampXs(camX);
        this.lampGlows.forEach((g, i) => {
            const x = xs[i];
            g.setVisible(x !== undefined);
            if (x !== undefined) g.setPosition(x, 308);
        });
        for (const x of xs) {
            glow.setAlpha(1).setPosition(x, Y(308)).setScale(TEX_SCALE * 0.5);
            rt.erase(glow);
            glow.setAlpha(0.85).setPosition(x - 10, Y(GROUND_Y)).setScale(TEX_SCALE * 1.9, TEX_SCALE * 1.2);
            rt.erase(glow);
        }
        // reflective hazards, signal lamps
        for (const l of lights) {
            glow.setAlpha(0.6).setPosition(l.x, Y(l.y)).setScale((TEX_SCALE * l.r) / 128);
            rt.erase(glow);
        }
        this.beamGlow!.setPosition(lamp.x, lamp.y + 4).setRotation(lamp.rot + 0.13).setScale(TEX_SCALE * 1.1, TEX_SCALE * 0.75);
    }
}
