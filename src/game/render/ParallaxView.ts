import Phaser from 'phaser';
import { RS } from './resolution';
import { TEX_SCALE, TILE_PAD } from './textures';
import type { WeatherProfile } from '../config/weather';

interface Layer {
    sprite: Phaser.GameObjects.TileSprite;
    factor: number;
}

/**
 * Layered parallax background:
 *  1. sky + sun + clouds (near-static)
 *  2. distant skyline (temple tower, civic dome, tech park)
 *  3. shops and rain trees
 *  4. roadside props (lamps, cow, coconut cart, bus stop)
 * The road, auto and UI are separate layers above this.
 */
export class ParallaxView {
    private layers: Layer[] = [];
    private clouds: Phaser.GameObjects.Image[] = [];
    private tint = 0xffffff;

    constructor(scene: Phaser.Scene, width: number, weather?: WeatherProfile) {
        const night = !!weather?.night;
        const rainy = weather?.id === 'rainy';
        scene.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(width, 520).setDepth(0);
        if (rainy) scene.add.rectangle(0, 0, width, 520, 0x55606c, 0.7).setOrigin(0).setDepth(0);
        if (night) {
            scene.add.rectangle(0, 0, width, 520, 0x0b1330, 0.94).setOrigin(0).setDepth(0);
            const stars = scene.add.graphics().setDepth(0);
            for (let i = 0; i < 90; i++) {
                stars.fillStyle(0xffffff, 0.4 + ((i * 37) % 60) / 100);
                stars.fillCircle((i * 173) % width, (i * 97) % 300, 1 + (i % 3) * 0.6);
            }
            stars.fillStyle(0xfff6d8, 1);
            stars.fillCircle(width * 0.8, 90, 34);
            stars.fillStyle(0x0b1330, 1);
            stars.fillCircle(width * 0.8 + 14, 82, 30);
        } else if (!rainy) {
            scene.add.image(width * 0.78, 110, 'sun').setDepth(0).setScale(1.3 * TEX_SCALE);
        }
        const nClouds = rainy ? 7 : night ? 2 : 4;
        for (let i = 0; i < nClouds; i++) {
            const c = scene.add
                .image(((i + 0.3) * width) / (nClouds - 0.5), 60 + (i % 2) * 60, 'cloud')
                .setDepth(0)
                .setScale((0.7 + (i % 3) * 0.25) * TEX_SCALE * (rainy ? 1.5 : 1))
                .setAlpha(night ? 0.18 : 0.9);
            if (rainy) c.setTint(0x8a949e);
            this.clouds.push(c);
        }
        this.tint = night ? 0x56608e : rainy ? 0xa9b3be : 0xffffff;
        const add = (key: string, bottom: number, h: number, factor: number, depth: number) => {
            const sprite = scene.add.tileSprite(0, bottom - h - TILE_PAD, width, h + TILE_PAD, key).setOrigin(0).setDepth(depth).setTileScale(TEX_SCALE);
            sprite.setTint(this.tint);
            this.layers.push({ sprite, factor });
        };
        add('skyline', 470, 300, 0.05, 1);
        add('midrow', 502, 300, 0.4, 2);
        add('props', 506, 210, 0.85, 3);
    }

    update(camX: number, dt: number, width: number): void {
        // tilePosition is in texture pixels, which are RS× design pixels
        for (const l of this.layers) l.sprite.tilePositionX = camX * l.factor * RS;
        for (const c of this.clouds) {
            c.x -= dt * 8;
            if (c.x < -120) c.x = width + 120;
        }
    }
}
