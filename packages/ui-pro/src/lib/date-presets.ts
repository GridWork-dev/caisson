/**
 * Pure date-range preset math for DateRangePicker. Ranges are ISO date strings (`YYYY-MM-DD`),
 * computed from a reference date's UTC parts so they are deterministic and timezone-stable (a
 * date-only range has no time-of-day to shift). The domain presets — fiscal quarter and billing
 * cycle — are the domain-specific part; a plain "last 7 days" is commodity.
 */

export interface DateRange {
  start: string;
  end: string;
}

export interface PresetOptions {
  /** Fiscal-year start month, 0 = January (default). Set 3 for an April fiscal year, etc. */
  fiscalStartMonth?: number;
  /** Day of month the billing cycle renews on, 1-28 (default 1). */
  billingAnchorDay?: number;
}

function iso(y: number, m0: number, d: number): string {
  const dt = new Date(Date.UTC(y, m0, d));
  return dt.toISOString().slice(0, 10);
}

function parts(ref: Date): [number, number, number] {
  return [ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()];
}

/** Last calendar day of month `m0` in year `y` (m0 0-indexed). */
function lastDayOfMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

export function thisMonth(ref: Date): DateRange {
  const [y, m] = parts(ref);
  return { start: iso(y, m, 1), end: iso(y, m, lastDayOfMonth(y, m)) };
}

export function lastMonth(ref: Date): DateRange {
  const [y, m] = parts(ref);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const sy = start.getUTCFullYear();
  const sm = start.getUTCMonth();
  return { start: iso(sy, sm, 1), end: iso(sy, sm, lastDayOfMonth(sy, sm)) };
}

/** The last `n` days inclusive, ending on the reference date. */
export function lastNDays(ref: Date, n: number): DateRange {
  const [y, m, d] = parts(ref);
  return { start: iso(y, m, d - (n - 1)), end: iso(y, m, d) };
}

export function yearToDate(ref: Date): DateRange {
  const [y, m, d] = parts(ref);
  return { start: iso(y, 0, 1), end: iso(y, m, d) };
}

/**
 * The fiscal quarter containing `ref`, shifted by `offset` quarters (0 = current, -1 = previous).
 * `fiscalStartMonth` sets the fiscal year's first month.
 */
export function fiscalQuarter(
  ref: Date,
  fiscalStartMonth = 0,
  offset = 0,
): DateRange {
  const [y, m] = parts(ref);
  const monthsIn = (m - fiscalStartMonth + 12) % 12;
  const quarterIndex = Math.floor(monthsIn / 3);
  // The calendar year the current fiscal year began.
  const fyStartYear = m >= fiscalStartMonth ? y : y - 1;
  const startMonthAbs = fiscalStartMonth + quarterIndex * 3 + offset * 3;
  const start = new Date(Date.UTC(fyStartYear, startMonthAbs, 1));
  const sy = start.getUTCFullYear();
  const sm = start.getUTCMonth();
  const end = new Date(Date.UTC(sy, sm + 3, 0));
  return {
    start: iso(sy, sm, 1),
    end: iso(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  };
}

/**
 * The billing cycle containing `ref`, renewing on `anchorDay`. The cycle runs from the anchor day of
 * one month to the day before the next anchor. If `ref`'s day is before the anchor, the cycle
 * started the previous month.
 */
export function billingCycle(ref: Date, anchorDay = 1): DateRange {
  const [y, m, d] = parts(ref);
  const startMonthOffset = d >= anchorDay ? 0 : -1;
  const start = new Date(Date.UTC(y, m + startMonthOffset, anchorDay));
  const next = new Date(Date.UTC(y, m + startMonthOffset + 1, anchorDay));
  const end = new Date(next.getTime() - 24 * 60 * 60 * 1000);
  return {
    start: iso(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    end: iso(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  };
}

/**
 * The equal-length period immediately BEFORE `range` — the default comparison window. Returns
 * `null` when either bound is missing or unparseable: a malformed/empty range would otherwise
 * produce an Invalid Date whose `.toISOString()` throws a RangeError. Callers thread the result
 * straight into `onComparisonChange` (which takes `DateRange | null`), so null is a safe no-op.
 */
export function previousPeriod(range: DateRange): DateRange | null {
  const day = 24 * 60 * 60 * 1000;
  const start = new Date(`${range.start}T00:00:00Z`).getTime();
  const end = new Date(`${range.end}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const lengthDays = Math.round((end - start) / day) + 1;
  const prevEnd = new Date(start - day);
  const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * day);
  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}

export interface RangePreset {
  id: string;
  label: string;
  compute: (ref: Date) => DateRange;
}

/** The default preset row: recency + fiscal quarter + billing cycle. */
export function standardPresets(opts: PresetOptions = {}): RangePreset[] {
  const fs = opts.fiscalStartMonth ?? 0;
  const anchor = opts.billingAnchorDay ?? 1;
  return [
    { id: "last7", label: "Last 7 days", compute: (r) => lastNDays(r, 7) },
    { id: "last30", label: "Last 30 days", compute: (r) => lastNDays(r, 30) },
    { id: "thisMonth", label: "This month", compute: thisMonth },
    { id: "lastMonth", label: "Last month", compute: lastMonth },
    {
      id: "thisQuarter",
      label: "This quarter",
      compute: (r) => fiscalQuarter(r, fs, 0),
    },
    {
      id: "lastQuarter",
      label: "Last quarter",
      compute: (r) => fiscalQuarter(r, fs, -1),
    },
    { id: "ytd", label: "Year to date", compute: yearToDate },
    {
      id: "billingCycle",
      label: "Billing cycle",
      compute: (r) => billingCycle(r, anchor),
    },
  ];
}
