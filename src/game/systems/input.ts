import Phaser from 'phaser';

/**
 * One-finger hold input.
 *  - Only the first pointer that goes down "owns" the hold (multi-touch safe).
 *  - Release on pointerup, pointerupoutside, pointercancel, touchcancel,
 *    window blur, tab hide and when the game is paused.
 *  - Presses that start on an interactive UI object (buttons) are ignored.
 *  - Space / Up arrow also hold, for desktop players.
 */
export class HoldInput {
    private pointerId: number | null = null;
    private keyHeld = false;
    enabled = true;
    /** Fires once each time a hold starts (used to unlock audio, hide hints). */
    onPress?: () => void;

    private readonly cleanup: (() => void)[] = [];

    constructor(scene: Phaser.Scene) {
        const input = scene.input;

        const down = (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
            if (!this.enabled || over.length > 0) return;
            if (this.pointerId !== null) return; // second finger — ignore
            this.pointerId = p.id;
            this.onPress?.();
        };
        const up = (p: Phaser.Input.Pointer) => {
            if (p.id === this.pointerId) this.pointerId = null;
        };
        input.on('pointerdown', down);
        input.on('pointerup', up);
        input.on('pointerupoutside', up);
        this.cleanup.push(() => {
            input.off('pointerdown', down);
            input.off('pointerup', up);
            input.off('pointerupoutside', up);
        });

        const cancel = () => this.release();
        const canvas = scene.game.canvas;
        canvas.addEventListener('pointercancel', cancel);
        canvas.addEventListener('touchcancel', cancel);
        window.addEventListener('blur', cancel);
        document.addEventListener('visibilitychange', cancel);
        this.cleanup.push(() => {
            canvas.removeEventListener('pointercancel', cancel);
            canvas.removeEventListener('touchcancel', cancel);
            window.removeEventListener('blur', cancel);
            document.removeEventListener('visibilitychange', cancel);
        });

        const kb = scene.input.keyboard;
        if (kb) {
            const kdown = (e: KeyboardEvent) => {
                if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat && this.enabled) {
                    this.keyHeld = true;
                    this.onPress?.();
                }
            };
            const kup = (e: KeyboardEvent) => {
                if (e.code === 'Space' || e.code === 'ArrowUp') this.keyHeld = false;
            };
            kb.on('keydown', kdown);
            kb.on('keyup', kup);
            this.cleanup.push(() => {
                kb.off('keydown', kdown);
                kb.off('keyup', kup);
            });
        }

        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    }

    get holding(): boolean {
        return this.enabled && (this.pointerId !== null || this.keyHeld);
    }

    release(): void {
        this.pointerId = null;
        this.keyHeld = false;
    }

    destroy(): void {
        this.cleanup.forEach((f) => f());
        this.cleanup.length = 0;
    }
}
