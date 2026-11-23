import StartGame from './game/main';
import { mountDebugPanel } from './game/debug/DebugPanel';
import { sound } from './game/systems/sound';

function boot() {
    const game = StartGame('game-container');

    // Re-fit on rotation / browser chrome changes (iOS reports late sizes).
    const refit = () => setTimeout(() => game.scale.refresh(), 250);
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
