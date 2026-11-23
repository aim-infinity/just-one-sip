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

/**
 * Notch / home-indicator insets in *design* pixels. The canvas is full-bleed
 * (edge to edge); only HUD and buttons are pushed inside these insets.
 */
export const SAFE = { left: 0, right: 0, top: 0, bottom: 0 };

export function measureSafeArea(): void {
    try {
        const d = document.createElement('div');
        d.style.cssText =
            'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
            'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
        document.body.appendChild(d);
        const cs = getComputedStyle(d);
        const k = DESIGN_HEIGHT / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
        SAFE.left = (parseFloat(cs.paddingLeft) || 0) * k;
        SAFE.right = (parseFloat(cs.paddingRight) || 0) * k;
        SAFE.top = (parseFloat(cs.paddingTop) || 0) * k;
        SAFE.bottom = (parseFloat(cs.paddingBottom) || 0) * k;
        d.remove();
    } catch {
        /* no env() support */
    }
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
