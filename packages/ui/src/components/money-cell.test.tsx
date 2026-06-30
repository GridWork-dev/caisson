import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { formatMoneyCellValue, MoneyCell } from "./money-cell";

describe("formatMoneyCellValue — integer units only (ADR-0007)", () => {
  test("usd-cents: formats positive, negative, and zero", () => {
    expect(formatMoneyCellValue(123456, "usd-cents")).toBe("$1,234.56");
    expect(formatMoneyCellValue(-250, "usd-cents")).toBe("-$2.50");
    expect(formatMoneyCellValue(0, "usd-cents")).toBe("$0.00");
  });

  test("usd-cents: sign mode prefixes a leading + for non-negative values only", () => {
    expect(formatMoneyCellValue(1000, "usd-cents", { sign: true })).toBe(
      "+$10.00",
    );
    expect(formatMoneyCellValue(0, "usd-cents", { sign: true })).toBe("+$0.00");
    expect(formatMoneyCellValue(-1000, "usd-cents", { sign: true })).toBe(
      "-$10.00",
    );
  });

  test("credits: thousands-grouped integer, negative, and zero", () => {
    expect(formatMoneyCellValue(2500, "credits")).toBe("2,500");
    expect(formatMoneyCellValue(-40, "credits")).toBe("-40");
    expect(formatMoneyCellValue(0, "credits")).toBe("0");
  });

  test("credits: sign mode prefixes a leading + for non-negative values", () => {
    expect(formatMoneyCellValue(40, "credits", { sign: true })).toBe("+40");
  });

  test("defaults to usd-cents when unit is omitted", () => {
    expect(formatMoneyCellValue(500)).toBe("$5.00");
  });

  test("throws on a non-safe-integer value (ADR-0007: never floats)", () => {
    expect(() => formatMoneyCellValue(19.99, "usd-cents")).toThrow();
    expect(() => formatMoneyCellValue(Number.NaN, "credits")).toThrow();
  });
});

describe("MoneyCell — renders the formatted value + sign-tone attribute", () => {
  test("renders the formatted text", () => {
    const html = renderToStaticMarkup(
      <MoneyCell value={123456} unit="usd-cents" />,
    );
    expect(html).toContain("cs-money");
    expect(html).toContain("$1,234.56");
  });

  test("signTone marks positive/negative/zero via data-sign", () => {
    expect(renderToStaticMarkup(<MoneyCell value={5} signTone />)).toContain(
      'data-sign="positive"',
    );
    expect(renderToStaticMarkup(<MoneyCell value={-5} signTone />)).toContain(
      'data-sign="negative"',
    );
    expect(renderToStaticMarkup(<MoneyCell value={0} signTone />)).toContain(
      'data-sign="zero"',
    );
  });

  test("omits data-sign when signTone is not set", () => {
    const html = renderToStaticMarkup(<MoneyCell value={5} />);
    expect(html).not.toContain("data-sign");
  });
});
