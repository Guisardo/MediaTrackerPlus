import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacetMobileButton } from '../FacetMobileButton';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

describe('FacetMobileButton', () => {
  it('renders the Filters label', () => {
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick: jest.fn(),
      })
    );
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders the tune icon', () => {
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick: jest.fn(),
      })
    );
    expect(screen.getByText('tune')).toBeInTheDocument();
  });

  it('does not render badge when activeFacetCount is 0', () => {
    const { container } = render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick: jest.fn(),
      })
    );
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('renders badge with count when activeFacetCount > 0', () => {
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 3,
        onClick: jest.fn(),
      })
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick,
      })
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Enter keydown', () => {
    const onClick = jest.fn();
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick,
      })
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Space keydown', () => {
    const onClick = jest.fn();
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick,
      })
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has tabIndex 0 for keyboard accessibility', () => {
    render(
      React.createElement(FacetMobileButton, {
        activeFacetCount: 0,
        onClick: jest.fn(),
      })
    );
    expect(screen.getByRole('button').getAttribute('tabindex')).toBe('0');
  });
});
