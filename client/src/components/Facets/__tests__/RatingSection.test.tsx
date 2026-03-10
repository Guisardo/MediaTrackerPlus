import React from 'react';
import { render, screen } from '@testing-library/react';
import { RatingSection } from '../RatingSection';

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string' ? strings : strings.raw ? String.raw(strings, ...values) : strings[0],
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('src/components/Facets/FacetSection', () => {
  const React = require('react');
  return {
    FacetSection: ({ title, hasActiveSelection, children }: any) =>
      React.createElement('div', { 'data-testid': 'facet-section', 'data-active': String(hasActiveSelection) },
        React.createElement('span', { 'data-testid': 'facet-title' }, title),
        children
      ),
  };
});

jest.mock('src/components/Facets/FacetRangeSlider', () => {
  const React = require('react');
  return {
    FacetRangeSlider: ({ min, max, step, valueMin, valueMax, minInputLabel, maxInputLabel }: any) =>
      React.createElement('div', {
        'data-testid': 'facet-range-slider',
        'data-min': min,
        'data-max': max,
        'data-step': step,
        'data-value-min': valueMin,
        'data-value-max': valueMax,
        'data-min-label': minInputLabel,
        'data-max-label': maxInputLabel,
      }),
  };
});

const mockRatings = [
  { value: '7', count: 15 },
  { value: '8', count: 10 },
];

describe('RatingSection', () => {
  it('renders nothing when ratings array is empty', () => {
    const { container } = render(
      React.createElement(RatingSection, {
        ratings: [],
        ratingMin: null,
        ratingMax: null,
        setRatingMin: jest.fn(),
        setRatingMax: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders FacetSection with Rating title when ratings are provided', () => {
    render(
      React.createElement(RatingSection, {
        ratings: mockRatings,
        ratingMin: null,
        ratingMax: null,
        setRatingMin: jest.fn(),
        setRatingMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Rating');
  });

  it('renders FacetRangeSlider with correct props', () => {
    render(
      React.createElement(RatingSection, {
        ratings: mockRatings,
        ratingMin: 3,
        ratingMax: 8,
        setRatingMin: jest.fn(),
        setRatingMax: jest.fn(),
      })
    );
    const slider = screen.getByTestId('facet-range-slider');
    expect(slider.getAttribute('data-min')).toBe('0');
    expect(slider.getAttribute('data-max')).toBe('10');
    expect(slider.getAttribute('data-step')).toBe('0.5');
    expect(slider.getAttribute('data-value-min')).toBe('3');
    expect(slider.getAttribute('data-value-max')).toBe('8');
  });

  it('has no active selection when both min and max are null', () => {
    render(
      React.createElement(RatingSection, {
        ratings: mockRatings,
        ratingMin: null,
        ratingMax: null,
        setRatingMin: jest.fn(),
        setRatingMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section').getAttribute('data-active')).toBe('false');
  });

  it('has active selection when ratingMin is set', () => {
    render(
      React.createElement(RatingSection, {
        ratings: mockRatings,
        ratingMin: 5,
        ratingMax: null,
        setRatingMin: jest.fn(),
        setRatingMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section').getAttribute('data-active')).toBe('true');
  });

  it('has active selection when ratingMax is set', () => {
    render(
      React.createElement(RatingSection, {
        ratings: mockRatings,
        ratingMin: null,
        ratingMax: 9,
        setRatingMin: jest.fn(),
        setRatingMax: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section').getAttribute('data-active')).toBe('true');
  });
});
