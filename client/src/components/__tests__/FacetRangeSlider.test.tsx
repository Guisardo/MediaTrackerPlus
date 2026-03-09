import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacetRangeSlider } from '../Facets/FacetRangeSlider';

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

  it('renders two range inputs and two numeric inputs', () => {
    render(<FacetRangeSlider {...defaultProps} />);

    const rangeInputs = screen.getAllByRole('slider');
    expect(rangeInputs).toHaveLength(2);

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs).toHaveLength(2);
  });

  it('renders with accessible labels', () => {
    render(<FacetRangeSlider {...defaultProps} />);

    expect(screen.getAllByLabelText('Minimum year')).toHaveLength(2); // range + number
    expect(screen.getAllByLabelText('Maximum year')).toHaveLength(2);
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

    const minInput = screen.getAllByRole('spinbutton')[0];
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

    const minInput = screen.getAllByRole('spinbutton')[0];
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

  it('renders the active range fill between thumbs', () => {
    const { container } = render(
      <FacetRangeSlider {...defaultProps} valueMin={2005} valueMax={2020} />
    );

    // The active fill div should have a left offset and width based on the range
    const rangeFill = container.querySelector('.bg-blue-500');
    expect(rangeFill).toBeInTheDocument();
    expect(rangeFill).toHaveStyle({ left: '20%', width: '60%' });
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
