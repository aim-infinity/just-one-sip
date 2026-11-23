import Phaser from 'phaser';
import { Rng } from '../core/rng';
import { PALETTE as P } from './palette';
import { AUTO_TEX, COW_TEX, SCOOTER_TEX, drawAutoBack, drawAutoFront, drawDriverHead, drawScooter, drawWheel, drawZebu } from './autoArt';
import { RS } from './resolution';

/**
 * Procedural placeholder art, drawn once with Canvas 2D into Phaser textures.
 * To replace with illustrated sprites, load PNGs with the same keys in the
 * Boot scene and skip the matching `make…` call (see README).
 */

type Ctx = CanvasRenderingContext2D;

export { AUTO_TEX };

/** Transparent rows above each tiled background layer. */
export const TILE_PAD = 6;

/** Images built from canvas textures must be displayed at this scale. */
export const TEX_SCALE = 1 / RS;

/** Draws a texture at the render scale so it stays crisp (display it with TEX_SCALE). */
function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, Math.ceil(w * RS), Math.ceil(h * RS));
    if (!tex) return;
    const c = tex.getContext();
    c.save();
    c.scale(RS, RS);
    draw(c);
    c.restore();
    tex.refresh();
}

/** Rounded rect path (manual, so it works on older iOS Safari). r = [tl, tr, br, bl]. */
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
    const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : [r[0], r[1] ?? r[0], r[2] ?? r[0], r[3] ?? r[0]];
    c.beginPath();
    c.moveTo(x + tl, y);
    c.lineTo(x + w - tr, y);
    c.arcTo(x + w, y, x + w, y + tr, tr);
    c.lineTo(x + w, y + h - br);
    c.arcTo(x + w, y + h, x + w - br, y + h, br);
    c.lineTo(x + bl, y + h);
    c.arcTo(x, y + h, x, y + h - bl, bl);
    c.lineTo(x, y + tl);
    c.arcTo(x, y, x + tl, y, tl);
    c.closePath();
}

function outline(c: Ctx, w = 4) {
    c.lineWidth = w;
    c.strokeStyle = P.inkCss;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
}

// ─── Background layers ─────────────────────────────────────────────────────

function drawSkyline(c: Ctx, W: number, H: number) {
    const rng = new Rng(11);
    // back row
    c.fillStyle = '#cfc6ea';
    let x = 0;
    while (x < W) {
        const w = Math.min(rng.range(60, 140), W - x);
        const h = rng.range(80, 170);
        c.fillRect(x, H - h, w + 1, h);
        x += w;
    }
    // front row with windows
    x = 0;
    const front = '#a99ed6';
    while (x < W) {
        const w = Math.min(rng.range(70, 150), W - x);
        const h = rng.range(60, 150);
        c.fillStyle = front;
        c.fillRect(x, H - h, w + 1, h);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        for (let wy = H - h + 12; wy < H - 14; wy += 18)
            for (let wx = x + 8; wx < x + w - 10; wx += 16) if (rng.chance(0.55)) c.fillRect(wx, wy, 7, 9);
        x += w;
    }
    // temple gopuram
    const gx = 330;
    c.fillStyle = '#9a8fcb';
    for (let i = 0; i < 6; i++) {
        const tw = 110 - i * 15;
        const th = 26;
        c.fillRect(gx - tw / 2, H - 70 - i * th - th, tw, th + 1);
        c.fillStyle = i % 2 ? '#9a8fcb' : '#8f84c2';
    }
    c.beginPath();
    c.ellipse(gx, H - 70 - 6 * 26 - 4, 20, 12, 0, Math.PI, 0);
    c.fill();
    c.fillRect(gx - 2, H - 70 - 6 * 26 - 26, 4, 14);
    c.fillRect(gx - 60, H - 70, 120, 70);
    // domed civic building
    const dx = 960;
    c.fillStyle = '#968bc8';
    c.fillRect(dx - 150, H - 90, 300, 90);
    c.fillRect(dx - 50, H - 130, 100, 40);
    c.beginPath();
    c.arc(dx, H - 130, 46, Math.PI, 0);
    c.fill();
    c.fillRect(dx - 2, H - 196, 4, 22);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = -130; i <= 120; i += 22) c.fillRect(dx + i, H - 80, 8, 70);
    // glass tech tower
    const tx = 1330;
    c.fillStyle = '#8b9fd6';
    c.fillRect(tx, H - 250, 90, 250);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    for (let wy = H - 240; wy < H - 10; wy += 14) c.fillRect(tx + 6, wy, 78, 5);
    // water tank
    c.fillStyle = '#9a8fcb';
    c.fillRect(640, H - 180, 70, 40);
    c.fillRect(648, H - 140, 6, 140);
    c.fillRect(696, H - 140, 6, 140);
}

const SHOP_SIGNS = [
    { t: 'CHAI', bg: '#c0392b', fg: '#fff3c4' },
    { t: 'FILTER COFFEE', bg: '#5b3a29', fg: '#ffe2a8' },
    { t: 'MOBILES', bg: '#1d6fb8', fg: '#ffffff' },
    { t: 'BAKERY', bg: '#e67e22', fg: '#fffbe9' },
    { t: 'SILKS', bg: '#8e2b6f', fg: '#ffd76a' },
    { t: 'MEDICALS', bg: '#1f9d55', fg: '#ffffff' },
    { t: 'TIFFINS', bg: '#d35400', fg: '#fff' },
    { t: 'XEROX', bg: '#2c3e50', fg: '#ffd84d' },
];

function drawTree(c: Ctx, x: number, base: number, s: number, rng: Rng) {
    c.fillStyle = '#6b4a2f';
    c.beginPath();
    c.moveTo(x - 9 * s, base);
    c.lineTo(x - 5 * s, base - 90 * s);
    c.lineTo(x + 5 * s, base - 90 * s);
    c.lineTo(x + 11 * s, base);
    c.fill();
    const greens = ['#2e8b57', '#3fa265', '#25784a', '#4cb36f'];
    for (let i = 0; i < 14; i++) {
        c.fillStyle = greens[i % greens.length];
        c.beginPath();
        c.arc(x + rng.range(-70, 70) * s, base - (100 + rng.range(-20, 45)) * s, rng.range(26, 40) * s, 0, Math.PI * 2);
        c.fill();
    }
    const blossom = rng.chance(0.5) ? '#ff7a45' : '#e57bc8';
    c.fillStyle = blossom;
    for (let i = 0; i < 26; i++) {
        c.beginPath();
        c.arc(x + rng.range(-80, 80) * s, base - (95 + rng.range(-25, 60)) * s, rng.range(3, 6) * s, 0, Math.PI * 2);
        c.fill();
    }
}

function drawMidrow(c: Ctx, W: number, H: number) {
    const rng = new Rng(23);
    const walls = ['#f2a65a', '#f7d08a', '#8fd3c7', '#e88d97', '#b5c99a', '#f4c7a1', '#a3c4f3'];
    let x = 10;
    let i = 0;
    while (x < W - 120) {
        const w = Math.min(rng.range(150, 210), W - 10 - x);
        const h = rng.range(140, 210);
        const top = H - h;
        c.fillStyle = walls[i % walls.length];
        c.fillRect(x, top, w, h);
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(x, top, w, 8);
        // upper windows
        c.fillStyle = '#5d6d7e';
        for (let wx = x + 18; wx < x + w - 30; wx += 46) {
            c.fillRect(wx, top + 22, 26, 30);
            c.fillStyle = '#e9e1c9';
            c.fillRect(wx - 3, top + 52, 32, 4);
            c.fillStyle = '#5d6d7e';
        }
        // sign board
        const sign = SHOP_SIGNS[i % SHOP_SIGNS.length];
        const sy = H - 108;
        c.fillStyle = sign.bg;
        rr(c, x + 8, sy, w - 16, 30, 4);
        c.fill();
        c.fillStyle = sign.fg;
        c.font = '800 19px "Baloo 2", "Trebuchet MS", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(sign.t, x + w / 2, sy + 16);
        // awning
        const aw = H - 76;
        for (let ax = x + 4; ax < x + w - 4; ax += 16) {
            c.fillStyle = ((ax - x) / 16) % 2 < 1 ? '#ffffff' : sign.bg;
            c.fillRect(ax, aw, Math.min(16, x + w - 4 - ax), 12);
        }
        // shutter / shop interior
        c.fillStyle = '#3b2f2a';
        c.fillRect(x + 14, aw + 12, w - 28, 64);
        c.fillStyle = '#7f8c8d';
        for (let sy2 = aw + 14; sy2 < H; sy2 += 7) c.fillRect(x + 14, sy2, w - 28, 2);
        x += w + rng.range(30, 80);
        i++;
    }
    // trees in front of the shops
    for (let tx = 140; tx < W - 100; tx += rng.range(320, 460)) drawTree(c, tx, H, rng.range(0.85, 1.1), rng);
}

function drawCow(c: Ctx, x: number, base: number) {
    c.fillStyle = '#f5f1e8';
    rr(c, x - 40, base - 52, 80, 34, 14);
    c.fill();
    outline(c, 3);
    c.fillStyle = '#f5f1e8';
    for (const lx of [-30, -16, 18, 30]) {
        c.fillRect(x + lx, base - 22, 7, 22);
        c.strokeRect(x + lx, base - 22, 7, 22);
    }
    c.beginPath();
    c.ellipse(x + 46, base - 54, 15, 11, 0.3, 0, Math.PI * 2);
    c.fill();
    outline(c, 3);
    c.fillStyle = '#e0a26c';
    c.beginPath();
    c.moveTo(x + 40, base - 64);
    c.lineTo(x + 36, base - 80);
    c.lineTo(x + 46, base - 66);
    c.fill();
    c.fillStyle = P.inkCss;
    c.beginPath();
    c.arc(x + 50, base - 57, 2.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d6cfc1';
    c.beginPath();
    c.ellipse(x - 8, base - 40, 12, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = P.inkCss;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - 40, base - 46);
    c.quadraticCurveTo(x - 52, base - 30, x - 46, base - 18);
    c.stroke();
}

function drawProps(c: Ctx, _W: number, H: number) {
    // street lamps
    const lamp = (x: number) => {
        c.fillStyle = '#56606b';
        c.fillRect(x - 3, H - 190, 6, 190);
        c.strokeStyle = '#56606b';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(x, H - 186);
        c.quadraticCurveTo(x + 6, H - 200, x + 34, H - 196);
        c.stroke();
        c.fillStyle = '#fff3b0';
        rr(c, x + 26, H - 198, 18, 8, 3);
        c.fill();
    };
    [120, 900, 1650].forEach(lamp);

    drawCow(c, 420, H - 2);

    // tender coconut cart
    const cx = 1180;
    c.fillStyle = '#8d5a2b';
    c.fillRect(cx - 60, H - 60, 120, 14);
    c.fillStyle = '#333';
    c.beginPath();
    c.arc(cx - 40, H - 14, 13, 0, Math.PI * 2);
    c.arc(cx + 40, H - 14, 13, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5aa02c';
    for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.arc(cx - 48 + (i % 5) * 24 + (i > 4 ? 12 : 0), H - 70 - (i > 4 ? 18 : 0), 12, 0, Math.PI * 2);
        c.fill();
        outline(c, 2);
    }

    // bus stop
    const bx = 1880;
    c.fillStyle = '#c0392b';
    c.fillRect(bx - 80, H - 130, 160, 12);
    c.fillStyle = '#7f8c8d';
    c.fillRect(bx - 74, H - 118, 6, 118);
    c.fillRect(bx + 68, H - 118, 6, 118);
    c.fillStyle = '#95a5a6';
    c.fillRect(bx - 60, H - 46, 120, 8);
    c.fillStyle = '#fff';
    c.font = '800 13px "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BUS STOP', bx, H - 123);

    // "no horn" sign — the irony
    const sx = 700;
    c.fillStyle = '#7f8c8d';
    c.fillRect(sx - 2, H - 110, 4, 110);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(sx, H - 120, 20, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#d63031';
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = P.inkCss;
    c.font = '800 11px "Baloo 2", sans-serif';
    c.fillText('HORN', sx, H - 120);
    c.beginPath();
    c.moveTo(sx - 13, H - 133);
    c.lineTo(sx + 13, H - 107);
    c.stroke();

    // little dustbin + potted plant
    c.fillStyle = '#27ae60';
    rr(c, 1460, H - 40, 26, 40, 4);
    c.fill();
    c.fillStyle = '#b9622f';
    rr(c, 1990, H - 30, 34, 30, 4);
    c.fill();
    c.fillStyle = '#3fa265';
    c.beginPath();
    c.arc(2007, H - 44, 20, 0, Math.PI * 2);
    c.fill();
}

function drawRoad(c: Ctx, W: number) {
    // texture y 0 ↔ screen y 500
    // far footpath
    c.fillStyle = '#cdbd9c';
    c.fillRect(0, 0, W, 26);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < W; x += 32) c.fillRect(x, 0, 2, 26);
    c.fillRect(0, 12, W, 2);
    c.fillStyle = '#8d8d8d';
    c.fillRect(0, 24, W, 6);
    // asphalt
    c.fillStyle = P.asphaltCss;
    c.fillRect(0, 30, W, 86);
    const rng = new Rng(5);
    for (let i = 0; i < 260; i++) {
        c.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
        c.fillRect(rng.range(0, W), rng.range(32, 114), rng.range(1, 4), rng.range(1, 3));
    }
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, 30, W, 5);
    // lane dashes
    c.fillStyle = '#efe9d6';
    for (let x = 30; x < W; x += 256) c.fillRect(x, 92, 90, 6);
    // near curb (yellow/black)
    for (let x = 0; x < W; x += 32) {
        c.fillStyle = (x / 32) % 2 === 0 ? '#ffc928' : '#2b2b2b';
        c.fillRect(x, 116, 32, 12);
    }
    // near footpath
    c.fillStyle = '#d9c9a7';
    c.fillRect(0, 128, W, 92);
    c.fillStyle = 'rgba(0,0,0,0.1)';
    for (let x = 0; x < W; x += 64) c.fillRect(x, 128, 3, 92);
    for (let y = 160; y < 220; y += 32) c.fillRect(0, y, W, 3);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, 128, W, 4);
}

function drawCloud(c: Ctx) {
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [
        [40, 44, 26],
        [72, 32, 32],
        [108, 42, 26],
        [136, 50, 18],
        [20, 54, 16],
    ])
        c.beginPath(), c.arc(x, y, r, 0, Math.PI * 2), c.fill();
    c.fillRect(20, 50, 120, 20);
}

function drawSun(c: Ctx) {
    const g = c.createRadialGradient(60, 60, 10, 60, 60, 60);
    g.addColorStop(0, 'rgba(255,240,180,1)');
    g.addColorStop(0.45, 'rgba(255,214,120,0.9)');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 120, 120);
}

function drawSky(c: Ctx) {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#6ec1f5');
    g.addColorStop(0.65, '#bfe4f7');
    g.addColorStop(1, '#ffe2b0');
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 512);
}

export function makeTextures(scene: Phaser.Scene): void {
    canvasTex(scene, 'sky', 4, 512, drawSky);
    canvasTex(scene, 'sun', 120, 120, drawSun);
    canvasTex(scene, 'cloud', 160, 80, drawCloud);
    // Tiled layers get a transparent top margin so texture wrapping can't
    // bleed their opaque bottom edge into the sky as a faint line.
    const padded = (draw: (c: Ctx) => void) => (c: Ctx) => {
        c.translate(0, TILE_PAD);
        draw(c);
    };
    canvasTex(scene, 'skyline', 1600, 300 + TILE_PAD, padded((c) => drawSkyline(c, 1600, 300)));
    canvasTex(scene, 'midrow', 1800, 300 + TILE_PAD, padded((c) => drawMidrow(c, 1800, 300)));
    canvasTex(scene, 'props', 2040, 210 + TILE_PAD, padded((c) => drawProps(c, 2040, 210)));
    canvasTex(scene, 'road', 512, 220, (c) => drawRoad(c, 512));
    canvasTex(scene, 'wheel', 64, 64, drawWheel);
    canvasTex(scene, 'autoBack', AUTO_TEX.w, AUTO_TEX.h, drawAutoBack);
    canvasTex(scene, 'autoFront', AUTO_TEX.w, AUTO_TEX.h, drawAutoFront);
    canvasTex(scene, 'zebu', COW_TEX.w, COW_TEX.h, drawZebu);
    canvasTex(scene, 'driverHead', 44, 44, drawDriverHead);
    canvasTex(scene, 'scooter', SCOOTER_TEX.w, SCOOTER_TEX.h, drawScooter);
    // soft light brushes for night (erased out of the darkness layer)
    canvasTex(scene, 'glow', 256, 256, (c) => {
        const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 256, 256);
    });
    canvasTex(scene, 'beam', 720, 300, (c) => {
        // headlight cone with soft edges: stacked wedges, widest = faintest
        const g = c.createLinearGradient(0, 0, 720, 0);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        for (let i = 0; i < 6; i++) {
            const spread = 150 - i * 22;
            c.globalAlpha = 0.28;
            c.beginPath();
            c.moveTo(0, 144);
            c.lineTo(720, 150 - spread);
            c.lineTo(720, 150 + spread);
            c.lineTo(0, 156);
            c.closePath();
            c.fill();
        }
        c.globalAlpha = 1;
    });
    // composite auto for the HUD / share card (no characters)
    canvasTex(scene, 'autoIcon', AUTO_TEX.w, AUTO_TEX.h + 10, (c) => {
        const src = (k: string) => scene.textures.get(k).getSourceImage() as HTMLCanvasElement;
        const W = AUTO_TEX.w;
        const H = AUTO_TEX.h;
        c.drawImage(src('autoBack'), 0, 0, W, H);
        c.drawImage(src('driverHead'), AUTO_TEX.ox + 60, AUTO_TEX.oy - 174, 44, 44);
        c.drawImage(src('wheel'), AUTO_TEX.ox - 95 - 32, AUTO_TEX.oy - 32, 64, 64);
        c.drawImage(src('wheel'), AUTO_TEX.ox + 95 - 32, AUTO_TEX.oy - 32, 64, 64);
        c.drawImage(src('autoFront'), 0, 0, W, H);
    });
}
