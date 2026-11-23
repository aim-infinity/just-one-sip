import StartGame, { computeDesignWidth } from './game/main';
import { DESIGN_HEIGHT } from './game/render/palette';
import { RS, measureSafeArea } from './game/render/resolution';
import { mountDebugPanel } from './game/debug/DebugPanel';
import { sound } from './game/systems/sound';

function boot() {
    const game = StartGame('game-container');

    // Re-fit on rotation / browser chrome changes (iOS reports late sizes). If the
    // screen shape changed, resize the game so it stays edge to edge, and rebuild
    // menu scenes (a ride in progress keeps its layout until it ends).
    let timer = 0;
    const refit = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            measureSafeArea();
            const w = computeDesignWidth() * RS;
            if (Math.abs(w - game.scale.width) > 8 && window.innerWidth > window.innerHeight) {
                game.scale.setGameSize(w, DESIGN_HEIGHT * RS);
                for (const key of ['Home', 'Setup']) if (game.scene.isActive(key)) game.scene.getScene(key).scene.restart();
            }
            game.scale.refresh();
        }, 250);
    };
    window.addEventListener('orientationchange', refit);
    window.addEventListener('resize', refit);

    // Unlock Web Audio from a *native* user gesture (required by iOS/Android autoplay rules).
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
        document.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
    }

    // Prevent pinch-zoom, double-tap zoom and long-press menus during play.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    const debug = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
    if (debug) mountDebugPanel();
}

document.addEventListener('DOMContentLoaded', boot);
