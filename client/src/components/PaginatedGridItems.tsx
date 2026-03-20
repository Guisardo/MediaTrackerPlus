import React, {
  FormEventHandler,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { Plural, Trans } from '@lingui/macro';

import { useSearch } from 'src/api/search';
import { Items } from 'mediatracker-api';
import { useItems } from 'src/api/items';
import { useFacetsData } from 'src/api/facets';
import { GridItemAppearanceArgs, GridItem } from 'src/components/GridItem';
import { useOrderByComponent } from 'src/components/OrderBy';
import { useGroupSelectorComponent } from 'src/components/GroupSelector';
import { useFilterBy } from 'src/components/FilterBy';
import { useUpdateSearchParams } from 'src/hooks/updateSearchParamsHook';
import { useFacets } from 'src/hooks/facets';
import {
  FacetPanel,
  FacetDrawer,
  FacetMobileButton,
  ActiveFacetChips,
  GenreSection,
  YearSection,
  RatingSection,
  LanguageSection,
  CreatorSection,
  StatusSection,
  PublisherSection,
  MediaTypeSection,
} from 'src/components/Facets';

type FacetData = NonNullable<ReturnType<typeof useFacetsData>['facetsData']>;
type FacetsState = ReturnType<typeof useFacets>;

const emptyFacets: FacetData = {
  genres: [],
  years: [],
  languages: [],
  creators: [],
  publishers: [],
  mediaTypes: [],
};

const removeSearchParam = (searchParams: URLSearchParams) =>
  Object.fromEntries(
    Array.from(searchParams.entries()).filter(([name]) => name !== 'search')
  );

const renderItemsSummary = (args: {
  searchQuery?: string;
  searchResultLength: number;
  numberOfItemsTotal: number;
  year?: string | number | null;
  genre?: string | null;
}) => {
  const { searchQuery, searchResultLength, numberOfItemsTotal, year, genre } =
    args;

  if (searchQuery) {
    return (
      <Plural
        value={searchResultLength}
        one={
          <Trans>
            Found # item for query &quot;
            <strong>{searchQuery}</strong>&quot;
          </Trans>
        }
        other={
          <Trans>
            Found # items for query &quot;
            <strong>{searchQuery}</strong>&quot;
          </Trans>
        }
      />
    );
  }

  return (
    <Plural
      value={numberOfItemsTotal}
      one={`1 item ${year ? 'in ' + year : ''} ${genre ? 'with genre ' + genre : ''}`}
      other={`# item ${year ? 'in ' + year : ''} ${genre ? 'with genre ' + genre : ''}`}
    />
  );
};

const buildFacetSections = (args: {
  facetData: FacetData;
  facets: FacetsState;
  mediaType?: string;
}) => {
  const { facetData, facets, mediaType } = args;
  const ratings =
    facetData.genres.length > 0 || facetData.years.length > 0
      ? [{ value: '1', count: 1 }]
      : [];

  return (
    <>
      <StatusSection
        selectedStatus={facets.status}
        setStatus={facets.setStatus}
        mediaType={mediaType}
      />
      <GenreSection
        genres={facetData.genres}
        selectedGenres={facets.genres}
        setGenres={facets.setGenres}
      />
      <YearSection
        years={facetData.years}
        yearMin={facets.yearMin}
        yearMax={facets.yearMax}
        setYearMin={facets.setYearMin}
        setYearMax={facets.setYearMax}
      />
      <RatingSection
        ratings={ratings}
        ratingMin={facets.ratingMin}
        ratingMax={facets.ratingMax}
        setRatingMin={facets.setRatingMin}
        setRatingMax={facets.setRatingMax}
      />
      <LanguageSection
        languages={facetData.languages}
        selectedLanguages={facets.languages}
        setLanguages={facets.setLanguages}
      />
      <CreatorSection
        creators={facetData.creators}
        selectedCreators={facets.creators}
        setCreators={facets.setCreators}
        mediaType={mediaType}
      />
      <PublisherSection
        publishers={facetData.publishers}
        selectedPublishers={facets.publishers}
        setPublishers={facets.setPublishers}
        mediaType={mediaType}
      />
      <MediaTypeSection
        mediaTypes={facetData.mediaTypes}
        selectedMediaTypes={facets.mediaTypes}
        setMediaTypes={facets.setMediaTypes}
        mediaType={mediaType}
      />
    </>
  );
};

const Search: FunctionComponent<{
  onSearch: (value: string) => void;
}> = (props) => {
  const [params] = useSearchParams();
  const { onSearch } = props;
  const [textInputValue, setTextInputValue] = useState<string>('');

  useEffect(() => onSearch(params.get('search') || ''), [params, onSearch]);

  const onFormSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    onSearch(textInputValue);
  };

  return (
    <form onSubmit={onFormSubmit} className="flex justify-center w-full mb-6">
      <input
        type="text"
        value={textInputValue}
        onChange={(e) => setTextInputValue(e.target.value)}
        className="w-full"
      />

      <button className="px-4 ml-2 transition-shadow duration-100 hover:shadow hover:shadow-indigo-500/50">
        <Trans>Search</Trans>
      </button>
    </form>
  );
};

export const Pagination: FunctionComponent<{
  numberOfPages: number;
  page: number;
  setPage: (value: number) => void;
}> = (props) => {
  const { numberOfPages, page, setPage } = props;
  return (
    <div className="flex flex-wrap justify-center w-full my-3">
      {Array.from(new Array(numberOfPages).keys())
        .map((value) => value + 1)
        .map((_page) => (
          <div
            key={_page}
            className={clsx(
              'm-2 px-2 py-1 bg-red-500 rounded cursor-pointer select-none ',
              {
                'bg-blue-500': _page === page,
              }
            )}
            onClick={() => setPage(_page)}
          >
            {_page}
          </div>
        ))}
    </div>
  );
};

export const PaginatedGridItems: FunctionComponent<{
  args: Omit<Items.Paginated.RequestQuery, 'page' | 'filter'>;
  showSortOrderControls?: boolean;
  isStatisticsPage?: boolean;
  showSearch?: boolean;
  gridItemAppearance?: GridItemAppearanceArgs;
  /**
   * When true, the FacetPanel is rendered alongside the grid and the Status
   * facet section replaces the FilterByComponent dropdown in the toolbar.
   * When false (default), FilterByComponent continues to render unchanged.
   */
  showFacets?: boolean;
}> = (props) => {
  const {
    args,
    showSortOrderControls,
    showSearch,
    gridItemAppearance,
    showFacets,
  } = props;

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { currentValue, updateSearchParams } = useUpdateSearchParams<number>({
    filterParam: 'page',
    initialValue: 1,
    resetPage: false,
  });
  const [page, _setPage] = useState<number>(Number(currentValue ?? 1));
  const orderByArg = args.orderBy ?? 'title';
  const sortOrderArg = args.sortOrder ?? 'asc';
  const mediaTypeArg = args.mediaType ?? undefined;
  const filterMediaType = mediaTypeArg ?? 'movie';

  const handleArgumentChange = useCallback(() => {
    if (page != 1) {
      _setPage(1);
      window.document.body.scrollIntoView({ behavior: 'auto' });
    }
  }, [page]);

  const { orderBy, sortOrder, OrderByComponent } = useOrderByComponent({
    sortOrder: sortOrderArg,
    orderBy: orderByArg,
    mediaType: mediaTypeArg,
    handleFilterChange: handleArgumentChange,
  });

  const { selectedGroupId, GroupSelectorComponent } = useGroupSelectorComponent({
    orderBy,
    handleFilterChange: handleArgumentChange,
  });

  // useFilterBy hook must remain unconditional (React hooks rules).
  // When showFacets=true, the FilterByComponent JSX is suppressed, but the
  // hook still runs to avoid breaking hook call order.
  const { filter, FilterByComponent } = useFilterBy(
    filterMediaType,
    props.isStatisticsPage ?? false,
    handleArgumentChange
  );

  // useFacets hook must remain unconditional (React hooks rules).
  // When showFacets=false, the facets state is not used.
  const facets = useFacets(handleArgumentChange);

  // Build the items query args: merge static page args, filter (when not using
  // facets), and facet params (when showFacets=true).
  const itemsQueryArgs: Items.Paginated.RequestQuery = {
    ...args,
    ...(showFacets ? facets.facetParams : filter),
    page: page,
    orderBy: orderBy,
    sortOrder: sortOrder,
    ...(selectedGroupId !== undefined ? { groupId: selectedGroupId } : {}),
  };

  const {
    isLoading: isLoadingItems,
    items,
    numberOfPages,
    numberOfItemsTotal,
  } = useItems(itemsQueryArgs);

  // Facets API query: runs in parallel with items query when showFacets=true.
  // staleTime=30000 is set in useFacetsData; keepPreviousData prevents flash.
  const facetsQueryArgs: Items.Facets.RequestQuery = {
    ...args,
    ...facets.facetParams,
    mediaType: mediaTypeArg,
    orderBy: orderBy,
    ...(selectedGroupId !== undefined ? { groupId: selectedGroupId } : {}),
  };

  const { facetsData } = useFacetsData(facetsQueryArgs, Boolean(showFacets));

  const {
    items: searchResult,
    isLoading: isLoadingSearchResult,
    search,
  } = useSearch();

  useEffect(() => {
    const trimmedSearchQuery = searchQuery?.trim();

    if (trimmedSearchQuery === '') {
      setSearchQuery(undefined);
      setSearchParams(removeSearchParam(searchParams));
      return;
    }

    if (searchQuery) {
      setSearchParams({
        search: searchQuery,
      });
      if (!mediaTypeArg) {
        return;
      }

      search({ mediaType: mediaTypeArg, query: searchQuery });
      _setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaTypeArg, searchQuery]);

  const isLoading = isLoadingSearchResult || isLoadingItems;
  // When showFacets is true, the status facet replaces FilterByComponent so we
  // should not gate on filter object keys for the noItems display.
  const noItems =
    !isLoading &&
    !searchQuery &&
    items.length === 0 &&
    (showFacets
      ? facets.activeFacetCount === 0
      : Object.keys(filter).length === 0);

  const facetData = facetsData ?? emptyFacets;

  // The facet sections rendered inside both the sidebar and the mobile drawer.
  const facetSections = showFacets
    ? buildFacetSections({
        facetData,
        facets,
        mediaType: mediaTypeArg,
      })
    : null;

  return (
    <>
      <div className="flex justify-center w-full">
        {/* Desktop facet sidebar — hidden on < 1024px */}
        {showFacets && (
          <FacetPanel facets={facets}>{facetSections}</FacetPanel>
        )}

        <div className="flex flex-row flex-wrap items-grid flex-1 min-w-0">
          <div className="mb-1 header w-full">
            {showSearch && mediaTypeArg && (
              <Search onSearch={setSearchQuery} />
            )}

            {showSearch && noItems ? (
              <div className="flex ali">
                <Trans>
                  Search for items or&nbsp;
                  <Link to="/import" className="link">
                    import
                  </Link>
                </Trans>
              </div>
            ) : (
              <>
                {!isLoading && (
                  <div className="flex">
                    <div>
                      {renderItemsSummary({
                        searchQuery,
                        searchResultLength: searchResult?.length ?? 0,
                        numberOfItemsTotal: numberOfItemsTotal ?? 0,
                        year: args.year,
                        genre: args.genre,
                      })}
                    </div>

                    {/* Mobile Filters button — shown when showFacets=true, regardless of sort controls */}
                    {showFacets && !searchQuery && (
                      <FacetMobileButton
                        activeFacetCount={facets.activeFacetCount}
                        onClick={() => setDrawerOpen(true)}
                      />
                    )}

                    {showSortOrderControls && !searchQuery && (
                      <>
                        {/* FilterByComponent — shown only when showFacets=false */}
                        {!showFacets && (
                          <div className="flex ml-auto">
                            <FilterByComponent />
                          </div>
                        )}
                        &nbsp;
                        <div className="">
                          <OrderByComponent />
                        </div>
                        <GroupSelectorComponent />
                      </>
                    )}
                  </div>
                )}

                {/* Active facet chips row — rendered between toolbar and grid */}
                {showFacets && (
                  <ActiveFacetChips
                    facets={facets}
                    mediaType={mediaTypeArg}
                  />
                )}
              </>
            )}
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center w-full">
              <div className="">
                <Trans>Loading</Trans>
              </div>
            </div>
          ) : (
            <>
              {(searchQuery ? searchResult : items)?.map((mediaItem) => (
                <div key={mediaItem.id} className="w-40 mr-2 mb-2">
                  <GridItem
                    mediaType={mediaTypeArg}
                    mediaItem={mediaItem}
                    appearance={{
                      ...gridItemAppearance,
                      showAddToWatchlistAndMarkAsSeenButtons:
                        Boolean(searchQuery),
                    }}
                  />
                </div>
              ))}
              <div className="footer">
                {!searchQuery &&
                  items &&
                  !isLoadingItems &&
                  numberOfPages !== undefined &&
                  numberOfPages > 1 && (
                  <Pagination
                    numberOfPages={numberOfPages}
                    page={page}
                    setPage={(value: number) => {
                      _setPage(value);
                      window.document.body.scrollIntoView({ behavior: 'auto' });
                      updateSearchParams(value);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer — Portal-mounted, full FacetPanel content */}
      {showFacets && (
        <FacetDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          facets={facets}
        >
          {facetSections}
        </FacetDrawer>
      )}
    </>
  );
};
