import { DEFAULT_TUNING, TUNING, type TuningKey } from '../config/tuning';

/**
 * Development-only tuning panel. Enabled automatically in `npm run dev`, or in
 * production with `?debug` in the URL. Mutates the live TUNING object.
 */
const SLIDERS: { key: TuningKey; label: string; min: number; max: number; step: number; note?: string }[] = [
    { key: 'speedScale', label: 'Scroll speed × (curve 6→9 m/s)', min: 0.4, max: 2, step: 0.05 },
    { key: 'drinkRateMlPerSec', label: 'Drink rate (ml/s)', min: 5, max: 60, step: 1 },
    { key: 'capacityMl', label: 'Bottle capacity (ml)', min: 50, max: 1000, step: 10, note: 'restart' },
    { key: 'raiseMs', label: 'Arm raise (ms)', min: 100, max: 1200, step: 10 },
    { key: 'lowerMs', label: 'Arm lower (ms)', min: 80, max: 1000, step: 10 },
    { key: 'obstacleSpacingScale', label: 'Obstacle spacing ×', min: 0.5, max: 3, step: 0.05, note: 'restart' },
    { key: 'suspensionStrength', label: 'Suspension strength ×', min: 0, max: 3, step: 0.05 },
    { key: 'suspensionStiffness', label: 'Suspension stiffness', min: 60, max: 600, step: 10 },
    { key: 'suspensionDamping', label: 'Suspension damping', min: 2, max: 40, step: 1 },
    { key: 'spillSensitivity', label: 'Spill sensitivity ×', min: 0, max: 3, step: 0.05 },
    { key: 'alignTolerancePx', label: 'Align tolerance (px)', min: 1, max: 25, step: 0.5 },
];

export function mountDebugPanel(): void {
    const root = document.createElement('details');
    root.id = 'debug-panel';
    root.innerHTML = `<summary>🛠 Debug</summary><div class="dbg-body"></div>`;
    const body = root.querySelector('.dbg-body')!;
    const stats = document.createElement('div');
    stats.className = 'dbg-stats';
    body.appendChild(stats);

    for (const s of SLIDERS) {
        const row = document.createElement('label');
        const val = document.createElement('span');
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(s.min);
        input.max = String(s.max);
        input.step = String(s.step);
        input.value = String(TUNING[s.key]);
        val.textContent = String(TUNING[s.key]);
        input.addEventListener('input', () => {
            (TUNING as Record<TuningKey, number>)[s.key] = Number(input.value);
            val.textContent = input.value;
        });
        row.append(`${s.label}${s.note ? ` (${s.note})` : ''} `, val, input);
        body.appendChild(row);
    }
    const btns = document.createElement('div');
    const restart = document.createElement('button');
    restart.textContent = 'Restart ride';
    restart.onclick = () => window.dispatchEvent(new Event('jos:restart'));
    const reset = document.createElement('button');
    reset.textContent = 'Reset values';
    reset.onclick = () => {
        Object.assign(TUNING, DEFAULT_TUNING);
        body.querySelectorAll('input').forEach((el, i) => {
            el.value = String(TUNING[SLIDERS[i].key]);
            (el.previousSibling as HTMLElement).textContent = el.value;
        });
    };
    btns.append(restart, reset);
    body.appendChild(btns);
    // keep debug taps from leaking into the game as "hold" input
    for (const ev of ['pointerdown', 'touchstart', 'mousedown'] as const) root.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(root);

    let frames = 0;
    let last = performance.now();
    const tick = () => {
        frames++;
        const now = performance.now();
        if (now - last > 500) {
            const fps = Math.round((frames * 1000) / (now - last));
            frames = 0;
            last = now;
            const j = (window as unknown as { __jos?: { sim: { opts: { seed: number }; bottle: { remainingMl: number; consumedMl: number; spilledMl: number }; rig: { misalign: number } } } }).__jos;
            const sim = j?.sim;
            stats.textContent = sim
                ? `${fps} fps · seed ${sim.opts.seed} · left ${sim.bottle.remainingMl.toFixed(1)} drunk ${sim.bottle.consumedMl.toFixed(1)} spilt ${sim.bottle.spilledMl.toFixed(1)} · Σ ${(sim.bottle.remainingMl + sim.bottle.consumedMl + sim.bottle.spilledMl).toFixed(3)} · misalign ${sim.rig.misalign.toFixed(1)}px`
                : `${fps} fps`;
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
