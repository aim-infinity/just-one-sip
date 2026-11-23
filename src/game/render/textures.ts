import Phaser from 'phaser';
import { Rng } from '../core/rng';
import { PALETTE as P } from './palette';

/**
 * Procedural placeholder art, drawn once with Canvas 2D into Phaser textures.
 * To replace with illustrated sprites, load PNGs with the same keys in the
 * Boot scene and skip the matching `make…` call (see README).
 */

type Ctx = CanvasRenderingContext2D;

export const AUTO_TEX = { w: 360, h: 230, ox: 180, oy: 200 };

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const c = tex.getContext();
    draw(c);
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
    { t: 'DARSHINI', bg: '#c0392b', fg: '#fff3c4' },
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
    const bx = 1950;
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
    rr(c, 2180, H - 30, 34, 30, 4);
    c.fill();
    c.fillStyle = '#3fa265';
    c.beginPath();
    c.arc(2197, H - 44, 20, 0, Math.PI * 2);
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

// ─── Auto rickshaw ─────────────────────────────────────────────────────────

const L = (x: number) => AUTO_TEX.ox + x;
const T = (y: number) => AUTO_TEX.oy + y;

function drawAutoBack(c: Ctx) {
    // far-side canopy fabric / interior shade
    const g = c.createLinearGradient(0, T(-168), 0, T(-30));
    g.addColorStop(0, '#2e2a28');
    g.addColorStop(1, '#4a423d');
    c.fillStyle = g;
    c.fillRect(L(-152), T(-168), 280, 140);
    // floor
    c.fillStyle = '#2a2523';
    c.fillRect(L(-152), T(-36), 280, 12);
    // rear bench
    c.fillStyle = '#9b2f2f';
    rr(c, L(-154), T(-142), 20, 66, 6);
    c.fill();
    outline(c, 3);
    c.fillStyle = '#b13a3a';
    rr(c, L(-152), T(-90), 112, 16, 6);
    c.fill();
    outline(c, 3);
    // fare meter
    c.fillStyle = '#111';
    rr(c, L(96), T(-160), 20, 16, 3);
    c.fill();
    c.fillStyle = '#e74c3c';
    c.fillRect(L(112), T(-172), 3, 12);
    c.fillRect(L(112), T(-172), 10, 6);
    c.fillStyle = '#ff6b6b';
    c.fillRect(L(99), T(-156), 14, 6);
    // driver seat
    c.fillStyle = '#5a3a2a';
    rr(c, L(44), T(-124), 12, 46, 4);
    c.fill();
    rr(c, L(48), T(-86), 46, 12, 4);
    c.fill();
    // steering column + handlebar
    c.strokeStyle = '#6d7680';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(L(126), T(-40));
    c.lineTo(L(116), T(-108));
    c.stroke();
    c.strokeStyle = '#1b1b1b';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(L(106), T(-112));
    c.lineTo(L(122), T(-106));
    c.stroke();
    // driver body (khaki uniform)
    const khaki = '#b9a36b';
    c.strokeStyle = '#8f7c4b';
    c.lineWidth = 13;
    c.beginPath();
    c.moveTo(L(66), T(-84));
    c.lineTo(L(100), T(-80));
    c.lineTo(L(108), T(-40));
    c.stroke();
    c.fillStyle = khaki;
    rr(c, L(56), T(-132), 30, 52, 10);
    c.fill();
    outline(c, 3);
    c.strokeStyle = khaki;
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(L(78), T(-124));
    c.lineTo(L(98), T(-104));
    c.lineTo(L(112), T(-109));
    c.stroke();
    c.fillStyle = '#a96f47';
    c.beginPath();
    c.arc(L(113), T(-109), 5.5, 0, Math.PI * 2);
    c.fill();
    // neck
    c.fillStyle = '#a96f47';
    c.fillRect(L(70), T(-140), 10, 10);
}

function drawAutoFront(c: Ctx) {
    // ── lower body (green) ──
    c.fillStyle = P.autoGreenCss;
    rr(c, L(-172), T(-78), 220, 66, [6, 6, 6, 22]);
    c.fill();
    outline(c, 4);
    // floor / footboard to the front panel
    rr(c, L(40), T(-36), 90, 22, 4);
    c.fill();
    outline(c, 4);
    // front panel ("face")
    c.beginPath();
    c.moveTo(L(118), T(-114));
    c.lineTo(L(142), T(-114));
    c.lineTo(L(154), T(-62));
    c.lineTo(L(150), T(-16));
    c.lineTo(L(120), T(-16));
    c.closePath();
    c.fillStyle = P.autoGreenCss;
    c.fill();
    outline(c, 4);
    c.save();
    c.clip();
    c.fillStyle = P.yellowCss;
    c.fillRect(L(110), T(-120), 50, 48);
    c.restore();
    c.beginPath();
    c.moveTo(L(118), T(-114));
    c.lineTo(L(142), T(-114));
    c.lineTo(L(154), T(-62));
    c.lineTo(L(150), T(-16));
    c.lineTo(L(120), T(-16));
    c.closePath();
    outline(c, 4);
    // yellow band along the body
    c.fillStyle = P.yellowCss;
    c.fillRect(L(-170), T(-76), 216, 13);
    c.fillStyle = P.autoGreenDarkCss;
    c.fillRect(L(-166), T(-22), 210, 7);
    // wheel arches (cut out so the wheels show), then rims
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(L(-95), T(0), 31, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(L(95), T(0), 31, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = P.inkCss;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(L(-95), T(0), 31, Math.PI * 1.02, Math.PI * 1.98);
    c.stroke();
    // front mudguard
    c.strokeStyle = P.autoGreenDarkCss;
    c.lineWidth = 8;
    c.beginPath();
    c.arc(L(95), T(0), 32, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.strokeStyle = P.inkCss;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(L(95), T(0), 36, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    // headlight + indicator
    c.fillStyle = '#d9d9d9';
    c.beginPath();
    c.arc(L(146), T(-86), 10, 0, Math.PI * 2);
    c.fill();
    outline(c, 3);
    c.fillStyle = '#fff7c2';
    c.beginPath();
    c.arc(L(147), T(-86), 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff9f1a';
    rr(c, L(146), T(-58), 7, 6, 2);
    c.fill();
    // tail lamp
    c.fillStyle = '#e74c3c';
    rr(c, L(-176), T(-62), 7, 16, 2);
    c.fill();
    // lettering
    c.fillStyle = '#fff8d6';
    c.font = '800 15px "Baloo 2", "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('NAMMA AUTO', L(-30), T(-42));

    // ── canopy (black) ──
    c.fillStyle = P.canopyCss;
    rr(c, L(-172), T(-188), 316, 22, [26, 14, 4, 4]);
    c.fill();
    outline(c, 4);
    rr(c, L(-172), T(-186), 22, 110, [24, 0, 0, 6]);
    c.fill();
    outline(c, 4);
    c.fillStyle = '#3d3936';
    c.fillRect(L(-150), T(-182), 290, 4);
    // windshield frame + glass
    c.fillStyle = '#2a2a2a';
    c.fillRect(L(122), T(-168), 10, 56);
    c.fillStyle = 'rgba(190,230,255,0.85)';
    c.fillRect(L(132), T(-168), 7, 54);
    // chrome rod behind the driver
    c.strokeStyle = '#c8ccd0';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(L(42), T(-166));
    c.lineTo(L(42), T(-78));
    c.stroke();
}

function drawWheel(c: Ctx) {
    const cx = 30;
    c.fillStyle = '#1c1c1c';
    c.beginPath();
    c.arc(cx, cx, 24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#333';
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.save();
        c.translate(cx + Math.cos(a) * 21, cx + Math.sin(a) * 21);
        c.rotate(a);
        c.fillRect(-2, -3, 4, 6);
        c.restore();
    }
    c.fillStyle = '#b8bec4';
    c.beginPath();
    c.arc(cx, cx, 13, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#7d858c';
    c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx, cx);
        c.lineTo(cx + Math.cos(a) * 12, cx + Math.sin(a) * 12);
        c.stroke();
    }
    c.fillStyle = '#4b5258';
    c.beginPath();
    c.arc(cx, cx, 4.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e74c3c';
    c.beginPath();
    c.arc(cx + 9, cx, 2, 0, Math.PI * 2);
    c.fill();
}

function drawDriverHead(c: Ctx) {
    const cx = 22;
    const cy = 24;
    c.fillStyle = '#a96f47';
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.fill();
    outline(c, 3);
    c.fillStyle = '#1d1512';
    c.beginPath();
    c.arc(cx - 2, cy - 5, 13, Math.PI * 1.02, Math.PI * 1.95);
    c.fill();
    c.fillRect(cx - 15, cy - 6, 8, 8);
    // eye, nose, moustache
    c.fillStyle = '#1d1512';
    c.beginPath();
    c.arc(cx + 7, cy - 2, 2, 0, Math.PI * 2);
    c.fill();
    c.fillRect(cx + 4, cy - 7, 7, 2);
    c.beginPath();
    c.ellipse(cx + 9, cy + 6, 7, 3, -0.1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8a5838';
    c.beginPath();
    c.arc(cx - 3, cy + 1, 3.5, 0, Math.PI * 2);
    c.fill();
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
    canvasTex(scene, 'skyline', 1600, 300, (c) => drawSkyline(c, 1600, 300));
    canvasTex(scene, 'midrow', 1800, 300, (c) => drawMidrow(c, 1800, 300));
    canvasTex(scene, 'props', 2400, 210, (c) => drawProps(c, 2400, 210));
    canvasTex(scene, 'road', 512, 220, (c) => drawRoad(c, 512));
    canvasTex(scene, 'wheel', 60, 60, drawWheel);
    canvasTex(scene, 'autoBack', AUTO_TEX.w, AUTO_TEX.h, drawAutoBack);
    canvasTex(scene, 'autoFront', AUTO_TEX.w, AUTO_TEX.h, drawAutoFront);
    canvasTex(scene, 'driverHead', 44, 44, drawDriverHead);
    // composite auto for menus / share card
    canvasTex(scene, 'autoIcon', AUTO_TEX.w, AUTO_TEX.h + 10, (c) => {
        const src = (k: string) => scene.textures.get(k).getSourceImage() as HTMLCanvasElement;
        c.drawImage(src('autoBack'), 0, 0);
        c.drawImage(src('driverHead'), L(60), T(-170));
        c.drawImage(src('wheel'), L(-95) - 30, T(0) - 30);
        c.drawImage(src('wheel'), L(95) - 30, T(0) - 30);
        c.drawImage(src('autoFront'), 0, 0);
    });
}
