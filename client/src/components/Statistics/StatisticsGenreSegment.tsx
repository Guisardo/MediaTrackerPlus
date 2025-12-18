import { Trans } from '@lingui/macro';
import { GenreSummeryResponse } from 'mediatracker-api';
import React from 'react';

const StatisticsGenreSegment = (props: { data: GenreSummeryResponse }) => {
  const { data } = props;
  return (
    <>
      {data && (
        <div className="flex flex-wrap">
          {data.tv && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <Trans>Tv</Trans>
              </div>
              <div className="whitespace-nowrap">
                {data.tv.map((item) => {
                  return (
                    <div key={item.genre}>
                      <Trans>
                        <b>{item.genre}</b> (<b>{item.count}</b>)
                      </Trans>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.movie && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <Trans>Movies</Trans>
              </div>
              <div className="whitespace-nowrap">
                {data.movie.map((item) => {
                  return (
                    <div key={item.genre}>
                      <Trans>
                        <b>{item.genre}</b> (<b>{item.count}</b>)
                      </Trans>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.video_game && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <Trans>Games</Trans>
              </div>
              <div className="whitespace-nowrap">
                {data.video_game.map((item) => {
                  return (
                    <div key={item.genre}>
                      <Trans>
                        <b>{item.genre}</b> (<b>{item.count}</b>)
                      </Trans>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.book && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <Trans>Books</Trans>
              </div>
              <div className="whitespace-nowrap">
                {data.book.map((item) => {
                  return (
                    <div key={item.genre}>
                      <Trans>
                        <b>{item.genre}</b> (<b>{item.count}</b>)
                      </Trans>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.audiobook && (
            <div className="mb-6 mr-6">
              <div className="text-lg font-bold">
                <Trans>Audiobooks</Trans>
              </div>
              <div className="whitespace-nowrap">
                {data.audiobook.map((item) => {
                  return (
                    <div key={item.genre}>
                      <Trans>
                        <b>{item.genre}</b> (<b>{item.count}</b>)
                      </Trans>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StatisticsGenreSegment;
