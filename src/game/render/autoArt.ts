/**
 * Canvas2D art for the auto-rickshaw, its wheels and the street cow.
 * Drawn once at boot into textures (see textures.ts). All auto coordinates are
 * in "art space": origin = midpoint between the axles, y up = negative,
 * wheelbase 190, wheel radius 24. The auto faces right.
 */
import type { DriverId } from '../config/drivers';
import { ASSET_WHEELS, CANOPY, DRIVER, DRIVER_SEAT, FASCIA, FRONT_BODY, FRONT_TYRE_FORK, INTERIOR, MIRROR, MUDGUARD, REAR_BODY, UNDERBODY, type AssetPath } from './autoAsset';

type Ctx = CanvasRenderingContext2D;

// ─── Auto body, from the Figma illustration (see autoAsset.ts) ─────────────
// Art space: origin = midpoint between the axles, y down, 1 art unit = 1/S_ASSET
// frame px. The illustration is drawn at its true proportions; the game's
// wheelbase (TUNING.wheelbasePx) is set to match ART_WHEELBASE × 1.3 so the
// characters keep their on-screen size.
const S_ASSET = 0.74;
const MX = (ASSET_WHEELS.rear.x + ASSET_WHEELS.front.x) / 2;
const MY = (ASSET_WHEELS.rear.y + ASSET_WHEELS.front.y) / 2;
/** Frame px → art space. */
const ax = (x: number) => (x - MX) * S_ASSET;
const ay = (y: number) => (y - MY) * S_ASSET;
/** Distance between the axles in art space. */
export const ART_WHEELBASE = (ASSET_WHEELS.front.x - ASSET_WHEELS.rear.x) * S_ASSET;
/** Wheel radius in art space (the illustration's two wheels, averaged). */
export const ART_WHEEL_R = ((ASSET_WHEELS.rear.r + ASSET_WHEELS.front.r) / 2) * S_ASSET;

export const AUTO_TEX = { w: 372, h: 246, ox: 190, oy: 212 };

const INK = '#2b1d14';

/** Where the driver's head sprite sits (art space, head centre). */
export const DRIVER_HEAD_POS = { x: ax(312), y: ay(93) };
/** Night headlamp, brake/tail lamp and exhaust tip (art space). */
export const AUTO_POINTS = {
    headlamp: { x: ax(437.5), y: ay(186.4) },
    tailLamp: { x: ax(55.1), y: ay(222.3) },
    exhaust: { x: ax(52), y: ay(318) },
    /** Where the lime-and-chilli charm hangs from, under the canopy's front edge. */
    charm: { x: ax(378), y: ay(60) },
};

// Layer split (frame px): the canopy band over the doorway is its own "roof"
// layer (the roof-break crops it); the near-side rear quarter, underbody and
// mudguard go in front of the characters; everything else is behind them.
const ROOF_BAND = { x0: 150, x1: 366, y1: 76 };
const REAR_SPLIT_X = 162;

function toAsset(c: Ctx) {
    c.translate(AUTO_TEX.ox, AUTO_TEX.oy);
    c.scale(S_ASSET, S_ASSET);
    c.translate(-MX, -MY);
}
function fillPaths(c: Ctx, paths: AssetPath[]) {
    for (const p of paths) {
        c.fillStyle = p.fill;
        c.fill(new Path2D(p.d));
    }
}
/** Clip to everything except a rect (or a circle, for wheel cut-outs). */
function clipOut(c: Ctx, hole: (p: Path2D) => void) {
    const p = new Path2D();
    p.rect(-100, -100, 800, 600);
    hole(p);
    c.clip(p, 'evenodd');
}

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

// ─── Behind the characters: canopy (minus the roof band), front fascia,
// doorway side of the rear body, front body, driver body, cab interior ───────

export function drawAutoBack(c: Ctx): void {
    c.save();
    toAsset(c);
    const glass = new Path2D(FASCIA[0].d);
    c.save();
    clipOut(c, (p) => p.rect(ROOF_BAND.x0, -100, ROOF_BAND.x1 - ROOF_BAND.x0, ROOF_BAND.y1 + 100));
    // the windshield is glass: cut it out of the canopy so the street shows through
    clipOut(c, (p) => p.addPath(glass));
    fillPaths(c, CANOPY);
    c.restore();
    // light tint + a soft diagonal reflection, then the frame and wiper on top
    c.fillStyle = 'rgba(201,218,212,0.22)';
    c.fill(glass);
    c.save();
    c.clip(glass);
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.beginPath();
    c.moveTo(392, 40);
    c.lineTo(412, 40);
    c.lineTo(372, 140);
    c.lineTo(352, 140);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.beginPath();
    c.moveTo(420, 40);
    c.lineTo(428, 40);
    c.lineTo(388, 140);
    c.lineTo(380, 140);
    c.closePath();
    c.fill();
    c.restore();
    fillPaths(c, FASCIA.slice(1));
    c.save();
    c.beginPath();
    c.rect(REAR_SPLIT_X, -100, 800, 600);
    c.clip();
    fillPaths(c, REAR_BODY);
    c.restore();
    fillPaths(c, FRONT_BODY);
    fillPaths(c, INTERIOR);
    fillPaths(c, MIRROR);
    c.restore();
}

/**
 * Driver body, legs, seat box, backrest and pole: their own layer above the
 * passenger, so the passenger's shins tuck behind the driver's seat and the
 * driver can sway with the ride.
 */
export function drawAutoDriver(c: Ctx): void {
    c.save();
    toAsset(c);
    fillPaths(c, DRIVER);
    fillPaths(c, DRIVER_SEAT);
    c.restore();
}

/** Driver head (unchanged design), drawn into a 44×44 texture. */
/**
 * Driver head textures, authored at 2× (head radius ≈ 29) so they stay crisp
 * on the driver cards; shown at DRIVER_HEAD_SCALE in the auto. Extra room
 * below the chin holds the neck, khaki collar and each driver's accessory.
 */
export const DRIVER_HEAD_TEX = { w: 96, h: 112 };
/** Texture px → art px in the auto (the old 44 px head had radius 14). */
export const DRIVER_HEAD_SCALE = 0.5;
/** Head centre in the texture. */
const HC = { x: 48, y: 52 };
/** Image origin y that keeps the head where the old texture had it (centre 2 art px below the anchor). */
export const DRIVER_HEAD_ORIGIN_Y = (HC.y - 4) / DRIVER_HEAD_TEX.h;
export const driverHeadKey = (id: DriverId) => `driverHead_${id}`;

interface FaceLook {
    skin: string;
    shade: string;
    light: string;
}
const LOOKS: Record<DriverId, FaceLook> = {
    careful: { skin: '#c28b60', shade: '#9b6743', light: '#d9a77c' },
    impatient: { skin: '#9c6440', shade: '#774829', light: '#b77d53' },
    overconfident: { skin: '#ab7049', shade: '#875333', light: '#c78d61' },
};

/**
 * The three drivers share the khaki uniform but are distinct characters
 * (3/4 view, facing right):
 *  - careful        Pothole Pandey: older, bald with fluffy grey sides, bushy brows,
 *                   wire glasses, white walrus moustache, kind smile, checked gamcha
 *  - impatient      Turbo Tiwari: spiky hair under a red sweatband, furrowed brows,
 *                   narrowed eyes, gritted teeth, stubble, sweat drops
 *  - overconfident  Bumper Babu: tall glossy pompadour, sideburns, gold aviators,
 *                   one cocked eyebrow, curled handlebar moustache, smirk, gold chain
 */
export function drawDriverHead(c: Ctx, look: DriverId = 'careful'): void {
    const L = LOOKS[look];
    const { x: cx, y: cy } = HC;
    const dot = (x: number, y: number, r: number) => {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
    };
    const line = (w: number, col: string, pts: number[][]) => {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
    };
    const facePath = () => {
        c.beginPath();
        c.moveTo(cx - 4, cy - 30);
        c.bezierCurveTo(cx + 14, cy - 31, cx + 26, cy - 20, cx + 27, cy - 4);
        c.bezierCurveTo(cx + 28, cy + 8, cx + 25, cy + 18, cx + 18, cy + 25);
        c.bezierCurveTo(cx + 12, cy + 31, cx - 2, cy + 32, cx - 12, cy + 26);
        c.bezierCurveTo(cx - 24, cy + 18, cx - 28, cy + 4, cx - 27, cy - 8);
        c.bezierCurveTo(cx - 26, cy - 22, cx - 18, cy - 30, cx - 4, cy - 30);
        c.closePath();
    };

    // ── neck + khaki collar ──
    c.fillStyle = L.shade;
    rr(c, cx - 9, cy + 18, 20, 30, 6);
    c.fill();
    ink(c, 3);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(cx - 7, cy + 24, 16, 6);
    c.fillStyle = '#b9a36b';
    for (const dir of [-1, 1]) {
        c.beginPath();
        c.moveTo(cx + 1, cy + 50);
        c.lineTo(cx + 1 + dir * 22, cy + 40);
        c.lineTo(cx + 1 + dir * 14, cy + 58);
        c.closePath();
        c.fill();
        ink(c, 3);
    }

    // ── hair behind the head ──
    if (look === 'careful') {
        c.fillStyle = '#dcd7cf';
        for (const [x, y, r] of [[-20, -18, 8], [-25, -9, 8.5], [-26, 1, 8], [-22, 10, 7], [-14, -23, 6.5]]) {
            dot(cx + x, cy + y, r);
            ink(c, 2.5);
        }
    } else if (look === 'impatient') {
        // sweatband tails flapping behind
        c.fillStyle = '#e23b3b';
        for (const [a, b] of [[-14, -2], [-6, 6]]) {
            c.beginPath();
            c.moveTo(cx - 24, cy - 12 + a / 4);
            c.quadraticCurveTo(cx - 34, cy - 18 + a, cx - 44, cy - 14 + a);
            c.lineTo(cx - 40, cy - 6 + b);
            c.quadraticCurveTo(cx - 32, cy - 8 + b / 2, cx - 24, cy - 6 + b / 4);
            c.closePath();
            c.fill();
            ink(c, 2.5);
        }
    }

    // ── face with soft side lighting ──
    facePath();
    const fg = c.createLinearGradient(cx - 28, 0, cx + 28, 0);
    fg.addColorStop(0, L.shade);
    fg.addColorStop(0.45, L.skin);
    fg.addColorStop(1, L.light);
    c.fillStyle = fg;
    c.fill();
    ink(c, 4.5);
    // jaw shadow + cheek
    c.save();
    facePath();
    c.clip();
    c.fillStyle = 'rgba(0,0,0,0.10)';
    c.beginPath();
    c.ellipse(cx - 8, cy + 22, 22, 10, 0.2, 0, Math.PI * 2);
    c.fill();
    if (look === 'impatient') {
        // stubble
        c.fillStyle = 'rgba(30,20,14,0.28)';
        c.beginPath();
        c.moveTo(cx - 6, cy + 6);
        c.quadraticCurveTo(cx + 10, cy + 2, cx + 28, cy + 8);
        c.lineTo(cx + 28, cy + 34);
        c.lineTo(cx - 14, cy + 34);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(20,12,8,0.5)';
        for (let i = 0; i < 26; i++) dot(cx - 4 + ((i * 37) % 30), cy + 12 + ((i * 23) % 17), 0.7);
    }
    c.fillStyle = look === 'impatient' ? 'rgba(220,70,50,0.25)' : 'rgba(230,110,90,0.22)';
    dot(cx + 14, cy + 9, 5);
    c.restore();

    // ── top hair ──
    if (look === 'careful') {
        // bald crown shine + a few combed-over strands
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath();
        c.ellipse(cx + 4, cy - 22, 10, 4, -0.2, 0, Math.PI * 2);
        c.fill();
        line(1.6, '#cfc9c0', [[cx - 16, cy - 22], [cx - 4, cy - 27], [cx + 8, cy - 27]]);
        line(1.6, '#cfc9c0', [[cx - 18, cy - 18], [cx - 6, cy - 24], [cx + 4, cy - 25]]);
        // forehead wrinkles
        line(1.6, L.shade, [[cx + 6, cy - 17], [cx + 13, cy - 18], [cx + 20, cy - 16]]);
        line(1.6, L.shade, [[cx + 8, cy - 13], [cx + 15, cy - 14], [cx + 21, cy - 12]]);
    } else if (look === 'impatient') {
        c.fillStyle = '#1b1411';
        c.beginPath();
        c.moveTo(cx - 27, cy - 4);
        const spikes = [[-28, -24], [-20, -40], [-12, -28], [-6, -44], [2, -30], [8, -45], [14, -30], [21, -40], [24, -22]];
        c.lineTo(cx - 30, cy - 14);
        for (const [x, y] of spikes) c.lineTo(cx + x, cy + y);
        c.lineTo(cx + 26, cy - 12);
        c.quadraticCurveTo(cx, cy - 20, cx - 24, cy - 2);
        c.closePath();
        c.fill();
        ink(c, 2.5);
        // sweatband wrapped round the forehead
        c.save();
        facePath();
        c.clip();
        c.fillStyle = '#e23b3b';
        c.beginPath();
        c.moveTo(cx - 30, cy - 8);
        c.quadraticCurveTo(cx, cy - 26, cx + 30, cy - 16);
        c.lineTo(cx + 30, cy - 7);
        c.quadraticCurveTo(cx, cy - 17, cx - 30, cy + 2);
        c.closePath();
        c.fill();
        line(1.6, 'rgba(255,255,255,0.75)', [[cx - 26, cy - 3], [cx, cy - 17], [cx + 28, cy - 11]]);
        c.restore();
        line(2.5, '#2b1d14', [[cx - 27, cy - 8], [cx, cy - 25], [cx + 27, cy - 16]]);
    } else {
        // tall glossy pompadour swept up and forward
        c.beginPath();
        c.moveTo(cx - 27, cy - 2);
        c.bezierCurveTo(cx - 32, cy - 30, cx - 18, cy - 50, cx + 6, cy - 50);
        c.bezierCurveTo(cx + 24, cy - 50, cx + 34, cy - 38, cx + 30, cy - 22);
        c.bezierCurveTo(cx + 22, cy - 26, cx + 14, cy - 22, cx + 10, cy - 16);
        c.bezierCurveTo(cx - 2, cy - 22, cx - 14, cy - 16, cx - 16, cy - 2);
        c.closePath();
        const hg = c.createLinearGradient(0, cy - 50, 0, cy);
        hg.addColorStop(0, '#3a2a20');
        hg.addColorStop(1, '#0f0b09');
        c.fillStyle = hg;
        c.fill();
        ink(c, 3);
        line(2.2, 'rgba(255,255,255,0.6)', [[cx - 14, cy - 30], [cx - 4, cy - 43], [cx + 12, cy - 45]]);
        line(1.6, 'rgba(255,255,255,0.35)', [[cx - 18, cy - 20], [cx - 10, cy - 34], [cx + 4, cy - 38]]);
        // sideburn
        c.fillStyle = '#120d0a';
        c.beginPath();
        c.moveTo(cx - 16, cy - 4);
        c.lineTo(cx - 8, cy - 4);
        c.lineTo(cx - 6, cy + 10);
        c.lineTo(cx - 12, cy + 12);
        c.closePath();
        c.fill();
    }

    // ── ear ──
    c.fillStyle = L.skin;
    c.beginPath();
    c.ellipse(cx - 14, cy + 3, 6.5, 9, 0.1, 0, Math.PI * 2);
    c.fill();
    ink(c, 3);
    line(2, L.shade, [[cx - 12, cy - 2], [cx - 16, cy + 2], [cx - 12, cy + 7]]);

    // ── eyes ──
    const eye = (x: number, y: number, rx: number, ry: number) => {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
        ink(c, 1.8);
        c.fillStyle = '#2a1a12';
        dot(x + rx * 0.3, y + 0.3, Math.min(ry, 2.8));
        c.fillStyle = '#ffffff';
        dot(x + rx * 0.3 + 0.9, y - 0.8, 0.9);
    };
    if (look !== 'overconfident') {
        const ry = look === 'impatient' ? 2.6 : 3.8;
        eye(cx + 8, cy - 2, 5, ry);
        eye(cx + 21, cy - 2, 3.6, ry * 0.95);
        if (look === 'impatient') {
            // heavy lids for the narrowed glare
            line(2.2, '#2b1d14', [[cx + 3, cy - 4.5], [cx + 13, cy - 3.5]]);
            line(2.2, '#2b1d14', [[cx + 17.5, cy - 3.5], [cx + 24.5, cy - 4.5]]);
        }
    }

    // ── nose ──
    c.fillStyle = L.light;
    c.beginPath();
    c.moveTo(cx + 24, cy - 3);
    c.quadraticCurveTo(cx + 34, cy + 6, cx + 27, cy + 9);
    c.quadraticCurveTo(cx + 24, cy + 9, cx + 23, cy + 7);
    c.closePath();
    c.fill();
    line(2.6, '#2b1d14', [[cx + 25, cy - 2], [cx + 32, cy + 5], [cx + 27, cy + 9], [cx + 23, cy + 8]]);

    // ── per-character brows, eyewear, mouth ──
    if (look === 'careful') {
        // bushy grey brows
        line(4.5, '#2b1d14', [[cx + 2, cy - 9], [cx + 13, cy - 10.5]]);
        line(3, '#ebe7e0', [[cx + 2, cy - 9], [cx + 13, cy - 10.5]]);
        line(4, '#2b1d14', [[cx + 18, cy - 10.5], [cx + 24, cy - 9.5]]);
        line(2.6, '#ebe7e0', [[cx + 18, cy - 10.5], [cx + 24, cy - 9.5]]);
        // crow's feet
        line(1.3, L.shade, [[cx + 14, cy + 1], [cx + 16, cy + 3]]);
        // round wire glasses
        c.strokeStyle = '#6b5440';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx + 8, cy - 2, 7, 0, Math.PI * 2);
        c.moveTo(cx + 25.5, cy - 2);
        c.arc(cx + 21, cy - 2, 4.5, 0, Math.PI * 2);
        c.stroke();
        line(2, '#6b5440', [[cx + 15, cy - 3], [cx + 16.5, cy - 3]]);
        line(2, '#6b5440', [[cx + 1, cy - 3], [cx - 10, cy - 1]]);
        c.fillStyle = 'rgba(255,255,255,0.25)';
        dot(cx + 6, cy - 5, 2);
        // kind smile under a white walrus moustache
        line(2.2, '#2b1d14', [[cx + 14, cy + 18], [cx + 19, cy + 20], [cx + 24, cy + 17]]);
        c.fillStyle = '#f1ede6';
        c.beginPath();
        c.moveTo(cx + 9, cy + 14);
        c.quadraticCurveTo(cx + 12, cy + 9, cx + 20, cy + 10);
        c.quadraticCurveTo(cx + 30, cy + 9, cx + 33, cy + 14);
        c.quadraticCurveTo(cx + 31, cy + 18, cx + 27, cy + 15);
        c.quadraticCurveTo(cx + 22, cy + 18, cx + 18, cy + 15);
        c.quadraticCurveTo(cx + 13, cy + 18, cx + 9, cy + 14);
        c.closePath();
        c.fill();
        ink(c, 2);
        // checked gamcha slung round the neck
        c.fillStyle = '#c0392b';
        c.beginPath();
        c.moveTo(cx - 16, cy + 30);
        c.quadraticCurveTo(cx + 1, cy + 40, cx + 18, cy + 30);
        c.lineTo(cx + 20, cy + 39);
        c.quadraticCurveTo(cx + 1, cy + 50, cx - 18, cy + 39);
        c.closePath();
        c.fill();
        ink(c, 2.5);
        c.fillStyle = 'rgba(255,240,220,0.85)';
        for (let i = 0; i < 6; i++) c.fillRect(cx - 14 + i * 6, cy + 33 + Math.abs(i - 2.5) * -0.6, 2, 9);
        c.fillStyle = '#c0392b';
        c.beginPath();
        c.moveTo(cx + 12, cy + 38);
        c.lineTo(cx + 20, cy + 38);
        c.lineTo(cx + 22, cy + 56);
        c.lineTo(cx + 13, cy + 56);
        c.closePath();
        c.fill();
        ink(c, 2.5);
        c.fillStyle = 'rgba(255,240,220,0.85)';
        c.fillRect(cx + 15, cy + 40, 2, 15);
    } else if (look === 'impatient') {
        // furrowed brows pulled down towards the nose
        line(4.5, '#1b1411', [[cx + 1, cy - 12], [cx + 13, cy - 7]]);
        line(4, '#1b1411', [[cx + 18, cy - 7], [cx + 25, cy - 10]]);
        line(1.6, L.shade, [[cx + 15, cy - 12], [cx + 16, cy - 8]]);
        // gritted teeth
        c.fillStyle = '#ffffff';
        rr(c, cx + 12, cy + 14, 13, 7, 3);
        c.fill();
        ink(c, 2.2);
        line(1.3, '#2b1d14', [[cx + 12.5, cy + 17.5], [cx + 24.5, cy + 17.5]]);
        for (const x of [16, 19.5, 23]) line(1.2, '#2b1d14', [[cx + x, cy + 14.5], [cx + x, cy + 20.5]]);
        // sweat drops
        c.fillStyle = '#6cc7ff';
        for (const [x, y, k] of [[-4, -8, 1], [30, -16, 0.75]]) {
            c.beginPath();
            c.moveTo(cx + x, cy + y - 7 * k);
            c.quadraticCurveTo(cx + x - 4 * k, cy + y + 1, cx + x, cy + y + 2 * k);
            c.quadraticCurveTo(cx + x + 4 * k, cy + y + 1, cx + x, cy + y - 7 * k);
            c.fill();
            ink(c, 1.4);
        }
    } else {
        // one eyebrow cocked above the shades
        line(4.5, '#120d0a', [[cx + 1, cy - 11], [cx + 7, cy - 15], [cx + 14, cy - 13]]);
        line(4, '#120d0a', [[cx + 18, cy - 11], [cx + 24, cy - 10]]);
        // gold aviators
        const lens = (x: number, w: number) => {
            c.beginPath();
            c.moveTo(x - w, cy - 7);
            c.lineTo(x + w, cy - 7);
            c.quadraticCurveTo(x + w + 1, cy + 4, x + w * 0.2, cy + 5);
            c.quadraticCurveTo(x - w - 1, cy + 4, x - w, cy - 7);
            c.closePath();
            const lg = c.createLinearGradient(0, cy - 7, 0, cy + 5);
            lg.addColorStop(0, '#41557a');
            lg.addColorStop(1, '#0d111b');
            c.fillStyle = lg;
            c.fill();
            c.strokeStyle = '#d9a520';
            c.lineWidth = 2;
            c.stroke();
        };
        lens(cx + 8, 7);
        lens(cx + 22, 4.5);
        line(2, '#d9a520', [[cx + 15, cy - 6], [cx + 17.5, cy - 6]]);
        line(2, '#d9a520', [[cx + 1, cy - 6], [cx - 10, cy - 2]]);
        line(1.8, 'rgba(255,255,255,0.85)', [[cx + 4, cy - 4], [cx + 8, cy - 1]]);
        line(1.4, 'rgba(255,255,255,0.7)', [[cx + 20, cy - 4], [cx + 22, cy - 2]]);
        // smirk
        line(2.2, '#2b1d14', [[cx + 13, cy + 20], [cx + 19, cy + 21], [cx + 25, cy + 17]]);
        // thick handlebar moustache with curled tips
        c.fillStyle = '#120d0a';
        c.beginPath();
        c.moveTo(cx + 10, cy + 15);
        c.quadraticCurveTo(cx + 18, cy + 9, cx + 22, cy + 11);
        c.quadraticCurveTo(cx + 27, cy + 9, cx + 33, cy + 14);
        c.quadraticCurveTo(cx + 37, cy + 12, cx + 36, cy + 7);
        c.quadraticCurveTo(cx + 40, cy + 13, cx + 33, cy + 17);
        c.quadraticCurveTo(cx + 27, cy + 15, cx + 22, cy + 15);
        c.quadraticCurveTo(cx + 15, cy + 16, cx + 9, cy + 19);
        c.quadraticCurveTo(cx + 4, cy + 18, cx + 6, cy + 13);
        c.quadraticCurveTo(cx + 7, cy + 16, cx + 10, cy + 15);
        c.closePath();
        c.fill();
        // open collar + gold chain with a pendant
        c.fillStyle = L.skin;
        c.beginPath();
        c.moveTo(cx - 6, cy + 40);
        c.lineTo(cx + 8, cy + 40);
        c.lineTo(cx + 1, cy + 52);
        c.closePath();
        c.fill();
        c.fillStyle = '#f2c230';
        for (let i = 0; i <= 10; i++) {
            const a = Math.PI * (0.12 + 0.76 * (i / 10));
            const x = cx + 1 + Math.cos(a) * 14;
            const y = cy + 32 + Math.sin(a) * 12;
            dot(x, y, 2);
        }
        c.beginPath();
        c.moveTo(cx + 1, cy + 43);
        c.lineTo(cx + 5, cy + 49);
        c.lineTo(cx + 1, cy + 55);
        c.lineTo(cx - 3, cy + 49);
        c.closePath();
        c.fill();
        ink(c, 1.8);
    }
}

// ─── In front of the characters: near-side rear quarter, underbody, front
// mudguard. The illustration's own tyres are cut out so the game's spinning
// wheels (drawn behind the body) show through. ────────────────────────────

export function drawAutoFront(c: Ctx): void {
    c.save();
    toAsset(c);
    const W = ASSET_WHEELS;
    c.save();
    c.beginPath();
    c.rect(-100, -100, REAR_SPLIT_X + 100, 600);
    c.clip();
    // the rear bodywork runs under where the illustration drew its wheel
    clipOut(c, (p) => p.arc(W.rear.x, W.rear.y, W.rear.r + 0.5, 0, Math.PI * 2));
    fillPaths(c, REAR_BODY);
    c.restore();
    c.save();
    clipOut(c, (p) => p.arc(W.rear.x, W.rear.y, W.rear.r + 0.5, 0, Math.PI * 2));
    fillPaths(c, UNDERBODY);
    c.restore();
    c.save();
    clipOut(c, (p) => p.arc(W.front.x, W.front.y, W.front.r + 0.5, 0, Math.PI * 2));
    fillPaths(c, FRONT_TYRE_FORK);
    c.restore();
    // fork leg from the hub up into the mudguard, in front of the wheel
    c.strokeStyle = '#3F4044';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(W.front.x, W.front.y);
    c.lineTo(W.front.x + 12, W.front.y - 40);
    c.stroke();
    c.fillStyle = '#323234';
    c.beginPath();
    c.arc(W.front.x, W.front.y, 4, 0, Math.PI * 2);
    c.fill();
    fillPaths(c, MUDGUARD);
    c.restore();
}

export function drawAutoRoof(c: Ctx): void {
    c.save();
    toAsset(c);
    c.beginPath();
    c.rect(ROOF_BAND.x0, -100, ROOF_BAND.x1 - ROOF_BAND.x0, ROOF_BAND.y1 + 100);
    c.clip();
    fillPaths(c, CANOPY);
    c.restore();
}

/** Canopy top edge sampled from the illustration (frame x → frame y). */
const CANOPY_TOP: [number, number][] = [
    [150, 31.5], [170, 30], [190, 28], [210, 26.5], [230, 25.5], [250, 24.5], [270, 24],
    [300, 24], [320, 25], [340, 26], [360, 27],
];

/** Canopy geometry (art space) used by the roof-break effect. */
export const ROOF = {
    /** Top / underside of the canopy band above the passenger. */
    top: ay(24),
    bottom: ay(60),
    /** Canopy top edge (art y) at art x. */
    topAt(x: number): number {
        const fx = x / S_ASSET + MX;
        const T = CANOPY_TOP;
        if (fx <= T[0][0]) return ay(T[0][1]);
        for (let i = 1; i < T.length; i++) {
            if (fx <= T[i][0]) {
                const [x0, y0] = T[i - 1];
                const [x1, y1] = T[i];
                return ay(y0 + ((y1 - y0) * (fx - x0)) / (x1 - x0));
            }
        }
        return ay(T[T.length - 1][1]);
    },
    fill: 0xfec31f,
    highlight: 0xffe07a,
};

// ─── Wheel ─────────────────────────────────────────────────────────────────

export function drawWheel(c: Ctx): void {
    drawWheelBase(c, false);
}

/** Same wheel with the hub features smeared into rings — crossfaded in at speed. */
export function drawWheelBlur(c: Ctx): void {
    drawWheelBase(c, true);
}

/**
 * Fat auto-rickshaw tyre on a small steel rim with a light hub (8-inch wheel
 * look), drawn for radius 24 at the centre of a 64×64 texture.
 */
function drawWheelBase(c: Ctx, blur: boolean): void {
    // Styled after the illustration (dark tyre, light-grey rim, darker ring,
    // small hub) with high-contrast features so the spin reads: five dark
    // cut-outs in the rim, bolts, a red valve cap and tread notches. The blur
    // twin swaps those for curved light streaks.
    const cx = 32;
    const circle = (r: number) => {
        c.beginPath();
        c.arc(cx, cx, r, 0, Math.PI * 2);
    };
    circle(25);
    c.fillStyle = '#3A3C40';
    c.fill();
    if (!blur) {
        c.fillStyle = '#25272a';
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            c.save();
            c.translate(cx + Math.cos(a) * 23.2, cx + Math.sin(a) * 23.2);
            c.rotate(a);
            c.fillRect(-1.6, -2.8, 3.2, 5.6);
            c.restore();
        }
    }
    circle(19.5);
    c.fillStyle = '#ADACA6';
    c.fill();
    circle(15.5);
    c.fillStyle = '#8B8B87';
    c.fill();
    if (!blur) {
        // rim cut-outs
        c.fillStyle = '#3a3b3d';
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            c.beginPath();
            c.ellipse(cx + Math.cos(a) * 12.6, cx + Math.sin(a) * 12.6, 3.4, 2.2, a + Math.PI / 2, 0, Math.PI * 2);
            c.fill();
        }
    }
    circle(9);
    c.fillStyle = '#c9c8c2';
    c.fill();
    if (!blur) {
        c.fillStyle = '#5d5d59';
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
            c.beginPath();
            c.arc(cx + Math.cos(a) * 5.6, cx + Math.sin(a) * 5.6, 1.3, 0, Math.PI * 2);
            c.fill();
        }
        // valve cap + a white tyre mark
        c.fillStyle = '#e74c3c';
        c.beginPath();
        c.arc(cx + 17.5, cx, 1.8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.save();
        c.translate(cx, cx);
        c.rotate(Math.PI * 1.15);
        c.fillRect(20.5, -3, 2, 6);
        c.restore();
    } else {
        // motion streaks: curved light arcs at a few radii
        c.lineCap = 'round';
        for (const [r, a0, len, w, col] of [
            [22.5, 0.2, 1.7, 2.2, 'rgba(120,122,126,0.65)'],
            [22.5, 3.4, 1.4, 2.2, 'rgba(120,122,126,0.55)'],
            [17.5, 1.1, 1.9, 2.6, 'rgba(230,230,224,0.75)'],
            [17.5, 4.3, 1.5, 2.6, 'rgba(230,230,224,0.6)'],
            [12.5, 2.3, 2.2, 3, 'rgba(60,61,63,0.55)'],
            [12.5, 5.4, 1.6, 3, 'rgba(60,61,63,0.45)'],
        ] as const) {
            c.strokeStyle = col;
            c.lineWidth = w;
            c.beginPath();
            c.arc(cx, cx, r, a0, a0 + len);
            c.stroke();
        }
    }
    c.fillStyle = '#3F4044';
    circle(3.2);
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
