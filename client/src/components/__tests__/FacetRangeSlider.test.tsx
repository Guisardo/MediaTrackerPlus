import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacetRangeSlider } from '../Facets/FacetRangeSlider';

// Mock shadcn/ui Slider (which wraps @radix-ui/react-slider — doesn't work in jsdom).
// The mock renders two hidden inputs so tests can drive slider values programmatically,
// and a visible slider role element for role queries.
jest.mock('@/components/ui/slider', () => ({
  Slider: ({
    min,
    max,
    step,
    value,
    onValueChange,
    onValueCommit,
    'aria-label': ariaLabel,
  }: {
    min: number;
    max: number;
    step: number;
    value: [number, number];
    onValueChange: (v: number[]) => void;
    onValueCommit: (v: number[]) => void;
    'aria-label'?: string;
  }) => (
    <div data-testid="slider-root" role="group" aria-label={ariaLabel}>
      {/* Two range inputs representing the two thumbs */}
      <input
        type="range"
        data-testid="slider-thumb-min"
        aria-label="min thumb"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => {
          const next: [number, number] = [parseFloat(e.target.value), value[1]];
          onValueChange(next);
        }}
        onMouseUp={(e) => {
          onValueCommit([parseFloat((e.target as HTMLInputElement).value), value[1]]);
        }}
      />
      <input
        type="range"
        data-testid="slider-thumb-max"
        aria-label="max thumb"
        min={min}
        max={max}
        step={step}
        value={value[1]}
        onChange={(e) => {
          const next: [number, number] = [value[0], parseFloat(e.target.value)];
          onValueChange(next);
        }}
        onMouseUp={(e) => {
          onValueCommit([value[0], parseFloat((e.target as HTMLInputElement).value)]);
        }}
      />
    </div>
  ),
}));

describe('FacetRangeSlider', () => {
  const defaultProps = {
    min: 2000,
    max: 2025,
    step: 1,
    valueMin: null,
    valueMax: null,
    onCommit: jest.fn(),
    minInputLabel: 'Minimum year',
    maxInputLabel: 'Maximum year',
    decimalPlaces: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the slider component and two numeric inputs', () => {
    render(<FacetRangeSlider {...defaultProps} />);

    expect(screen.getByTestId('slider-root')).toBeInTheDocument();

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs).toHaveLength(2);
  });

  it('renders with accessible labels on numeric inputs', () => {
    render(<FacetRangeSlider {...defaultProps} />);

    expect(screen.getByLabelText('Minimum year')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum year')).toBeInTheDocument();
  });

  it('defaults to min/max when valueMin/valueMax are null', () => {
    render(<FacetRangeSlider {...defaultProps} />);

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs[0]).toHaveValue(2000);
    expect(numberInputs[1]).toHaveValue(2025);
  });

  it('uses provided valueMin/valueMax when set', () => {
    render(
      <FacetRangeSlider {...defaultProps} valueMin={2010} valueMax={2020} />
    );

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs[0]).toHaveValue(2010);
    expect(numberInputs[1]).toHaveValue(2020);
  });

  it('commits null when numeric input value equals the extreme on blur', async () => {
    const onCommit = jest.fn();
    const user = userEvent.setup();
    render(
      <FacetRangeSlider
        {...defaultProps}
        onCommit={onCommit}
        valueMin={2010}
        valueMax={2025}
      />
    );

    const minInput = screen.getByLabelText('Minimum year');
    await user.clear(minInput);
    await user.type(minInput, '2000');
    fireEvent.blur(minInput);

    // When min input equals the overall min (2000), commit null for that bound
    expect(onCommit).toHaveBeenCalledWith(null, null);
  });

  it('reverts invalid numeric input on blur', async () => {
    const user = userEvent.setup();
    render(
      <FacetRangeSlider {...defaultProps} valueMin={2010} valueMax={2020} />
    );

    const minInput = screen.getByLabelText('Minimum year');
    await user.clear(minInput);
    await user.type(minInput, 'abc');
    fireEvent.blur(minInput);

    // Should revert to last known value
    expect(minInput).toHaveValue(2010);
  });

  it('syncs internal state when external values change', () => {
    const { rerender } = render(
      <FacetRangeSlider {...defaultProps} valueMin={2010} valueMax={2020} />
    );

    rerender(
      <FacetRangeSlider {...defaultProps} valueMin={2015} valueMax={2023} />
    );

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs[0]).toHaveValue(2015);
    expect(numberInputs[1]).toHaveValue(2023);
  });

  it('calls onCommit with null bounds when slider released at extremes', () => {
    const onCommit = jest.fn();
    render(
      <FacetRangeSlider
        {...defaultProps}
        onCommit={onCommit}
        valueMin={2000}
        valueMax={2025}
      />
    );

    const minThumb = screen.getByTestId('slider-thumb-min');
    fireEvent.change(minThumb, { target: { value: '2000' } });
    fireEvent.mouseUp(minThumb, { target: { value: '2000' } });

    // Both at extremes → both null
    expect(onCommit).toHaveBeenCalledWith(null, null);
  });

  it('supports decimal places for rating-style usage', () => {
    render(
      <FacetRangeSlider
        min={0}
        max={10}
        step={0.5}
        valueMin={3.5}
        valueMax={8.5}
        onCommit={jest.fn()}
        decimalPlaces={1}
      />
    );

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs[0]).toHaveValue(3.5);
    expect(numberInputs[1]).toHaveValue(8.5);
  });
});
