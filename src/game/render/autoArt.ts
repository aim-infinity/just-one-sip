/**
 * Canvas2D art for the auto-rickshaw, its wheels and the street cow.
 * Drawn once at boot into textures (see textures.ts). All auto coordinates are
 * in "art space": origin = midpoint between the axles, y up = negative,
 * wheelbase 190, wheel radius 24. The auto faces right.
 */
type Ctx = CanvasRenderingContext2D;

export const AUTO_TEX = { w: 400, h: 236, ox: 200, oy: 204 };

const INK = '#2b1d14';

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

function ink(c: Ctx, w = 4) {
    c.lineWidth = w;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
}

function vgrad(c: Ctx, y0: number, y1: number, stops: [number, string][]) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    for (const [o, col] of stops) g.addColorStop(o, col);
    return g;
}

// ─── Behind the characters: interior, seats, driver body (unchanged design) ─

export function drawAutoBack(c: Ctx): void {
    c.save();
    c.translate(AUTO_TEX.ox, AUTO_TEX.oy);
    // far-side canopy fabric / interior shade
    c.fillStyle = vgrad(c, -168, -30, [
        [0, '#2e2a28'],
        [1, '#4a423d'],
    ]);
    c.fillRect(-152, -168, 262, 140);
    // floor
    c.fillStyle = '#2a2523';
    c.fillRect(-152, -36, 262, 12);
    // rear bench
    c.fillStyle = '#9b2f2f';
    rr(c, -154, -142, 20, 66, 6);
    c.fill();
    ink(c, 3);
    c.fillStyle = '#b13a3a';
    rr(c, -152, -90, 112, 16, 6);
    c.fill();
    ink(c, 3);
    // fare meter
    c.fillStyle = '#111';
    rr(c, 76, -164, 20, 16, 3);
    c.fill();
    c.fillStyle = '#e74c3c';
    c.fillRect(92, -176, 3, 12);
    c.fillRect(92, -176, 10, 6);
    c.fillStyle = '#ff6b6b';
    c.fillRect(79, -160, 14, 6);
    // driver seat
    c.fillStyle = '#5a3a2a';
    rr(c, 44, -124, 12, 46, 4);
    c.fill();
    rr(c, 48, -86, 46, 12, 4);
    c.fill();
    // steering column + handlebar
    c.strokeStyle = '#6d7680';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(126, -40);
    c.lineTo(116, -108);
    c.stroke();
    c.strokeStyle = '#1b1b1b';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(106, -112);
    c.lineTo(122, -106);
    c.stroke();
    // driver body (khaki uniform)
    const khaki = '#b9a36b';
    c.strokeStyle = '#8f7c4b';
    c.lineWidth = 13;
    c.beginPath();
    c.moveTo(66, -84);
    c.lineTo(100, -80);
    c.lineTo(108, -40);
    c.stroke();
    c.fillStyle = khaki;
    rr(c, 56, -132, 30, 52, 10);
    c.fill();
    ink(c, 3);
    c.strokeStyle = khaki;
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(78, -124);
    c.lineTo(98, -104);
    c.lineTo(112, -109);
    c.stroke();
    c.fillStyle = '#a96f47';
    c.beginPath();
    c.arc(113, -109, 5.5, 0, Math.PI * 2);
    c.fill();
    // neck
    c.fillRect(70, -140, 10, 10);
    c.restore();
}

/** Driver head (unchanged design), drawn into a 44×44 texture. */
export function drawDriverHead(c: Ctx): void {
    const cx = 22;
    const cy = 24;
    c.fillStyle = '#a96f47';
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.fill();
    ink(c, 3);
    c.fillStyle = '#1d1512';
    c.beginPath();
    c.arc(cx - 2, cy - 5, 13, Math.PI * 1.02, Math.PI * 1.95);
    c.fill();
    c.fillRect(cx - 15, cy - 6, 8, 8);
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

// ─── In front of the characters: body shell ───────────────────────────────
// Front end modelled on the reference illustration: front wheel ahead under a
// big curved fender, white fork strut, tall front panel with indicator and
// trim bar, back-raked windshield, roof sloping down to the front, white
// sweep line along the floor, lighter rear-arch panel, luggage rack.

const G_MAIN = '#1f9d55';
const G_LIGHT = '#3cbf74';
const G_DARK = '#137a40';
const WHITE = '#f7f4ec';

function tubPath(c: Ctx) {
    c.beginPath();
    c.moveTo(-170, -12);
    c.lineTo(-172, -74);
    c.quadraticCurveTo(-172, -82, -164, -82);
    c.lineTo(36, -82);
    c.quadraticCurveTo(46, -82, 48, -72);
    c.lineTo(52, -50);
    c.quadraticCurveTo(54, -42, 64, -42);
    c.lineTo(92, -42);
    c.quadraticCurveTo(72, -34, 66, -16);
    c.lineTo(-62, -14);
    c.arc(-95, 0, 32, -0.08, Math.PI + 0.08, true);
    c.lineTo(-150, -12);
    c.closePath();
}

function cowlPath(c: Ctx) {
    c.beginPath();
    c.moveTo(96, -112);
    c.lineTo(130, -112);
    c.quadraticCurveTo(134, -112, 135, -106);
    c.lineTo(140, -62);
    c.quadraticCurveTo(141, -50, 130, -46);
    c.lineTo(90, -42);
    c.quadraticCurveTo(88, -80, 96, -112);
    c.closePath();
}

function fenderPath(c: Ctx) {
    c.beginPath();
    c.arc(98, -2, 47, Math.PI * 1.04, Math.PI * 1.93);
    c.lineTo(146, -20);
    c.arc(95, 0, 31, -0.15, Math.PI * 1.06, true);
    c.closePath();
}

export function drawAutoFront(c: Ctx): void {
    c.save();
    c.translate(AUTO_TEX.ox, AUTO_TEX.oy);

    // chassis + silencer under the floor
    c.fillStyle = '#26282c';
    rr(c, -66, -18, 140, 16, 8);
    c.fill();
    c.strokeStyle = '#1b1b1b';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-124, -5);
    c.lineTo(-188, -3);
    c.stroke();
    c.fillStyle = '#9aa1a7';
    rr(c, -194, -8, 12, 9, 3);
    c.fill();

    // fork strut (white, from the hub up into the fender)
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(95, 0);
    c.lineTo(84, -38);
    c.stroke();
    c.strokeStyle = WHITE;
    c.lineWidth = 5;
    c.stroke();

    // ── passenger tub ──
    tubPath(c);
    c.fillStyle = vgrad(c, -82, -12, [
        [0, '#27b062'],
        [1, '#178a48'],
    ]);
    c.fill();
    c.save();
    tubPath(c);
    c.clip();
    // lighter panel around the rear wheel arch
    c.fillStyle = G_LIGHT;
    c.beginPath();
    c.arc(-95, 0, 46, 0, Math.PI * 2);
    c.fill();
    // yellow upper band + pinstripe
    c.fillStyle = vgrad(c, -82, -66, [
        [0, '#ffe066'],
        [1, '#f5b800'],
    ]);
    c.fillRect(-180, -82, 240, 16);
    c.fillStyle = G_DARK;
    c.fillRect(-180, -66, 240, 3);
    c.restore();
    tubPath(c);
    ink(c, 3.5);

    // white sweep line along the floor, curving up the front
    c.strokeStyle = WHITE;
    c.lineWidth = 4.5;
    c.beginPath();
    c.moveTo(-48, -22);
    c.lineTo(50, -22);
    c.quadraticCurveTo(70, -22, 80, -36);
    c.stroke();

    // painted decoration: a simple flower vine (no lettering)
    c.strokeStyle = '#fff2b8';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-90, -44);
    c.bezierCurveTo(-60, -56, -40, -32, -10, -44);
    c.bezierCurveTo(10, -52, 25, -38, 40, -44);
    c.stroke();
    for (const [x, y] of [[-90, -44], [-40, -40], [10, -48], [40, -44]]) {
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            c.fillStyle = i % 2 ? '#ffd23f' : '#ff8c5a';
            c.beginPath();
            c.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2);
            c.fill();
        }
        c.fillStyle = '#e74c3c';
        c.beginPath();
        c.arc(x, y, 2.2, 0, Math.PI * 2);
        c.fill();
    }

    // rear details: tail lamp, white bumper tab, luggage rack, canopy straps
    c.fillStyle = '#e74c3c';
    rr(c, -177, -64, 7, 15, 2);
    c.fill();
    c.fillStyle = WHITE;
    rr(c, -178, -36, 8, 18, 3);
    c.fill();
    c.strokeStyle = WHITE;
    c.lineWidth = 3;
    rr(c, -150, -98, 30, 15, 5);
    c.stroke();
    c.beginPath();
    c.moveTo(-150, -91);
    c.lineTo(-120, -91);
    c.stroke();

    // ── front fender over the wheel ──
    fenderPath(c);
    c.fillStyle = vgrad(c, -50, -16, [
        [0, '#27b062'],
        [1, G_DARK],
    ]);
    c.fill();
    ink(c, 3);
    c.strokeStyle = WHITE;
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(95, 0, 33.5, Math.PI * 1.5, Math.PI * 1.96);
    c.stroke();

    // ── front panel ──
    cowlPath(c);
    c.fillStyle = vgrad(c, -112, -42, [
        [0, '#2bb468'],
        [1, G_MAIN],
    ]);
    c.fill();
    c.save();
    cowlPath(c);
    c.clip();
    c.fillStyle = '#ffd23f';
    c.fillRect(80, -82, 70, 16);
    c.fillStyle = G_DARK;
    c.fillRect(80, -66, 70, 3);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(130, -110, 4, 44);
    c.restore();
    cowlPath(c);
    ink(c, 3.5);
    // indicator + white trim bar
    c.fillStyle = '#ffb020';
    rr(c, 110, -100, 14, 7, 1.5);
    c.fill();
    ink(c, 1.8);
    c.fillStyle = WHITE;
    rr(c, 98, -58, 42, 6, 3);
    c.fill();
    ink(c, 1.5);
    // headlamp at the nose of the fender
    c.fillStyle = '#d6dbe0';
    c.beginPath();
    c.arc(140, -36, 7.5, 0, Math.PI * 2);
    c.fill();
    ink(c, 2);
    c.fillStyle = '#fff3a8';
    c.beginPath();
    c.arc(141.5, -36, 4.5, 0, Math.PI * 2);
    c.fill();

    // ── windshield (raked back) + front pillar ──
    c.beginPath();
    c.moveTo(100, -112);
    c.lineTo(126, -112);
    c.lineTo(108, -168);
    c.lineTo(100, -168);
    c.closePath();
    c.fillStyle = 'rgba(142,202,230,0.92)';
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(118, -118);
    c.lineTo(106, -156);
    c.stroke();
    c.beginPath();
    c.moveTo(124, -112);
    c.lineTo(134, -112);
    c.lineTo(114, -172);
    c.lineTo(106, -172);
    c.closePath();
    c.fillStyle = G_MAIN;
    c.fill();
    ink(c, 2.5);
    // side mirror
    c.strokeStyle = '#1b1b1b';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(130, -110);
    c.lineTo(142, -122);
    c.stroke();
    c.fillStyle = '#1b1b1b';
    rr(c, 139, -132, 7, 12, 3);
    c.fill();

    // ── canopy: flat black roof sloping down to the front ──
    c.beginPath();
    c.moveTo(-172, -150);
    c.quadraticCurveTo(-172, -192, -134, -192);
    c.lineTo(112, -183);
    c.lineTo(150, -176);
    c.lineTo(148, -171);
    c.lineTo(110, -168);
    c.lineTo(-144, -168);
    c.quadraticCurveTo(-150, -168, -150, -160);
    c.lineTo(-150, -82);
    c.lineTo(-172, -82);
    c.closePath();
    c.fillStyle = vgrad(c, -192, -82, [
        [0, '#2d2b2a'],
        [1, '#161514'],
    ]);
    c.fill();
    ink(c, 3.5);
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-134, -188);
    c.lineTo(110, -179);
    c.stroke();
    // canvas straps at the bottom of the rear canopy
    c.fillStyle = '#3a3634';
    for (const x of [-166, -156]) {
        rr(c, x, -90, 6, 12, 2);
        c.fill();
    }

    // white grab rod (with angled brace) between driver and passenger
    c.strokeStyle = WHITE;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(42, -168);
    c.lineTo(42, -82);
    c.moveTo(42, -150);
    c.lineTo(30, -168);
    c.stroke();
    c.restore();
}

// ─── Wheel ─────────────────────────────────────────────────────────────────

export function drawWheel(c: Ctx): void {
    const cx = 32;
    c.fillStyle = '#1b1b1b';
    c.beginPath();
    c.arc(cx, cx, 24, 0, Math.PI * 2);
    c.fill();
    // tread blocks
    c.fillStyle = '#323232';
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        c.save();
        c.translate(cx + Math.cos(a) * 21.5, cx + Math.sin(a) * 21.5);
        c.rotate(a);
        c.fillRect(-2, -3.5, 4, 7);
        c.restore();
    }
    c.strokeStyle = '#2a2a2a';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cx, 17, 0, Math.PI * 2);
    c.stroke();
    // chrome rim
    const g = c.createRadialGradient(cx - 4, cx - 4, 2, cx, cx, 14);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#c9cfd4');
    g.addColorStop(1, '#808890');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cx, 14, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#59616a';
    c.lineWidth = 1.5;
    c.stroke();
    // bolts
    c.fillStyle = '#4b5258';
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        c.beginPath();
        c.arc(cx + Math.cos(a) * 8, cx + Math.sin(a) * 8, 1.8, 0, Math.PI * 2);
        c.fill();
    }
    c.fillStyle = '#3a4046';
    c.beginPath();
    c.arc(cx, cx, 4, 0, Math.PI * 2);
    c.fill();
    // valve — makes the spin readable
    c.fillStyle = '#e74c3c';
    c.beginPath();
    c.arc(cx + 15.5, cx, 2, 0, Math.PI * 2);
    c.fill();
}

// ─── Street cow (zebu with painted horns and a marigold garland) ────────────

export const COW_TEX = { w: 170, h: 130 };

export function drawZebu(c: Ctx): void {
    const base = 124;
    const body = '#f2ede3';
    const shade = '#d9d1c2';
    // far legs (darker)
    c.fillStyle = shade;
    for (const x of [44, 104]) {
        rr(c, x, base - 44, 10, 42, 4);
        c.fill();
    }
    // tail
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(22, 58);
    c.quadraticCurveTo(10, 80, 14, 98);
    c.stroke();
    c.fillStyle = '#5b4a3c';
    c.beginPath();
    c.ellipse(14, 101, 4, 7, 0, 0, Math.PI * 2);
    c.fill();
    // body
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(70, 66, 50, 26, 0, 0, Math.PI * 2);
    c.fill();
    ink(c, 3.5);
    // hump
    c.beginPath();
    c.ellipse(100, 44, 16, 13, -0.3, Math.PI, Math.PI * 2.1);
    c.fill();
    ink(c, 3.5);
    // near legs
    for (const x of [32, 92]) {
        c.fillStyle = body;
        rr(c, x, base - 46, 12, 44, 5);
        c.fill();
        ink(c, 3);
        c.fillStyle = '#3d332b';
        rr(c, x - 1, base - 8, 14, 8, 3);
        c.fill();
    }
    // neck + dewlap
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(108, 50);
    c.quadraticCurveTo(128, 46, 140, 54);
    c.lineTo(136, 78);
    c.quadraticCurveTo(122, 96, 108, 84);
    c.closePath();
    c.fill();
    ink(c, 3.5);
    // head
    c.save();
    c.translate(146, 60);
    c.rotate(0.45);
    c.fillStyle = body;
    rr(c, -12, -12, 24, 34, 11);
    c.fill();
    ink(c, 3.5);
    c.fillStyle = '#e2b9a6';
    rr(c, -11, 12, 22, 12, 6);
    c.fill();
    ink(c, 2.5);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(5, 18, 1.6, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(4, -2, 2.4, 0, Math.PI * 2);
    c.fill();
    c.restore();
    // horns, painted with blue tips
    c.lineCap = 'round';
    for (const [x0, y0, x1, y1] of [
        [136, 48, 128, 26],
        [144, 46, 142, 24],
    ]) {
        c.strokeStyle = '#e6c9a0';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(x0 - 8, (y0 + y1) / 2, x1, y1);
        c.stroke();
        c.strokeStyle = '#2f7de1';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(x1 + 1, y1 + 4);
        c.lineTo(x1, y1);
        c.stroke();
    }
    // floppy ear
    c.fillStyle = shade;
    c.beginPath();
    c.ellipse(132, 56, 9, 4.5, 0.6, 0, Math.PI * 2);
    c.fill();
    ink(c, 2);
    // marigold garland
    for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = 112 + t * 26;
        const y = 64 + Math.sin(t * Math.PI) * 18;
        c.fillStyle = i % 2 ? '#ff8c1a' : '#ffc928';
        c.beginPath();
        c.arc(x, y, 4.2, 0, Math.PI * 2);
        c.fill();
    }
    // a couple of grey patches
    c.fillStyle = 'rgba(120,110,100,0.25)';
    c.beginPath();
    c.ellipse(52, 60, 14, 9, 0.3, 0, Math.PI * 2);
    c.fill();
}

// ─── Scooter that cuts in (impatient driver's nemesis) ─────────────────────

export const SCOOTER_TEX = { w: 120, h: 110 };

export function drawScooter(c: Ctx): void {
    const base = 104;
    // wheels
    for (const x of [24, 92]) {
        c.fillStyle = '#1b1b1b';
        c.beginPath();
        c.arc(x, base - 12, 12, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#b8bec4';
        c.beginPath();
        c.arc(x, base - 12, 5, 0, Math.PI * 2);
        c.fill();
    }
    // body
    c.beginPath();
    c.moveTo(10, base - 22);
    c.quadraticCurveTo(14, base - 44, 40, base - 44);
    c.lineTo(66, base - 44);
    c.lineTo(84, base - 30);
    c.lineTo(92, base - 58);
    c.lineTo(100, base - 58);
    c.lineTo(104, base - 24);
    c.quadraticCurveTo(60, base - 14, 10, base - 22);
    c.closePath();
    c.fillStyle = '#e8574a';
    c.fill();
    ink(c, 3);
    // seat + handle
    c.fillStyle = '#2b2b2b';
    rr(c, 30, base - 52, 34, 9, 4);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(96, base - 58);
    c.lineTo(90, base - 74);
    c.lineTo(80, base - 74);
    c.stroke();
    c.fillStyle = '#fff3a8';
    c.beginPath();
    c.arc(103, base - 50, 4, 0, Math.PI * 2);
    c.fill();
    // rider
    c.fillStyle = '#3d4450';
    rr(c, 40, base - 72, 22, 26, 8);
    c.fill();
    ink(c, 2.5);
    c.strokeStyle = '#3d4450';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(58, base - 66);
    c.lineTo(80, base - 72);
    c.stroke();
    c.strokeStyle = '#2e3a59';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(50, base - 48);
    c.lineTo(70, base - 46);
    c.lineTo(74, base - 30);
    c.stroke();
    // helmet with visor
    c.fillStyle = '#ffc928';
    c.beginPath();
    c.arc(52, base - 84, 12, 0, Math.PI * 2);
    c.fill();
    ink(c, 2.5);
    c.fillStyle = '#2b2b2b';
    rr(c, 54, base - 88, 10, 7, 3);
    c.fill();
}
