"use client";

import { useState } from "react";

import { Button } from "@caisson-sh/ui/components";

import {
  previousPeriod,
  standardPresets,
  type DateRange,
} from "../lib/date-presets";

import "./date-range-picker.css";

export interface DateRangePickerProps {
  /** The selected range (controlled), as ISO date strings. */
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Offer a comparison range toggle (defaults to the previous equal-length period). */
  enableComparison?: boolean;
  comparison?: DateRange | null;
  onComparisonChange?: (range: DateRange | null) => void;
  /** Fiscal-year start month (0 = January) for the quarter presets. */
  fiscalStartMonth?: number;
  /** Billing renewal day for the billing-cycle preset. */
  billingAnchorDay?: number;
  /** Reference "today" for presets — injectable for determinism. Default now. */
  referenceDate?: Date;
  /** IANA timezone shown as context (date-only ranges carry no time-of-day, so they are stable). */
  timeZone?: string;
  ariaLabel?: string;
}

/**
 * DateRangePicker — a range selector built on native `<input type="date">` (free keyboard, locale,
 * and platform picker) with the commercial extras: fiscal-quarter and billing-cycle presets, a
 * comparison range that defaults to the previous equal-length period, and a timezone label. The
 * preset math is pure and injectable via `referenceDate`. Themed through the floor token contract.
 */
export function DateRangePicker({
  value,
  onChange,
  enableComparison = false,
  comparison = null,
  onComparisonChange,
  fiscalStartMonth = 0,
  billingAnchorDay = 1,
  referenceDate,
  timeZone,
  ariaLabel = "Date range",
}: DateRangePickerProps) {
  const [compareOn, setCompareOn] = useState(comparison != null);
  const presets = standardPresets({ fiscalStartMonth, billingAnchorDay });
  const ref = referenceDate ?? new Date();

  const applyPreset = (range: DateRange) => {
    onChange(range);
    if (compareOn) onComparisonChange?.(previousPeriod(range));
  };

  const setStart = (start: string) => onChange({ ...value, start });
  const setEnd = (end: string) => onChange({ ...value, end });

  const toggleCompare = (on: boolean) => {
    setCompareOn(on);
    onComparisonChange?.(on ? (comparison ?? previousPeriod(value)) : null);
  };

  return (
    <div className="cs-daterange" role="group" aria-label={ariaLabel}>
      <div
        className="cs-daterange__presets"
        role="group"
        aria-label="Range presets"
      >
        {presets.map((p) => (
          <Button
            key={p.id}
            variant="ghost"
            size="sm"
            onClick={() => applyPreset(p.compute(ref))}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="cs-daterange__fields">
        <label className="cs-daterange__field">
          <span>From</span>
          <input
            type="date"
            className="cs-daterange__input"
            value={value.start}
            max={value.end || undefined}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Start date"
          />
        </label>
        <span className="cs-daterange__sep" aria-hidden="true">
          →
        </span>
        <label className="cs-daterange__field">
          <span>To</span>
          <input
            type="date"
            className="cs-daterange__input"
            value={value.end}
            min={value.start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="End date"
          />
        </label>
        {timeZone ? (
          <span className="cs-daterange__tz" title="Timezone">
            {timeZone}
          </span>
        ) : null}
      </div>

      {enableComparison ? (
        <div className="cs-daterange__compare">
          <label className="cs-daterange__compare-toggle">
            <input
              type="checkbox"
              checked={compareOn}
              onChange={(e) => toggleCompare(e.target.checked)}
            />
            Compare to another period
          </label>
          {compareOn && comparison ? (
            <div className="cs-daterange__fields">
              <label className="cs-daterange__field">
                <span>From</span>
                <input
                  type="date"
                  className="cs-daterange__input"
                  value={comparison.start}
                  max={comparison.end || undefined}
                  onChange={(e) =>
                    onComparisonChange?.({
                      ...comparison,
                      start: e.target.value,
                    })
                  }
                  aria-label="Comparison start date"
                />
              </label>
              <span className="cs-daterange__sep" aria-hidden="true">
                →
              </span>
              <label className="cs-daterange__field">
                <span>To</span>
                <input
                  type="date"
                  className="cs-daterange__input"
                  value={comparison.end}
                  min={comparison.start || undefined}
                  onChange={(e) =>
                    onComparisonChange?.({ ...comparison, end: e.target.value })
                  }
                  aria-label="Comparison end date"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
