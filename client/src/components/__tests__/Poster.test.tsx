/**
 * Tests for the Poster component (exported as PosterSpring) defined in
 * src/components/Poster.tsx.
 *
 * The component uses @react-spring/core (useSpring) and @react-spring/web
 * (animated.div) for animations. Both are mocked so that:
 *  - animated.div renders as a plain <div>
 *  - useSpring returns an empty object immediately (no animation frames needed)
 *
 * Tests verify:
 *  - An <img> element is rendered when a src URL is provided
 *  - No <img> element is rendered when src is absent
 *  - A placeholder "?" element is always present in the DOM
 *  - An anchor tag wraps the content when href is provided
 *  - No anchor tag when href is absent
 *  - Correct CSS aspect-ratio class per mediaType:
 *      audiobook  → aspect-[1/1]
 *      video_game → aspect-[3/4]
 *      movie/tv/book/default → aspect-[2/3]
 *  - Children are rendered inside the poster overlay
 *  - The img has draggable="false"
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('clsx', () => (...args: unknown[]) => args.filter(Boolean).join(' '));

// @react-spring/core – useSpring returns an empty style object immediately
jest.mock('@react-spring/core', () => ({
  useSpring: () => ({}),
}));

// @react-spring/web – animated.div is a plain div
jest.mock('@react-spring/web', () => {
  const React = require('react');
  return {
    animated: {
      div: ({
        style: _style,
        ...rest
      }: React.HTMLProps<HTMLDivElement> & { style?: object }) => (
        <div {...rest} />
      ),
    },
  };
});

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { Poster } from 'src/components/Poster';
import type { MediaType } from 'mediatracker-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderPoster = (props: {
  src?: string;
  href?: string;
  mediaType?: MediaType;
  itemMediaType?: MediaType;
  children?: React.ReactNode;
}) => render(<Poster {...props} />);

// ---------------------------------------------------------------------------
// Image rendering
// ---------------------------------------------------------------------------

describe('Poster – image element', () => {
  it('renders an <img> element when src is provided', () => {
    renderPoster({ src: 'https://example.com/poster.jpg' });
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('sets the src attribute on the img element', () => {
    renderPoster({ src: 'https://example.com/poster.jpg' });
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/poster.jpg'
    );
  });

  it('sets draggable="false" on the img element', () => {
    renderPoster({ src: 'https://example.com/poster.jpg' });
    expect(screen.getByRole('img')).toHaveAttribute('draggable', 'false');
  });

  it('does NOT render an <img> element when src is absent', () => {
    renderPoster({});
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('does NOT render an <img> element when src is undefined explicitly', () => {
    renderPoster({ src: undefined });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Placeholder element
// ---------------------------------------------------------------------------

describe('Poster – placeholder element', () => {
  it('renders the "?" placeholder text when no src is provided', () => {
    renderPoster({});
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders the "?" placeholder text even when src is provided (hidden via CSS)', () => {
    // The placeholder div is always in the DOM; its visibility is controlled
    // by CSS opacity transitions, not conditional rendering.
    renderPoster({ src: 'https://example.com/poster.jpg' });
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Anchor / href
// ---------------------------------------------------------------------------

describe('Poster – href link wrapping', () => {
  it('wraps content in an <a> element when href is provided', () => {
    renderPoster({
      src: 'https://example.com/poster.jpg',
      href: '/media/42',
    });

    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/media/42');
  });

  it('does NOT render an <a> element when href is absent', () => {
    renderPoster({ src: 'https://example.com/poster.jpg' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does NOT render an <a> element when href is undefined', () => {
    renderPoster({ src: 'https://example.com/poster.jpg', href: undefined });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// mediaType – aspect ratio classes
// ---------------------------------------------------------------------------

describe('Poster – mediaType aspect ratio (mediaType prop)', () => {
  const getOuterDiv = (container: HTMLElement) =>
    container.firstChild as HTMLElement;

  it('applies aspect-[1/1] class for audiobook mediaType', () => {
    const { container } = renderPoster({ mediaType: 'audiobook' });
    expect(getOuterDiv(container).className).toContain('aspect-[1/1]');
  });

  it('applies aspect-[3/4] class for video_game mediaType', () => {
    const { container } = renderPoster({ mediaType: 'video_game' });
    expect(getOuterDiv(container).className).toContain('aspect-[3/4]');
  });

  it('applies aspect-[2/3] class for movie mediaType', () => {
    const { container } = renderPoster({ mediaType: 'movie' });
    expect(getOuterDiv(container).className).toContain('aspect-[2/3]');
  });

  it('applies aspect-[2/3] class for tv mediaType', () => {
    const { container } = renderPoster({ mediaType: 'tv' });
    expect(getOuterDiv(container).className).toContain('aspect-[2/3]');
  });

  it('applies aspect-[2/3] class for book mediaType', () => {
    const { container } = renderPoster({ mediaType: 'book' });
    expect(getOuterDiv(container).className).toContain('aspect-[2/3]');
  });

  it('applies aspect-[2/3] class when mediaType is undefined (default)', () => {
    const { container } = renderPoster({});
    expect(getOuterDiv(container).className).toContain('aspect-[2/3]');
  });
});

// ---------------------------------------------------------------------------
// itemMediaType – applies the aspect ratio class to the inner wrapper
// ---------------------------------------------------------------------------

describe('Poster – itemMediaType aspect ratio (itemMediaType prop)', () => {
  it('applies aspect-[1/1] to the inner wrapper for audiobook itemMediaType', () => {
    const { container } = renderPoster({ itemMediaType: 'audiobook' });
    // The inner div (second level) picks up the itemMediaType class
    const innerDivs = container.querySelectorAll('div');
    const hasAspect = Array.from(innerDivs).some((div) =>
      div.className.includes('aspect-[1/1]')
    );
    expect(hasAspect).toBe(true);
  });

  it('applies aspect-[3/4] to the inner wrapper for video_game itemMediaType', () => {
    const { container } = renderPoster({ itemMediaType: 'video_game' });
    const innerDivs = container.querySelectorAll('div');
    const hasAspect = Array.from(innerDivs).some((div) =>
      div.className.includes('aspect-[3/4]')
    );
    expect(hasAspect).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

describe('Poster – children', () => {
  it('renders children inside the poster overlay', () => {
    renderPoster({
      src: 'https://example.com/poster.jpg',
      children: <span data-testid="badge">NEW</span>,
    });

    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByTestId('badge').textContent).toBe('NEW');
  });

  it('renders multiple children', () => {
    renderPoster({
      children: (
        <>
          <span data-testid="child-1">Rating</span>
          <span data-testid="child-2">Badge</span>
        </>
      ),
    });

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Image load / error state
// ---------------------------------------------------------------------------

describe('Poster – image load state', () => {
  it('fires the onLoad handler without throwing', () => {
    renderPoster({ src: 'https://example.com/poster.jpg' });
    const img = screen.getByRole('img');
    // Should not throw
    expect(() => fireEvent.load(img)).not.toThrow();
  });

  it('fires the onError handler without throwing', () => {
    renderPoster({ src: 'https://example.com/broken.jpg' });
    const img = screen.getByRole('img');
    // Should not throw
    expect(() => fireEvent.error(img)).not.toThrow();
  });
});
