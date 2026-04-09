import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RelatedContentItem } from 'mediatracker-api';

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    Trans: ({ children, message, id }: any) =>
      React.createElement(
        React.Fragment,
        null,
        children ?? message ?? id ?? null
      ),
  };
});

jest.mock('@lingui/react', () => {
  const React = require('react');
  return {
    useLingui: () => ({
      i18n: {
        _: (msg: any) =>
          typeof msg === 'string' ? msg : msg?.message || msg?.id || '',
        locale: 'en',
      },
    }),
    Trans: ({ children, message, id }: any) =>
      React.createElement(
        React.Fragment,
        null,
        children ?? message ?? id ?? null
      ),
    I18nProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('src/components/Poster', () => ({
  Poster: ({ src }: { src?: string }) => (
    <div data-testid="related-content-poster">{src ?? 'no-poster'}</div>
  ),
}));

import { DetailsRelatedContentSection } from 'src/components/DetailsRelatedContentSection';

const renderSection = (relatedContent?: RelatedContentItem[] | null) =>
  render(
    <MemoryRouter>
      <DetailsRelatedContentSection relatedContent={relatedContent} />
    </MemoryRouter>
  );

describe('DetailsRelatedContentSection', () => {
  it('renders nothing when related content is missing', () => {
    const { container } = renderSection(undefined);

    expect(container.firstChild).toBeNull();
  });

  it('renders internal detail links for related content items', () => {
    renderSection([
      {
        id: 101,
        title: 'Related Movie',
        mediaType: 'movie',
        posterSmall: '/img/101-small',
        releaseDate: '2024-04-12',
        source: 'tmdb',
      },
      {
        id: 202,
        title: 'Related Show',
        mediaType: 'tv',
        posterSmall: '/img/202-small',
        releaseDate: '2023-01-18',
        source: 'tmdb',
      },
    ]);

    expect(screen.getByTestId('related-content-section')).toBeInTheDocument();
    expect(screen.getByText('Related content')).toBeInTheDocument();
    expect(screen.getByTestId('related-content-link-101')).toHaveAttribute(
      'href',
      '/details/101'
    );
    expect(screen.getByTestId('related-content-link-202')).toHaveAttribute(
      'href',
      '/details/202'
    );
    expect(screen.getAllByTestId('related-content-poster')).toHaveLength(2);
  });

  it('renders safely when poster and release date are missing', () => {
    renderSection([
      {
        id: 303,
        title:
          'A very long related title that should still render without breaking the card layout',
        mediaType: 'video_game',
      },
    ]);

    expect(
      screen.getByText(
        'A very long related title that should still render without breaking the card layout'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('related-content-link-303')).toHaveAttribute(
      'href',
      '/details/303'
    );
    expect(screen.getByText('Video game')).toBeInTheDocument();
    expect(screen.getByTestId('related-content-poster')).toHaveTextContent(
      'no-poster'
    );
  });
});
