import Phaser from 'phaser';
import { DESIGN_HEIGHT } from './palette';

/**
 * Crisp rendering on high-DPI phones.
 *
 * All game code works in *design* pixels (720 tall). The real canvas is
 * `RS` times bigger and each scene's camera is zoomed by `RS`, so vector
 * graphics, text and canvas textures are rasterised at the device's real
 * resolution instead of being upscaled (which looked soft).
 */
function computeRenderScale(): number {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const shortSide = Math.min(window.innerWidth, window.innerHeight) * dpr;
    const rs = Math.ceil((shortSide / DESIGN_HEIGHT) * 4) / 4;
    return Math.min(2, Math.max(1, rs));
}

/** Render scale: canvas pixels per design pixel (1 … 2). */
export const RS = computeRenderScale();

/** Design-space width of the running game. */
export function designWidth(scene: Phaser.Scene): number {
    return Math.round(scene.scale.width / RS);
}

/** Call at the top of every scene's create(). */
export function setupCamera(scene: Phaser.Scene): void {
    scene.cameras.main.setOrigin(0, 0).setZoom(RS).setScroll(0, 0);
}

/** Make every Text object rasterise at the render scale (once, at boot). */
export function patchTextResolution(): void {
    const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
        text: (...args: unknown[]) => Phaser.GameObjects.Text;
    };
    const orig = proto.text;
    proto.text = function (this: unknown, ...args: unknown[]) {
        const t = orig.apply(this, args);
        t.setResolution(RS);
        return t;
    };
}
