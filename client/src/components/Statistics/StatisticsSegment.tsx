import { Trans } from '@lingui/macro';
import { FormatDuration } from 'src/components/date';
import React from 'react';
import { StatisticsSummaryResponse } from 'mediatracker-api';
import { createSearchParams, useNavigate } from 'react-router-dom';

const StatisticsSegmant = (props: {
  data: StatisticsSummaryResponse;
  year?: string;
}) => {
  const { data, year } = props;
  const navigate = useNavigate();
  return (
    <>
      {data && (
        <div className="flex flex-wrap">
          {data.tv?.plays > 0 && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <div
                  className="hover:underline hover:cursor-pointer"
                  onClick={() =>
                    navigate({
                      pathname: '/statistics/seen/tv',
                      search: year
                        ? createSearchParams({
                            year: year,
                          }).toString()
                        : '',
                    })
                  }
                >
                  <Trans>Tv</Trans>
                </div>
              </div>
              {data.tv.duration > 0 && (
                <div className="whitespace-nowrap">
                  <Trans>
                    <b>
                      <FormatDuration
                        milliseconds={data.tv.duration * 60 * 1000}
                      />{' '}
                    </b>
                    watching
                  </Trans>
                </div>
              )}
              <div className="whitespace-nowrap">
                <Trans>
                  <b>{data.tv.episodes}</b> episodes (<b>{data.tv.plays}</b>{' '}
                  plays of <b>{data.tv.items}</b> shows)
                </Trans>
              </div>
            </div>
          )}
          {data.movie?.plays > 0 && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <div
                  className="hover:underline hover:cursor-pointer"
                  onClick={() =>
                    navigate({
                      pathname: '/statistics/seen/movie',
                      search: year
                        ? createSearchParams({
                            year: year,
                          }).toString()
                        : '',
                    })
                  }
                >
                  <Trans>Movies</Trans>
                </div>
              </div>
              {data.movie.duration > 0 && (
                <div className="whitespace-nowrap">
                  <Trans>
                    <b>
                      <FormatDuration
                        milliseconds={data.movie.duration * 60 * 1000}
                      />{' '}
                    </b>
                    watching
                  </Trans>
                </div>
              )}
              <div className="whitespace-nowrap">
                <Trans>
                  <b>{data.movie.items}</b> movies (<b>{data.movie.plays}</b>{' '}
                  plays)
                </Trans>
              </div>
            </div>
          )}
          {data.video_game?.plays > 0 && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <div
                  className="hover:underline hover:cursor-pointer"
                  onClick={() =>
                    navigate({
                      pathname: '/statistics/seen/video_game',
                      search: year
                        ? createSearchParams({
                            year: year,
                          }).toString()
                        : '',
                    })
                  }
                >
                  <Trans>Games</Trans>
                </div>
              </div>
              {data.video_game.duration > 0 && (
                <div className="whitespace-nowrap">
                  <Trans>
                    <b>
                      <FormatDuration
                        milliseconds={data.video_game.duration * 60 * 1000}
                      />{' '}
                    </b>
                    playing
                  </Trans>
                </div>
              )}
              <div>
                <Trans>
                  <b>{data.video_game.items}</b> video games (
                  <b>{data.video_game.plays}</b> plays)
                </Trans>
              </div>
            </div>
          )}
          {data.book?.plays > 0 && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <div
                  className="hover:underline hover:cursor-pointer"
                  onClick={() =>
                    navigate({
                      pathname: '/statistics/seen/book',
                      search: year
                        ? createSearchParams({
                            year: year,
                          }).toString()
                        : '',
                    })
                  }
                >
                  <Trans>Books</Trans>
                </div>
              </div>
              {data.book.duration > 0 && (
                <div className="whitespace-nowrap">
                  <Trans>
                    <b>
                      <FormatDuration
                        milliseconds={data.book.duration * 60 * 1000}
                      />{' '}
                    </b>
                    reading
                  </Trans>
                </div>
              )}
              <div>
                <Trans>
                  <b>{data.book.items}</b> books (<b>{data.book.plays}</b>{' '}
                  reads)
                </Trans>
              </div>
            </div>
          )}
          {data.audiobook?.plays > 0 && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <div
                  className="hover:underline hover:cursor-pointer"
                  onClick={() =>
                    navigate({
                      pathname: '/statistics/seen/audiobook',
                      search: year
                        ? createSearchParams({
                            year: year,
                          }).toString()
                        : '',
                    })
                  }
                >
                  <Trans>Audiobooks</Trans>
                </div>
              </div>
              {data.audiobook.duration > 0 && (
                <div className="whitespace-nowrap">
                  <Trans>
                    <b>
                      <FormatDuration
                        milliseconds={data.audiobook.duration * 60 * 1000}
                      />{' '}
                    </b>
                    listening
                  </Trans>
                </div>
              )}
              <div>
                <Trans>
                  <b>{data.audiobook.items}</b> audiobooks (
                  <b>{data.audiobook.plays}</b> plays)
                </Trans>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StatisticsSegmant;
