import { settings } from './settings';

/** Optional vibration on supporting devices (Android Chrome). Silently no-ops elsewhere. */
export function vibrate(pattern: number | number[]): void {
    if (!settings.haptics) return;
    try {
        navigator.vibrate?.(pattern);
    } catch {
        /* unsupported */
    }
}
