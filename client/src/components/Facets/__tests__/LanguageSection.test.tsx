import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSection } from '../LanguageSection';

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string' ? strings : strings.raw ? String.raw(strings, ...values) : strings[0],
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('src/components/Facets/FacetSection', () => {
  const React = require('react');
  return {
    FacetSection: ({ title, children }: any) =>
      React.createElement('div', { 'data-testid': 'facet-section' },
        React.createElement('span', { 'data-testid': 'facet-title' }, title),
        children
      ),
  };
});

jest.mock('src/components/Facets/ExpandableList', () => {
  const React = require('react');
  return {
    ExpandableList: ({ items, children }: any) =>
      React.createElement('div', { 'data-testid': 'expandable-list' }, children(items)),
  };
});

const mockLanguages = [
  { value: 'en', count: 30 },
  { value: 'fr', count: 10 },
];

describe('LanguageSection', () => {
  it('renders nothing when languages array is empty', () => {
    const { container } = render(
      React.createElement(LanguageSection, {
        languages: [],
        selectedLanguages: [],
        setLanguages: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when only one language is present', () => {
    const { container } = render(
      React.createElement(LanguageSection, {
        languages: [{ value: 'en', count: 30 }],
        selectedLanguages: [],
        setLanguages: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders FacetSection with Language title when multiple languages exist', () => {
    render(
      React.createElement(LanguageSection, {
        languages: mockLanguages,
        selectedLanguages: [],
        setLanguages: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Language');
  });

  it('renders checkbox items for each language', () => {
    render(
      React.createElement(LanguageSection, {
        languages: mockLanguages,
        selectedLanguages: [],
        setLanguages: jest.fn(),
      })
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('marks pre-selected languages as checked', () => {
    render(
      React.createElement(LanguageSection, {
        languages: mockLanguages,
        selectedLanguages: ['en'],
        setLanguages: jest.fn(),
      })
    );
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const enCheckbox = checkboxes.find((cb) => cb.id === 'facet-checkbox-en');
    expect(enCheckbox?.checked).toBe(true);
  });

  it('calls setLanguages with value added when unchecked checkbox is toggled', () => {
    const setLanguages = jest.fn();
    render(
      React.createElement(LanguageSection, {
        languages: mockLanguages,
        selectedLanguages: [],
        setLanguages,
      })
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(setLanguages).toHaveBeenCalled();
  });

  it('calls setLanguages with value removed when checked checkbox is toggled', () => {
    const setLanguages = jest.fn();
    render(
      React.createElement(LanguageSection, {
        languages: mockLanguages,
        selectedLanguages: ['en'],
        setLanguages,
      })
    );
    const enCheckbox = screen.getAllByRole('checkbox').find(
      (cb) => (cb as HTMLInputElement).id === 'facet-checkbox-en'
    ) as HTMLInputElement;
    fireEvent.click(enCheckbox);
    expect(setLanguages).toHaveBeenCalledWith([]);
  });

  it('shows count for each language', () => {
    render(
      React.createElement(LanguageSection, {
        languages: mockLanguages,
        selectedLanguages: [],
        setLanguages: jest.fn(),
      })
    );
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
