import { headline, stars, verdict, computeScore, type RideResult } from '../core/scoring';
import { PALETTE as P } from '../render/palette';

const W = 1200;
const H = 630;

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = filled ? P.yellowCss : 'rgba(255,255,255,0.18)';
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = P.inkCss;
    c.stroke();
}

/** 1200×630 result card — the size WhatsApp/Twitter/LinkedIn previews like. */
export function drawResultCard(r: RideResult, autoImage?: CanvasImageSource): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d')!;
    const won = r.outcome === 'won';

    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, won ? '#ffcf5a' : '#ff9a6b');
    g.addColorStop(1, won ? '#ff8f3d' : '#e8574a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // road strip
    c.fillStyle = P.asphaltCss;
    c.fillRect(0, H - 120, W, 120);
    c.fillStyle = '#f4f1e6';
    for (let x = 20; x < W; x += 120) c.fillRect(x, H - 64, 60, 8);
    if (autoImage) c.drawImage(autoImage, 40, H - 120 - 250, 330, 250);

    c.textBaseline = 'alphabetic';
    c.fillStyle = P.inkCss;
    c.font = '900 44px "Baloo 2", system-ui, sans-serif';
    c.fillText('JUST ONE SIP 🛺', 400, 84);

    c.font = '900 64px "Baloo 2", system-ui, sans-serif';
    c.fillStyle = '#fff';
    c.lineWidth = 10;
    c.strokeStyle = P.inkCss;
    c.lineJoin = 'round';
    c.strokeText(headline(r), 400, 162);
    c.fillText(headline(r), 400, 162);

    roundRect(c, 400, 190, 760, 200, 26);
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = P.inkCss;
    c.stroke();

    c.fillStyle = P.waterDeepCss;
    c.font = '900 80px "Baloo 2", system-ui, sans-serif';
    c.fillText(`${Math.round(r.consumedMl)}`, 430, 290);
    const w1 = c.measureText(`${Math.round(r.consumedMl)}`).width;
    c.fillStyle = P.inkCss;
    c.font = '800 34px "Baloo 2", system-ui, sans-serif';
    c.fillText(`/ ${r.capacityMl} ml drunk`, 440 + w1, 288);
    c.font = '700 30px "Baloo 2", system-ui, sans-serif';
    c.fillStyle = '#c0392b';
    c.fillText(`💦 ${Math.round(r.spilledMl)} ml spilled`, 432, 338);
    c.fillStyle = P.inkCss;
    c.fillText(`🏁 ${Math.round(r.distanceM)} m   ⭐ ${computeScore(r)} pts`, 432, 374);

    const s = stars(r);
    for (let i = 0; i < 3; i++) star(c, 1010 + i * 52, 250, 22, i < s);

    c.font = 'italic 800 34px "Baloo 2", system-ui, sans-serif';
    c.fillStyle = P.inkCss;
    const v = `“${verdict(r)}”`;
    c.fillText(v.length > 48 ? v.slice(0, 47) + '…”' : v, 400, 440);

    c.font = '800 26px "Baloo 2", system-ui, sans-serif';
    c.fillStyle = '#fff';
    c.fillText('Can you finish one bottle on Indian roads?', 400, H - 140 + 0);
    return cv;
}

export function shareText(r: RideResult, url: string): string {
    const won = r.outcome === 'won';
    const ml = Math.round(r.consumedMl);
    return won
        ? `I finished my water bottle in a bumpy auto ride on Indian roads 🛺💧 (${ml}/${r.capacityMl} ml, ${Math.round(r.spilledMl)} ml spilled). "${verdict(r)}" Can you? ${url}`
        : `I only drank ${ml}/${r.capacityMl} ml in a bumpy auto ride on Indian roads 🛺💦 "${verdict(r)}" Try Just One Sip: ${url}`;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'failed' | 'cancelled';

/**
 * Share via the native share sheet (image + text, ideal for WhatsApp on mobile).
 * Falls back to downloading the PNG and copying the text.
 */
export async function shareResult(r: RideResult, autoImage?: CanvasImageSource): Promise<ShareOutcome> {
    const url = location.origin + location.pathname;
    const text = shareText(r, url);
    const canvas = drawResultCard(r, autoImage);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    try {
        if (blob && navigator.canShare) {
            const file = new File([blob], 'just-one-sip.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], text, title: 'Just One Sip' });
                return 'shared';
            }
        }
        if (navigator.share) {
            await navigator.share({ text, url, title: 'Just One Sip' });
            return 'shared';
        }
    } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
    try {
        if (blob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'just-one-sip.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }
        await navigator.clipboard?.writeText(text);
        return blob ? 'downloaded' : 'copied';
    } catch {
        return blob ? 'downloaded' : 'failed';
    }
}
