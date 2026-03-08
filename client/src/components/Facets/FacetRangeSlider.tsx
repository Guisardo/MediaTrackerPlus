import React, { FunctionComponent, useState, useEffect, useCallback } from 'react';
import * as Slider from '@radix-ui/react-slider';

/**
 * FacetRangeSlider renders a dual-handle range slider using
 * @radix-ui/react-slider together with paired numeric text inputs.
 *
 * ## Interaction model
 * - Dragging either slider handle updates the corresponding numeric input in
 *   real-time (onValueChange callback).
 * - URL params are written only on slider *release* (onValueCommit) to avoid
 *   flooding the browser history on every pixel of drag movement.
 * - Typing into a numeric input updates the slider value immediately on blur;
 *   out-of-range values are clamped to [min, max] and invalid (non-numeric)
 *   inputs revert to the last committed value.
 *
 * ## TailwindCSS styling
 * The Radix Slider primitives (Root, Track, Range, Thumb) are styled entirely
 * with Tailwind utility classes.  Dark-mode variants use the `dark:` prefix
 * since the project uses class-based dark mode.
 *
 * ## Reuse
 * This component is reused by:
 *   - YearSection  (US-012) — min=earliest year, max=current year, step=1
 *   - RatingSection (US-013) — min=0, max=10, step=0.5
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
  // The Radix Slider expects a [number, number] tuple as its value.
  // We default to [min, max] when either bound is null (unset).
  const resolvedMin = valueMin ?? min;
  const resolvedMax = valueMax ?? max;

  // --- Internal drag state ------------------------------------------------
  // sliderValues tracks the in-motion values during a drag so the numeric
  // inputs update in real-time (onValueChange) without writing to the URL.
  const [sliderValues, setSliderValues] = useState<[number, number]>([
    resolvedMin,
    resolvedMax,
  ]);

  // --- Input box state ----------------------------------------------------
  // Separate controlled string state so the user can freely type and we only
  // parse/clamp on blur.
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

  /** Called on every change (i.e. on drag).  Updates inputs in real-time. */
  const handleSliderChange = useCallback((values: number[]) => {
    const [low, high] = values as [number, number];
    setSliderValues([low, high]);
    setMinInputValue(low.toFixed(decimalPlaces));
    setMaxInputValue(high.toFixed(decimalPlaces));
  }, [decimalPlaces]);

  /**
   * Called when the user releases the slider handle.  This is where we write
   * the URL params so we don't produce one history entry per drag pixel.
   *
   * We pass null for a bound when it equals the extreme (min/max) to keep the
   * URL clean — a null bound means "no filter applied for this bound".
   */
  const handleSliderCommit = useCallback(
    (values: number[]) => {
      const [low, high] = values as [number, number];
      onCommit(low === min ? null : low, high === max ? null : high);
    },
    [min, max, onCommit]
  );

  // --- Numeric input handlers ---------------------------------------------

  const handleMinInputBlur = useCallback(() => {
    const parsed = parseFloat(minInputValue);
    if (isNaN(parsed)) {
      // Revert to last known good value.
      setMinInputValue(sliderValues[0].toFixed(decimalPlaces));
      return;
    }
    // Clamp to [min, current max handle position].
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

  const handleMinInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        (e.currentTarget as HTMLInputElement).blur();
      }
    },
    []
  );

  const handleMaxInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        (e.currentTarget as HTMLInputElement).blur();
      }
    },
    []
  );

  return (
    <div className="space-y-3">
      {/* Dual-handle range slider */}
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        min={min}
        max={max}
        step={step}
        value={sliderValues}
        onValueChange={handleSliderChange}
        onValueCommit={handleSliderCommit}
        minStepsBetweenThumbs={1}
        aria-label="Range"
      >
        <Slider.Track className="relative grow rounded-full h-1.5 bg-gray-200 dark:bg-slate-600">
          <Slider.Range className="absolute rounded-full h-full bg-blue-500 dark:bg-blue-400" />
        </Slider.Track>

        {/* Lower-bound thumb */}
        <Slider.Thumb
          className="block w-4 h-4 rounded-full bg-white dark:bg-slate-200 border-2 border-blue-500 dark:border-blue-400 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
          aria-label={minInputLabel}
        />

        {/* Upper-bound thumb */}
        <Slider.Thumb
          className="block w-4 h-4 rounded-full bg-white dark:bg-slate-200 border-2 border-blue-500 dark:border-blue-400 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
          aria-label={maxInputLabel}
        />
      </Slider.Root>

      {/* Paired numeric inputs */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
          aria-label={minInputLabel}
          value={minInputValue}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setMinInputValue(e.target.value)}
          onBlur={handleMinInputBlur}
          onKeyDown={handleMinInputKeyDown}
        />
        <span
          className="flex-shrink-0 text-xs text-gray-400 dark:text-slate-500"
          aria-hidden="true"
        >
          –
        </span>
        <input
          type="number"
          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
          aria-label={maxInputLabel}
          value={maxInputValue}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setMaxInputValue(e.target.value)}
          onBlur={handleMaxInputBlur}
          onKeyDown={handleMaxInputKeyDown}
        />
      </div>
    </div>
  );
};
