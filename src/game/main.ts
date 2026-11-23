import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Home } from './scenes/Home';
import { Play } from './scenes/Play';
import { Results } from './scenes/Results';
import { DESIGN_HEIGHT } from './render/palette';

/**
 * Design height is fixed at 720. Width adapts to the device's landscape aspect
 * (16:9 up to ~19.5:9) so modern phones fill the screen without letterboxing.
 */
export function designWidth(): number {
    const w = Math.max(window.innerWidth, window.innerHeight);
    const h = Math.min(window.innerWidth, window.innerHeight);
    const aspect = w / Math.max(1, h);
    return Math.round(Math.min(1560, Math.max(1280, DESIGN_HEIGHT * aspect)));
}

export default function StartGame(parent: string): Phaser.Game {
    return new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: designWidth(),
        height: DESIGN_HEIGHT,
        backgroundColor: '#ffd89a',
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
        fps: { target: 60, smoothStep: true },
        input: { activePointers: 3 },
        disableContextMenu: true,
        // All audio is our own Web Audio synth (systems/sound.ts).
        audio: { noAudio: true },
        banner: false,
        scene: [Boot, Home, Play, Results],
    });
}
