/**
 * Fraction handling for PERCENTAGE indicators.
 *
 * BAR 1 reports a percentage indicator as a fraction — 148 of 200 beneficiaries, 9 of 11
 * partnerships — and the database stores the two halves as numbers
 * (numerator_qN / denominator_qN for the actual, target_numerator_qN / target_denominator_qN
 * for the target) alongside the computed percentage.
 *
 * The numbers are entered as two separate inputs and the '/' is supplied by the interface, so
 * there is no free-text fraction to parse and no way to type something like "82.73%/72.76%".
 * Everything here is a pure function: no Vue, no API, no formatting beyond the display string.
 */

/** A fraction as the user entered it. Either side may be blank while they are still typing. */
export interface FractionEntry {
  numerator: number | string | null | undefined;
  denominator: number | string | null | undefined;
}

export interface FractionResult {
  numerator: number | null;
  denominator: number | null;
  /** The percentage the fraction works out to, to 4 decimal places, or null. */
  percent: number | null;
  /** The display form, e.g. "148/200". Null until both halves are present and valid. */
  text: string | null;
  /** Both halves supplied. A half-filled pair is incomplete, not merely invalid. */
  isComplete: boolean;
  /** False only for a pair that cannot be stored at all. Blocks saving. */
  isValid: boolean;
  /** A message to show under the inputs, or null when there is nothing to say. */
  error: string | null;
  /**
   * A pair that stores fine but looks unusual — today, one that works out to more than 100%.
   * Shown to the user; does not block saving. Over-achievement is real in this data
   * (15/13, 24/17, 26/25 are all recorded against live indicators), so it cannot be refused.
   */
  warning: string | null;
}

const EMPTY: FractionResult = {
  numerator: null,
  denominator: null,
  percent: null,
  text: null,
  isComplete: false,
  isValid: true,
  error: null,
  warning: null,
};

/**
 * A fraction above this percentage is refused outright. Below it, anything over 100% is flagged
 * as unusual but still accepted.
 *
 * Over-achievement is ordinary in this data — 15/13, 24/17, 26/25 and three more are recorded
 * against live indicators, the highest at 141% — so exceeding the denominator cannot be an
 * error. A transposed entry like 123/12 (1025%) is a different thing, and this is where the
 * line between the two sits. Raise it if a genuine figure is ever refused.
 */
export const IMPLAUSIBLE_PERCENT = 300;

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Validate a pair of inputs and work out the percentage.
 *
 * An untouched pair is valid and empty — a quarter with no data is not an error. A pair with
 * only one half filled is invalid, because the half on its own cannot be stored: the database
 * holds the two numbers and the percentage derived from them, never one number alone.
 */
export function evaluateFraction(entry: FractionEntry): FractionResult {
  const numerator = toNumber(entry.numerator);
  const denominator = toNumber(entry.denominator);

  if (numerator === null && denominator === null) return { ...EMPTY };

  if (numerator === null || denominator === null) {
    return {
      ...EMPTY,
      numerator,
      denominator,
      isValid: false,
      error: 'Enter both the numerator and the denominator',
      warning: null,
    };
  }

  if (numerator < 0 || denominator < 0) {
    return {
      ...EMPTY,
      numerator,
      denominator,
      isComplete: true,
      isValid: false,
      error: 'Values cannot be negative',
      warning: null,
    };
  }

  if (denominator === 0) {
    return {
      ...EMPTY,
      numerator,
      denominator,
      isComplete: true,
      isValid: false,
      error: 'The denominator cannot be zero',
      warning: null,
    };
  }

  const percent = round((numerator / denominator) * 100, 4);

  if (percent > IMPLAUSIBLE_PERCENT) {
    return {
      ...EMPTY,
      numerator,
      denominator,
      isComplete: true,
      isValid: false,
      error: `${formatFraction(numerator, denominator)} works out to ${percent}% — check the two numbers are the right way round`,
    };
  }

  return {
    numerator,
    denominator,
    percent,
    text: formatFraction(numerator, denominator),
    isComplete: true,
    isValid: true,
    error: null,
    warning:
      numerator > denominator
        ? `Above 100% — the numerator is greater than the denominator`
        : null,
  };
}

/**
 * The display form of a stored fraction, or null when either half is missing.
 *
 * Trailing zeros are dropped so a whole number reads as "148/200", not "148.0000/200.0000" —
 * the columns are numeric(12,4) and the driver returns them padded to their scale.
 */
export function formatFraction(
  numerator: number | string | null | undefined,
  denominator: number | string | null | undefined,
): string | null {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n === null || d === null) return null;
  return `${trim(n)}/${trim(d)}`;
}

/**
 * Read a fraction that was typed into a free-text field, for the rows recorded while the
 * dedicated inputs were missing from this page. Returns null for anything that is not a plain
 * "number/number", including the "82.73%/72.76%" form that free text allowed.
 */
export function parseFractionText(
  raw: string | null | undefined,
): { numerator: number; denominator: number } | null {
  if (!raw) return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(raw);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return { numerator, denominator };
}

function round(value: number, places: number): number {
  return Number(value.toFixed(places));
}

/** Render a stored numeric without the scale padding the database applies. */
function trim(value: number): string {
  return String(Number(value.toFixed(4)));
}
