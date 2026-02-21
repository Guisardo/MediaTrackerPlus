import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUpdateSearchParams } from './updateSearchParamsHook';

export const usePagination = (args: {
  itemsPerPage: number;
  totalItems: number;
}) => {
  const { currentValue } = useUpdateSearchParams<number>({
    filterParam: 'page',
    initialValue: 1,
    resetPage: false,
  });
  const [page, setPage] = useState(Number.parseInt(currentValue.toString()));
  const [searchParams, setSearchParams] = useSearchParams();
  const numberOfPages = Math.ceil(args.totalItems / args.itemsPerPage);

  console.log(page);

  useEffect(() => {
    if (page > numberOfPages) {
      setPage(1);
    }
  }, [page, numberOfPages]);

  useEffect(() => {
    window.document.body.scrollIntoView({ behavior: 'auto' });

    if (page === 1) {
      setSearchParams(
        Object.fromEntries(
          Array.from(searchParams.entries()).filter(([name]) => name !== 'page')
        ),
        { replace: true }
      );
    } else {
      setSearchParams(
        {
          ...Object.fromEntries(searchParams.entries()),
          page: page.toString(),
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return useMemo(() => {
    const from = args.itemsPerPage * (page - 1);
    const to = args.itemsPerPage * (page - 1) + args.itemsPerPage;
    const getPaginatedItems = <T,>(items?: Array<T>) => items?.slice(from, to);
    const showPaginationComponent = numberOfPages > 1;

    return {
      currentPage: page,
      numberOfPages,
      getPaginatedItems,
      setPage,
      showPaginationComponent,
    };
  }, [args.itemsPerPage, page, numberOfPages]);
};
