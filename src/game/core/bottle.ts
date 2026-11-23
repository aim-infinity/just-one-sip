/**
 * Water bookkeeping. Water only ever *moves* from `remainingMl` into
 * `consumedMl` or `spilledMl`, so remaining + consumed + spilled === capacity.
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

    /** Move up to `ml` onto the floor/shirt. Returns the amount actually spilled. */
    spill(ml: number): number {
        const amt = Math.max(0, Math.min(ml, this.remainingMl));
        this.remainingMl -= amt;
        this.spilledMl += amt;
        this.snap();
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
