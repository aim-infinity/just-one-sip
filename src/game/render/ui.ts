import Phaser from 'phaser';
import { sound } from '../systems/sound';
import { FONT, PALETTE as P } from './palette';

export interface ButtonOpts {
    width?: number;
    height?: number;
    fill?: number;
    textColor?: string;
    fontSize?: number;
    depth?: number;
}

/**
 * Chunky cartoon button. Fires on pointer *up* inside the button (so a drag
 * off cancels), with a press-down squash for feedback.
 */
export function makeButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
    const w = opts.width ?? 280;
    const h = opts.height ?? 76;
    const fill = opts.fill ?? P.yellow;
    const shadow = scene.add.graphics();
    shadow.fillStyle(P.ink, 1);
    shadow.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, h / 2.6);
    const body = scene.add.graphics();
    const draw = (pressed: boolean) => {
        body.clear();
        body.fillStyle(fill, 1);
        body.fillRoundedRect(-w / 2, -h / 2 + (pressed ? 5 : 0), w, h, h / 2.6);
        body.lineStyle(4, P.ink, 1);
        body.strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 5 : 0), w, h, h / 2.6);
        body.fillStyle(0xffffff, 0.28);
        body.fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (pressed ? 5 : 0), w - 20, h * 0.28, h / 6);
    };
    draw(false);
    const text = scene.add
        .text(0, 0, label, {
            fontFamily: FONT,
            fontSize: `${opts.fontSize ?? 32}px`,
            color: opts.textColor ?? P.inkCss,
            fontStyle: '800',
        })
        .setOrigin(0.5, 0.56);
    const c = scene.add.container(x, y, [shadow, body, text]).setSize(w, h + 8);
    if (opts.depth !== undefined) c.setDepth(opts.depth);
    c.setInteractive({ useHandCursor: true });
    let down = false;
    c.on('pointerdown', () => {
        down = true;
        draw(true);
        text.y = 5;
        sound.unlock();
    });
    c.on('pointerout', () => {
        down = false;
        draw(false);
        text.y = 0;
    });
    c.on('pointerup', () => {
        draw(false);
        text.y = 0;
        if (!down) return;
        down = false;
        sound.click();
        onClick();
    });
    return c;
}

/** Round icon button (pause, sound...). Label can be swapped later via setData('label'). */
export function makeIconButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
    onClick: () => void,
    size = 64,
): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    const redraw = () => {
        g.clear();
        g.fillStyle(P.ink, 0.25);
        g.fillCircle(0, 4, size / 2);
        g.fillStyle(P.cream, 0.95);
        g.fillCircle(0, 0, size / 2);
        g.lineStyle(3.5, P.ink, 1);
        g.strokeCircle(0, 0, size / 2);
        draw(g);
    };
    redraw();
    const c = scene.add.container(x, y, [g]).setSize(size + 16, size + 16);
    c.setInteractive({ useHandCursor: true });
    c.setData('redraw', redraw);
    c.on('pointerdown', () => {
        sound.unlock();
        c.setScale(0.92);
    });
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
        c.setScale(1);
        sound.click();
        onClick();
        redraw();
    });
    return c;
}

export function drawSpeaker(g: Phaser.GameObjects.Graphics, muted: boolean): void {
    g.fillStyle(P.ink, 1);
    g.fillRect(-13, -6, 8, 12);
    g.fillTriangle(-6, -6, 4, -14, 4, 14);
    g.fillTriangle(-6, -6, -6, 6, 4, 14);
    g.lineStyle(3, P.ink, 1);
    if (muted) {
        g.lineBetween(8, -7, 18, 7);
        g.lineBetween(18, -7, 8, 7);
    } else {
        g.beginPath();
        g.arc(6, 0, 8, -0.8, 0.8);
        g.strokePath();
        g.beginPath();
        g.arc(6, 0, 14, -0.8, 0.8);
        g.strokePath();
    }
}

export function drawPauseIcon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(P.ink, 1);
    g.fillRoundedRect(-10, -12, 7, 24, 2);
    g.fillRoundedRect(3, -12, 7, 24, 2);
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = P.cream): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(P.ink, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 8, w, h, 28);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    g.lineStyle(4, P.ink, 1);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 28);
    return g;
}

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = P.inkCss, weight = '800') {
    return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: weight, align: 'center' }).setOrigin(0.5);
}

/** Outlined "sticker" title text. */
export function title(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#ffffff') {
    return scene.add
        .text(x, y, text, {
            fontFamily: FONT,
            fontSize: `${size}px`,
            color,
            fontStyle: '800',
            stroke: P.inkCss,
            strokeThickness: Math.round(size / 6),
            align: 'center',
        })
        .setOrigin(0.5)
        .setShadow(0, Math.round(size / 12), P.inkCss, 0, true, false);
}
