import { t, Trans } from '@lingui/macro';
import { GenreSummeryResponse } from 'mediatracker-api';
import React from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from 'src/components/ui/card';

const StatisticsGenreSegment = (props: {
  data: GenreSummeryResponse;
  year: string;
}) => {
  const { data, year } = props;

  const navigate = useNavigate();

  const rountes = [
    { path: '/statistics/genre/tv/', name: t`Tv`, type: 'tv' },
    { path: '/statistics/genre/movie/', name: t`Movies`, type: 'movie' },
    {
      path: '/statistics/genre/video_game/',
      name: t`Games`,
      type: 'video_game',
    },
    //   { path: '/genre/books/', name: t`Books`, type: 'book' },
    //  { path: '/genre/audiobooks/', name: t`Audiobooks`, type: 'audiobook' },
  ];

  return (
    <>
      {data && (
        <div className="flex flex-wrap gap-4">
          {rountes.map((route) => {
            const type = route.type;
            return (
              data[type] && (
                <Card
                  key={type}
                  className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="text-lg font-semibold mb-2">
                      <div className="text-zinc-900 dark:text-zinc-50">
                        <Trans>{route.name}</Trans>
                      </div>
                    </div>
                    <div className="whitespace-nowrap">
                      {data[type].map((item) => {
                        return (
                          <div key={item.genre}>
                            <div
                              className="hover:underline hover:cursor-pointer text-sm text-zinc-600 dark:text-zinc-400"
                              onClick={() =>
                                navigate({
                                  pathname: route.path,
                                  search: createSearchParams({
                                    year: year,
                                    genre: item.genre,
                                  }).toString(),
                                })
                              }
                            >
                              <Trans>
                                <b>{item.genre}</b> (<b>{item.count}</b>)
                              </Trans>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            );
          })}
        </div>
      )}
    </>
  );
};

export default StatisticsGenreSegment;
