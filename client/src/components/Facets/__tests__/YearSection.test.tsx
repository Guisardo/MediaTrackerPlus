import React from 'react';
import { render, screen } from '@testing-library/react';
import { YearSection } from '../YearSection';

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string' ? strings : strings.raw ? String.raw(strings, ...values) : strings[0],
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('src/components/Facets/FacetSection', () => {
  const React = require('react');
  return {
    FacetSection: ({ title, hasActiveSelection, children }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'facet-section', 'data-active': String(hasActiveSelection) },
        React.createElement('span', { 'data-testid': 'facet-title' }, title),
        children
      ),
  };
});

jest.mock('src/components/Facets/FacetRangeSlider', () => {
  const React = require('react');
  return {
    FacetRangeSlider: ({ min, max, step, valueMin, valueMax, onCommit, decimalPlaces }: any) =>
      React.createElement('div', {
        'data-testid': 'facet-range-slider',
        'data-min': min,
        'data-max': max,
        'data-step': step,
        'data-value-min': valueMin ?? '',
        'data-value-max': valueMax ?? '',
        'data-decimal-places': decimalPlaces,
        onClick: () => onCommit(2000, 2024),
      }),
  };
});

const mockYears = [
  { value: '2024', count: 10 },
  { value: '2020', count: 5 },
  { value: '2015', count: 3 },
];

describe('YearSection', () => {
  it('renders nothing when years array is empty', () => {
    const { container } = render(
      React.createElement(YearSection, {
        years: [],
        yearMin: null,
        yearMax: null,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders FacetSection with Year title when years are provided', () => {
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: null,
        yearMax: null,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section')).toBeInTheDocument();
    expect(screen.getByTestId('facet-title').textContent).toBe('Year');
  });

  it('renders FacetRangeSlider with correct min/max derived from years', () => {
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: null,
        yearMax: null,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    const slider = screen.getByTestId('facet-range-slider');
    expect(slider.getAttribute('data-min')).toBe('2015');
    expect(slider.getAttribute('data-max')).toBe('2024');
    expect(slider.getAttribute('data-step')).toBe('1');
    expect(slider.getAttribute('data-decimal-places')).toBe('0');
  });

  it('sets hasActiveSelection to false when yearMin and yearMax are null', () => {
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: null,
        yearMax: null,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section').getAttribute('data-active')).toBe('false');
  });

  it('sets hasActiveSelection to true when yearMin is set', () => {
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: 2020,
        yearMax: null,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section').getAttribute('data-active')).toBe('true');
  });

  it('sets hasActiveSelection to true when yearMax is set', () => {
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: null,
        yearMax: 2022,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section').getAttribute('data-active')).toBe('true');
  });

  it('passes yearMin and yearMax values to slider', () => {
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: 2018,
        yearMax: 2023,
        setYearMin: jest.fn(),
        setYearMax: jest.fn(),
      })
    );
    const slider = screen.getByTestId('facet-range-slider');
    expect(slider.getAttribute('data-value-min')).toBe('2018');
    expect(slider.getAttribute('data-value-max')).toBe('2023');
  });

  it('calls setYearMin and setYearMax when slider commits', () => {
    const setYearMin = jest.fn();
    const setYearMax = jest.fn();
    render(
      React.createElement(YearSection, {
        years: mockYears,
        yearMin: null,
        yearMax: null,
        setYearMin,
        setYearMax,
      })
    );
    screen.getByTestId('facet-range-slider').click();
    expect(setYearMin).toHaveBeenCalledWith(2000);
    expect(setYearMax).toHaveBeenCalledWith(2024);
  });
});
