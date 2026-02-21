import { t, Trans } from '@lingui/macro';
import { GenreSummeryResponse } from 'mediatracker-api';
import React from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';

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
        <div className="flex flex-wrap">
          {rountes.map((route) => {
            const type = route.type;
            return (
              data[type] && (
                <div className="mb-6 mr-6">
                  <div className="text-lg font-bold">
                    <div>
                      <Trans>{route.name}</Trans>
                    </div>
                  </div>
                  <div className="whitespace-nowrap">
                    {data[type].map((item) => {
                      return (
                        <div key={item.genre}>
                          <div
                            className="hover:underline hover:cursor-pointer"
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
                </div>
              )
            );
          })}
        </div>
      )}
    </>
  );
};

export default StatisticsGenreSegment;
