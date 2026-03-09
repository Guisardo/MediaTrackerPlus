import React, { FunctionComponent, useState, useEffect, useCallback, useRef } from 'react';

/**
 * FacetRangeSlider renders a dual-handle range slider using native HTML
 * range inputs together with paired numeric text inputs.
 *
 * Uses two overlapping `<input type="range">` elements to create a dual-thumb
 * slider without any third-party dependencies, avoiding React 17 compatibility
 * issues with Radix's jsx-runtime usage.
 *
 * ## Interaction model
 * - Dragging either slider handle updates the corresponding numeric input in
 *   real-time.
 * - URL params are written only on slider *release* (mouseup/touchend) to avoid
 *   flooding the browser history on every pixel of drag movement.
 * - Typing into a numeric input updates the slider value immediately on blur;
 *   out-of-range values are clamped to [min, max] and invalid (non-numeric)
 *   inputs revert to the last committed value.
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
  const handleMinSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      // Ensure lower handle doesn't exceed upper handle.
      const clamped = Math.min(raw, sliderValues[1] - step);
      setSliderValues([clamped, sliderValues[1]]);
      setMinInputValue(clamped.toFixed(decimalPlaces));
    },
    [sliderValues, step, decimalPlaces]
  );

  const handleMaxSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      // Ensure upper handle doesn't go below lower handle.
      const clamped = Math.max(raw, sliderValues[0] + step);
      setSliderValues([sliderValues[0], clamped]);
      setMaxInputValue(clamped.toFixed(decimalPlaces));
    },
    [sliderValues, step, decimalPlaces]
  );

  /**
   * Commit on release (mouseup/touchend).
   * Pass null for a bound when it equals the extreme (min/max) to keep the
   * URL clean.
   */
  const handleSliderCommit = useCallback(() => {
    onCommit(
      sliderValues[0] === min ? null : sliderValues[0],
      sliderValues[1] === max ? null : sliderValues[1]
    );
  }, [min, max, sliderValues, onCommit]);

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

  // --- Track fill percentage for visual feedback --------------------------
  const range = max - min || 1;
  const minPercent = ((sliderValues[0] - min) / range) * 100;
  const maxPercent = ((sliderValues[1] - min) / range) * 100;

  return (
    <div className="space-y-3">
      {/* Dual-thumb range slider using two overlapping native range inputs */}
      <div className="relative w-full h-5 flex items-center select-none touch-none">
        {/* Background track */}
        <div className="absolute w-full h-1.5 rounded-full bg-gray-200 dark:bg-slate-600" />

        {/* Active range fill */}
        <div
          className="absolute h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Lower-bound range input */}
        <input
          type="range"
          className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:dark:bg-slate-200 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:dark:border-blue-400 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:dark:bg-slate-200 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:dark:border-blue-400 [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={sliderValues[0]}
          onChange={handleMinSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          aria-label={minInputLabel}
          style={{ zIndex: sliderValues[0] > max - step ? 5 : 3 }}
        />

        {/* Upper-bound range input */}
        <input
          type="range"
          className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:dark:bg-slate-200 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:dark:border-blue-400 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:dark:bg-slate-200 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:dark:border-blue-400 [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={sliderValues[1]}
          onChange={handleMaxSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          aria-label={maxInputLabel}
          style={{ zIndex: 4 }}
        />
      </div>

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
          onKeyDown={handleInputKeyDown}
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
          onKeyDown={handleInputKeyDown}
        />
      </div>
    </div>
  );
};
