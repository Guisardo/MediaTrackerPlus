import { TvEpisode, tvEpisodeColumns } from 'src/entity/tvepisode';
import { repository } from 'src/repository/repository';

class EpisodeRepository extends repository<TvEpisode>({
  tableName: 'episode',
  columnNames: tvEpisodeColumns,
  primaryColumnName: 'id',
  booleanColumnNames: ['isSpecialEpisode'],
}) {
  public override async create(value: Partial<TvEpisode>) {
    return await super.create({
      ...value,
      seasonAndEpisodeNumber:
        value.seasonNumber != null && value.episodeNumber != null
          ? value.seasonNumber * 1000 + value.episodeNumber
          : undefined,
    } as Partial<TvEpisode>);
  }

  public override async createMany(values: Partial<TvEpisode>[]) {
    return await super.createMany(
      values.map((value) => ({
        ...value,
        seasonAndEpisodeNumber:
          value.seasonNumber != null && value.episodeNumber != null
            ? value.seasonNumber * 1000 + value.episodeNumber
            : undefined,
      }))
    );
  }
}

export const tvEpisodeRepository = new EpisodeRepository();
