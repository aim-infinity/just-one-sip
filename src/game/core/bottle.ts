/**
 * Water bookkeeping.
 *  - The bottle only empties by *drinking*: remaining + consumed === capacity.
 *  - Spills are tracked separately on a "mess meter" (`spilledMl`). They never
 *    take water away from you; spill too much (TUNING.spillLimitMl) and the
 *    ride ends instead.
 */
export class Bottle {
    remainingMl: number;
    consumedMl = 0;
    spilledMl = 0;

    constructor(public readonly capacityMl: number) {
        this.remainingMl = capacityMl;
    }

    /** Move up to `ml` into the mouth. Returns the amount actually drunk. */
    drink(ml: number): number {
        const amt = Math.max(0, Math.min(ml, this.remainingMl));
        this.remainingMl -= amt;
        this.consumedMl += amt;
        this.snap();
        return amt;
    }

    /** Record `ml` splashed onto the floor/shirt (mess meter only). Returns the amount added. */
    spill(ml: number): number {
        if (this.isEmpty) return 0;
        const amt = Math.max(0, ml);
        this.spilledMl += amt;
        return amt;
    }

    /** Refill (tutorial only) — resets all counters. */
    refill(): void {
        this.remainingMl = this.capacityMl;
        this.consumedMl = 0;
        this.spilledMl = 0;
    }

    get fill(): number {
        return this.remainingMl / this.capacityMl;
    }

    get isEmpty(): boolean {
        return this.remainingMl <= 1e-6;
    }

    /** Kill float dust so "empty" really means 0. */
    private snap(): void {
        if (this.remainingMl < 1e-6) this.remainingMl = 0;
    }
}
