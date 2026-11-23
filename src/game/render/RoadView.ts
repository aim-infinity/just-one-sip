import Phaser from 'phaser';
import type { Road } from '../core/road';
import type { RideSimulation } from '../core/simulation';
import { createHazardView, type HazardView } from './hazardArt';
import { FONT, PALETTE as P } from './palette';
import { RS } from './resolution';
import { TEX_SCALE } from './textures';

/** Road surface, hazards (created as they come into view) and the destination sign. */
export class RoadView {
    private surface: Phaser.GameObjects.TileSprite;
    private views = new Map<number, HazardView>();
    private finish?: Phaser.GameObjects.Container;
    private finishX = Infinity;

    constructor(
        private scene: Phaser.Scene,
        private road: Road,
        private width: number,
    ) {
        this.surface = scene.add.tileSprite(0, 500, width, 220, 'road').setOrigin(0).setDepth(5).setTileScale(TEX_SCALE);
    }

    setFinish(worldX: number): void {
        this.finishX = worldX;
        const s = this.scene;
        const c = s.add.container(0, 0).setDepth(4);
        const post = s.add.rectangle(0, 506, 8, 130, 0x56606b).setOrigin(0.5, 1);
        const board = s.add.rectangle(0, 376, 170, 64, 0x1f9d55).setStrokeStyle(4, P.ink);
        const label = s.add
            .text(0, 376, 'YOUR STOP\n📍 Destination', { fontFamily: FONT, fontSize: '19px', color: '#fff', align: 'center', fontStyle: '800' })
            .setOrigin(0.5)
            .setLineSpacing(-6);
        const chk = s.add.graphics();
        for (let i = 0; i < 6; i++) {
            chk.fillStyle(i % 2 ? 0x111111 : 0xffffff, 1);
            chk.fillRect(-8, 530 + i * 14, 16, 14);
        }
        c.add([chk, post, board, label]);
        this.finish = c;
    }

    update(camX: number, sim: RideSimulation, time: number): void {
        this.surface.tilePositionX = camX * RS;
        const left = camX - 260;
        const right = camX + this.width + 260;
        for (const h of this.road.hazards) {
            const visible = h.x + h.width > left && h.x < right;
            let v = this.views.get(h.id);
            if (visible && !v) {
                v = createHazardView(this.scene, h);
                v.root.setDepth(6);
                this.views.set(h.id, v);
            } else if (!visible && v) {
                v.root.destroy();
                this.views.delete(h.id);
                v = undefined;
            }
            if (v) {
                v.root.x = Math.round(h.x - camX);
                v.update?.(sim, time);
            }
            if (h.x > right) break;
        }
        if (this.finish) this.finish.x = this.finishX - camX;
    }
}
