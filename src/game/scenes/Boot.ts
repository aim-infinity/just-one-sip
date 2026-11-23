import Phaser from 'phaser';
import { makeTextures } from '../render/textures';

/** Waits briefly for the web font, builds procedural textures, then goes Home. */
export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    async create(): Promise<void> {
        try {
            await Promise.race([
                Promise.all([document.fonts.load('800 32px "Baloo 2"'), document.fonts.load('600 20px "Baloo 2"')]),
                new Promise((r) => setTimeout(r, 2500)),
            ]);
        } catch {
            /* offline — fall back to system font */
        }
        makeTextures(this);
        document.getElementById('loading')?.remove();
        this.scene.start('Home');
    }
}
