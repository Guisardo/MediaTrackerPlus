/**
 * Tests for the SettingsSegment component defined in
 * src/components/SettingsSegment.tsx.
 *
 * The component renders a titled container that optionally makes the title a
 * hyperlink when an `href` prop is supplied.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingsSegment } from '../SettingsSegment';

describe('SettingsSegment', () => {
  // -------------------------------------------------------------------------
  // Title rendering
  // -------------------------------------------------------------------------

  it('renders the title text', () => {
    render(<SettingsSegment title="General Settings" />);

    expect(screen.getByText('General Settings')).toBeInTheDocument();
  });

  it('renders the title as a plain element (no link) when href is not provided', () => {
    render(<SettingsSegment title="General Settings" />);

    // There must be no anchor element wrapping the title
    const link = screen.queryByRole('link');
    expect(link).not.toBeInTheDocument();
  });

  it('renders the title as an anchor element when href is provided', () => {
    render(<SettingsSegment title="External Link" href="https://example.com" />);

    const link = screen.getByRole('link', { name: 'External Link' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('applies the underline class to the anchor when href is provided', () => {
    render(<SettingsSegment title="Link Title" href="/settings/advanced" />);

    const link = screen.getByRole('link', { name: 'Link Title' });
    expect(link.className).toContain('underline');
  });

  // -------------------------------------------------------------------------
  // Children rendering
  // -------------------------------------------------------------------------

  it('renders children inside the segment', () => {
    render(
      <SettingsSegment title="My Section">
        <p>Child content here</p>
      </SettingsSegment>
    );

    expect(screen.getByText('Child content here')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <SettingsSegment title="Multi-child">
        <span>First child</span>
        <span>Second child</span>
      </SettingsSegment>
    );

    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
  });

  it('renders without children (no error)', () => {
    // Should not throw
    expect(() => render(<SettingsSegment title="Empty Section" />)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // DOM structure
  // -------------------------------------------------------------------------

  it('wraps everything in a container div', () => {
    const { container } = render(
      <SettingsSegment title="Structured">
        <p>Content</p>
      </SettingsSegment>
    );

    // The outermost element should be a <div>
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('applies border and rounded styles to the container', () => {
    const { container } = render(<SettingsSegment title="Styled" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain('border');
    expect(outerDiv.className).toContain('rounded');
  });

  it('applies the font-semibold class to the title element', () => {
    render(<SettingsSegment title="Semibold Title" />);

    const titleEl = screen.getByText('Semibold Title');
    expect(titleEl.className).toContain('font-semibold');
  });

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  it('matches a stable snapshot for the basic (no href) case', () => {
    const { container } = render(
      <SettingsSegment title="Snapshot Test">
        <button>Action</button>
      </SettingsSegment>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches a stable snapshot for the linked (href) case', () => {
    const { container } = render(
      <SettingsSegment title="Linked Snapshot" href="/docs">
        <p>Some content</p>
      </SettingsSegment>
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
