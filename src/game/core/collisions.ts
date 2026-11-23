import type { Hazard, Road } from './road';

export type Wheel = 'front' | 'rear';

export interface ContactEvent {
    kind: 'contact';
    wheel: Wheel;
    hazard: Hazard;
}

export interface KickEvent {
    kind: 'kick';
    wheel: Wheel;
    hazard: Hazard;
    /** Signed relative strength (kick.v × impact). */
    strength: number;
}

export type CollisionEvent = ContactEvent | KickEvent;

/**
 * Detects wheel/hazard interactions in *world space*: an event fires when a
 * wheel's world x crosses a hazard's leading edge or one of its kick points
 * during a step. Independent of the camera/viewport entirely.
 */
export class CollisionTracker {
    private prev: Record<Wheel, number>;

    constructor(
        private road: Road,
        rearX: number,
        frontX: number,
    ) {
        this.prev = { rear: rearX, front: frontX };
    }

    advance(wheel: Wheel, x: number, out: CollisionEvent[]): void {
        const from = this.prev[wheel];
        this.prev[wheel] = x;
        if (x <= from) return;
        for (const h of this.road.hazards) {
            if (h.x > x) break;
            if (h.x + h.width < from) continue;
            if (h.x > from && h.x <= x) out.push({ kind: 'contact', wheel, hazard: h });
            for (const k of h.kicks) {
                const kx = h.x + k.u * h.width;
                if (kx > from && kx <= x) out.push({ kind: 'kick', wheel, hazard: h, strength: k.v * h.impact });
            }
        }
    }
}
