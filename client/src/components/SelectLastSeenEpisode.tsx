import React, { FunctionComponent, useEffect, useState } from 'react';
import { Trans } from '@lingui/macro';

import { setLastSeenEpisode, useDetails } from 'src/api/details';
import { Modal } from 'src/components/Modal';
import { SelectSeenDateComponent } from 'src/components/SelectSeenDate';
import { MediaItemItemsResponse, TvSeason } from 'mediatracker-api';
import { formatSeasonNumber } from 'src/utils';
import { Button } from 'src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';

export const SelectLastSeenEpisode: FunctionComponent<{
  tvShow: MediaItemItemsResponse;
  season?: TvSeason;
  closeModal: (selected?: boolean) => void;
}> = (props) => {
  const { closeModal, season } = props;

  const { mediaItem: tvShow, isLoading } = useDetails(props.tvShow.id);

  const [selectedSeasonId, setSelectedSeasonId] = useState<number>(season?.id);

  const selectedSeason = tvShow?.seasons?.find(
    (value) => value.id === selectedSeasonId
  );

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number>(
    selectedSeason?.episodes[selectedSeason?.episodes.length - 1].id
  );

  const selectedEpisode = selectedSeason?.episodes?.find(
    (episode) => episode.id === selectedEpisodeId
  );

  useEffect(() => {
    if (season || !tvShow || tvShow?.seasons?.length === 0) {
      return;
    }

    const seasonsWithEpisodes = tvShow.seasons.filter(
      (season) => season.episodes.length > 0
    );

    const firstSeason = seasonsWithEpisodes[seasonsWithEpisodes.length - 1];

    setSelectedSeasonId(firstSeason.id);
    setSelectedEpisodeId(
      firstSeason.episodes[firstSeason.episodes.length - 1].id
    );
  }, [tvShow, season]);

  useEffect(() => {
    if (selectedSeason && !selectedEpisode) {
      setSelectedEpisodeId(selectedSeason.episodes?.at(0)?.id);
    }
  }, [selectedSeason, selectedEpisode]);

  return (
    <div className="p-3 rounded ">
      {isLoading ? (
        <Trans>Loading</Trans>
      ) : (
        <>
          <div className="max-w-sm py-2 mx-5 text-2xl font-bold text-center">
            <Trans>
              What is the last episode of &quot;
              {season
                ? `${tvShow.title} ${formatSeasonNumber(season)}`
                : tvShow.title}
              &quot; you see?
            </Trans>
          </div>
          <div className="text-lg">
            {!season && (
              <div className="py-2">
                <span className="mr-2">
                  <Trans>Season</Trans>:
                </span>
                <Select
                  value={String(selectedSeasonId)}
                  onValueChange={(value) => setSelectedSeasonId(Number(value))}
                >
                  <SelectTrigger aria-label="Season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tvShow.seasons
                      ?.filter((season) => !season.isSpecialSeason)
                      .map((season) => (
                        <SelectItem key={season.id} value={String(season.id)}>
                          {season.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="py-2">
              <span className="mr-2">
                <Trans>Episode</Trans>:
              </span>
              <Select
                value={String(selectedEpisodeId)}
                onValueChange={(value) => setSelectedEpisodeId(Number(value))}
              >
                <SelectTrigger aria-label="Episode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedSeason?.episodes?.map((episode) => (
                    <SelectItem key={episode.id} value={String(episode.id)}>
                      {!episode.title.endsWith(` ${episode.episodeNumber}`) &&
                        episode.episodeNumber + '. '}

                      {episode.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <Modal
              closeOnBackgroundClick={true}
              closeOnEscape={true}
              onBeforeClosed={() => closeModal(true)}
              openModal={(onClick) => (
                <Button variant="default" onClick={onClick}>
                  <Trans>Select</Trans>
                </Button>
              )}
            >
              {(closeModal) => (
                <SelectSeenDateComponent
                  mediaItem={tvShow}
                  closeModal={closeModal}
                  onSelected={async (args) => {
                    closeModal();

                    await setLastSeenEpisode({
                      mediaItem: tvShow,
                      lastSeenAt: args.seenAt,
                      date: args.date,
                      episode: selectedEpisode,
                      season: season ? selectedSeason : undefined,
                    });
                  }}
                />
              )}
            </Modal>

            <Button variant="destructive" onClick={() => closeModal()}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
