import Phaser from 'phaser';

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

    constructor(scene: Phaser.Scene, width: number) {
        scene.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(width, 520).setDepth(0);
        scene.add.image(width * 0.78, 110, 'sun').setDepth(0).setScale(1.3);
        for (let i = 0; i < 4; i++) {
            const c = scene.add
                .image(((i + 0.3) * width) / 3.5, 70 + (i % 2) * 60, 'cloud')
                .setDepth(0)
                .setScale(0.7 + (i % 3) * 0.25)
                .setAlpha(0.9);
            this.clouds.push(c);
        }
        const add = (key: string, bottom: number, h: number, factor: number, depth: number) => {
            const sprite = scene.add.tileSprite(0, bottom - h, width, h, key).setOrigin(0).setDepth(depth);
            this.layers.push({ sprite, factor });
        };
        add('skyline', 470, 300, 0.06, 1);
        add('midrow', 502, 300, 0.3, 2);
        add('props', 506, 210, 0.75, 3);
    }

    update(camX: number, dt: number, width: number): void {
        for (const l of this.layers) l.sprite.tilePositionX = camX * l.factor;
        for (const c of this.clouds) {
            c.x -= dt * 8;
            if (c.x < -120) c.x = width + 120;
        }
    }
}
