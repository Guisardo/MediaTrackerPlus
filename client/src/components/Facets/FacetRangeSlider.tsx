import React, { FunctionComponent, useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';

/**
 * FacetRangeSlider renders a dual-handle range slider using the shadcn/ui
 * Slider component (which wraps @radix-ui/react-slider) together with paired
 * numeric text inputs.
 *
 * ## Interaction model
 * - Dragging either slider handle updates the corresponding numeric input in
 *   real-time via `onValueChange`.
 * - URL params are written only on slider *release* (`onValueCommit`) to avoid
 *   flooding the browser history on every pixel of drag movement.
 * - Typing into a numeric input updates the slider value immediately on blur;
 *   out-of-range values are clamped to [min, max] and invalid (non-numeric)
 *   inputs revert to the last committed value.
 *
 * ## Reuse
 * This component is reused by:
 *   - YearSection   — min=earliest year, max=current year, step=1
 *   - RatingSection — min=0, max=10, step=0.5
 */
export const FacetRangeSlider: FunctionComponent<{
  /** Minimum possible value for the range. */
  min: number;
  /** Maximum possible value for the range. */
  max: number;
  /** Step increment for slider movement and input validation. Defaults to 1. */
  step?: number;
  /** Current lower bound (null = unset / use min). */
  valueMin: number | null;
  /** Current upper bound (null = unset / use max). */
  valueMax: number | null;
  /**
   * Called with [newMin, newMax] when the user *commits* a new range (slider
   * release or numeric input blur).  Pass null for either bound to clear it.
   */
  onCommit: (newMin: number | null, newMax: number | null) => void;
  /** Accessible label for the lower-bound input (e.g. "Minimum year"). */
  minInputLabel?: string;
  /** Accessible label for the upper-bound input (e.g. "Maximum year"). */
  maxInputLabel?: string;
  /** Number of decimal places to display in inputs. Defaults to 0. */
  decimalPlaces?: number;
}> = ({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onCommit,
  minInputLabel = 'Minimum value',
  maxInputLabel = 'Maximum value',
  decimalPlaces = 0,
}) => {
  const resolvedMin = valueMin ?? min;
  const resolvedMax = valueMax ?? max;

  // --- Internal drag state ------------------------------------------------
  const [sliderValues, setSliderValues] = useState<[number, number]>([
    resolvedMin,
    resolvedMax,
  ]);

  // --- Input box state ----------------------------------------------------
  const [minInputValue, setMinInputValue] = useState<string>(
    resolvedMin.toFixed(decimalPlaces)
  );
  const [maxInputValue, setMaxInputValue] = useState<string>(
    resolvedMax.toFixed(decimalPlaces)
  );

  // Keep internal state in sync when URL params change from outside (e.g.
  // "Clear all filters" or navigating to the page with pre-filled params).
  useEffect(() => {
    const newMin = valueMin ?? min;
    const newMax = valueMax ?? max;
    setSliderValues([newMin, newMax]);
    setMinInputValue(newMin.toFixed(decimalPlaces));
    setMaxInputValue(newMax.toFixed(decimalPlaces));
  }, [valueMin, valueMax, min, max, decimalPlaces]);

  // --- Slider handlers ----------------------------------------------------

  /** Real-time update during drag — keeps the numeric inputs in sync. */
  const handleValueChange = useCallback(
    (values: number[]) => {
      const [newMin, newMax] = values as [number, number];
      setSliderValues([newMin, newMax]);
      setMinInputValue(newMin.toFixed(decimalPlaces));
      setMaxInputValue(newMax.toFixed(decimalPlaces));
    },
    [decimalPlaces]
  );

  /**
   * Commit on release — fires when the user lets go of a thumb.
   * Pass null for a bound when it equals the extreme (min/max) to keep the
   * URL clean.
   */
  const handleValueCommit = useCallback(
    (values: number[]) => {
      const [newMin, newMax] = values as [number, number];
      onCommit(
        newMin === min ? null : newMin,
        newMax === max ? null : newMax
      );
    },
    [min, max, onCommit]
  );

  // --- Numeric input handlers ---------------------------------------------
  const handleMinInputBlur = useCallback(() => {
    const parsed = parseFloat(minInputValue);
    if (isNaN(parsed)) {
      setMinInputValue(sliderValues[0].toFixed(decimalPlaces));
      return;
    }
    const clamped = Math.max(min, Math.min(parsed, sliderValues[1]));
    const snapped = Math.round(clamped / step) * step;
    setMinInputValue(snapped.toFixed(decimalPlaces));
    setSliderValues([snapped, sliderValues[1]]);
    onCommit(snapped === min ? null : snapped, sliderValues[1] === max ? null : sliderValues[1]);
  }, [min, max, step, decimalPlaces, minInputValue, sliderValues, onCommit]);

  const handleMaxInputBlur = useCallback(() => {
    const parsed = parseFloat(maxInputValue);
    if (isNaN(parsed)) {
      setMaxInputValue(sliderValues[1].toFixed(decimalPlaces));
      return;
    }
    const clamped = Math.max(sliderValues[0], Math.min(parsed, max));
    const snapped = Math.round(clamped / step) * step;
    setMaxInputValue(snapped.toFixed(decimalPlaces));
    setSliderValues([sliderValues[0], snapped]);
    onCommit(sliderValues[0] === min ? null : sliderValues[0], snapped === max ? null : snapped);
  }, [min, max, step, decimalPlaces, maxInputValue, sliderValues, onCommit]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        (e.currentTarget as HTMLInputElement).blur();
      }
    },
    []
  );

  return (
    <div className="space-y-3">
      {/* Dual-thumb range slider using shadcn/ui Slider (Radix) */}
      <Slider
        min={min}
        max={max}
        step={step}
        value={sliderValues}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        aria-label={`${minInputLabel} to ${maxInputLabel}`}
      />

      {/* Paired numeric inputs */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
          aria-label={minInputLabel}
          value={minInputValue}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setMinInputValue(e.target.value)}
          onBlur={handleMinInputBlur}
          onKeyDown={handleInputKeyDown}
        />
        <span
          className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        >
          –
        </span>
        <input
          type="number"
          className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
          aria-label={maxInputLabel}
          value={maxInputValue}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setMaxInputValue(e.target.value)}
          onBlur={handleMaxInputBlur}
          onKeyDown={handleInputKeyDown}
        />
      </div>
    </div>
  );
};
