import React, { FunctionComponent, useEffect, useState } from 'react';
import { Trans } from '@lingui/macro';

import { setLastSeenEpisode, useDetails } from 'src/api/details';
import { Modal } from 'src/components/Modal';
import { SelectSeenDateComponent } from 'src/components/SelectSeenDate';
import { MediaItemItemsResponse, TvEpisode, TvSeason } from 'mediatracker-api';
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
  const { closeModal, season, tvShow } = props;
  const tvShowId = tvShow.id ?? 0;

  const { mediaItem: tvShowDetails, isLoading } = useDetails(tvShowId);
  const seasonsWithEpisodes = (tvShowDetails?.seasons ?? []).filter(
    (value) => (value.episodes?.length ?? 0) > 0
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | undefined>(
    season?.id ?? undefined
  );
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | undefined>();

  const selectedSeason =
    (selectedSeasonId !== undefined
      ? seasonsWithEpisodes.find((value) => value.id === selectedSeasonId)
      : undefined) ??
    (season && (season.episodes?.length ?? 0) > 0 ? season : undefined) ??
    seasonsWithEpisodes.at(-1);
  const selectedSeasonEpisodes = selectedSeason?.episodes ?? [];
  const selectedEpisode: TvEpisode | undefined =
    (selectedEpisodeId !== undefined
      ? selectedSeasonEpisodes.find((value) => value.id === selectedEpisodeId)
      : undefined) ?? selectedSeasonEpisodes.at(-1);

  useEffect(() => {
    if (season || seasonsWithEpisodes.length === 0) {
      return;
    }

    const initialSeason = seasonsWithEpisodes.at(-1);
    const initialEpisode = initialSeason?.episodes?.at(-1);

    if (selectedSeasonId === undefined) {
      setSelectedSeasonId(initialSeason?.id ?? undefined);
    }

    if (selectedEpisodeId === undefined) {
      setSelectedEpisodeId(initialEpisode?.id ?? undefined);
    }
  }, [season, seasonsWithEpisodes, selectedEpisodeId, selectedSeasonId]);

  useEffect(() => {
    if (!selectedSeason) {
      return;
    }

    if (selectedEpisode?.id !== undefined) {
      return;
    }

    setSelectedEpisodeId(selectedSeason.episodes?.at(-1)?.id ?? undefined);
  }, [selectedEpisode, selectedSeason]);

  if (
    !isLoading &&
    (!tvShowDetails ||
      seasonsWithEpisodes.length === 0 ||
      !selectedSeason ||
      !selectedEpisode)
  ) {
    return (
      <div className="p-3 rounded ">
        <div className="max-w-sm py-2 mx-5 text-xl font-bold text-center">
          <Trans>No episodes available</Trans>
        </div>
        <div className="flex justify-end mt-2">
          <Button variant="destructive" onClick={() => closeModal()}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </div>
    );
  }

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
                  value={selectedSeasonId !== undefined ? String(selectedSeasonId) : ''}
                  onValueChange={(value) => setSelectedSeasonId(Number(value))}
                >
                  <SelectTrigger aria-label="Season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonsWithEpisodes
                      .filter((value) => !value.isSpecialSeason)
                      .map((value) => (
                        <SelectItem key={value.id} value={String(value.id)}>
                          {value.title}
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
                value={selectedEpisodeId !== undefined ? String(selectedEpisodeId) : ''}
                onValueChange={(value) => setSelectedEpisodeId(Number(value))}
              >
                <SelectTrigger aria-label="Episode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedSeasonEpisodes.map((value) => (
                    <SelectItem key={value.id} value={String(value.id)}>
                      {!value.title.endsWith(` ${value.episodeNumber}`) &&
                        value.episodeNumber + '. '}

                      {value.title}
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
              {(closeSeenDateModal) => (
                <SelectSeenDateComponent
                  mediaItem={tvShow}
                  closeModal={closeSeenDateModal}
                  onSelected={async (args) => {
                    closeSeenDateModal();

                    if (!selectedEpisode) {
                      return;
                    }

                    const lastSeenAt = args.date
                      ? 'custom_date'
                      : args.seenAt;

                    if (!lastSeenAt) {
                      return;
                    }

                    await setLastSeenEpisode({
                      mediaItem: tvShow,
                      lastSeenAt,
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
