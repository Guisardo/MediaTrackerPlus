import argon2 from 'argon2';
import _ from 'lodash';

import { Database } from 'src/dbconfig';
import {
  User,
  userColumns,
  userNonSensitiveColumns,
  userSelfColumns,
} from 'src/entity/user';
import { repository } from 'src/repository/repository';

class UserRepository extends repository<User>({
  tableName: 'user',
  columnNames: userColumns,
  primaryColumnName: 'id',
  booleanColumnNames: <const>[
    'admin',
    'publicReviews',
    'sendNotificationForEpisodesReleases',
    'sendNotificationForReleases',
    'sendNotificationWhenNumberOfSeasonsChanges',
    'sendNotificationWhenReleaseDateChanges',
    'sendNotificationWhenStatusChanges',
    'hideEpisodeTitleForUnseenEpisodes',
    'hideOverviewForUnseenSeasons',
    'addRecommendedToWatchlist',
  ],
}) {
  public override async find(where: Partial<User>): Promise<User[]> {
    const res = (await Database.knex<User>(this.tableName)
      .where(where)
      .select(userNonSensitiveColumns)) as User[];

    return res.map((value) => this.deserialize(value));
  }

  public override async findOne(
    where: Partial<User>
  ): Promise<User | undefined> {
    const res = (await Database.knex<User>(this.tableName)
      .where(where)
      .select(userNonSensitiveColumns)
      .first()) as unknown as User | undefined;

    if (res) {
      return this.deserialize(res);
    }
  }

  /**
   * Returns the authenticated user's own record including `dateOfBirth`.
   * Must only be called for the currently-authenticated user — never for
   * public or other-user queries.
   */
  public async findOneSelf(
    where: Partial<User>
  ): Promise<User | undefined> {
    const res = (await Database.knex<User>(this.tableName)
      .where(where)
      .select(userSelfColumns)
      .first()) as unknown as User | undefined;

    if (res) {
      return this.deserialize(res);
    }
  }

  public async findUsersWithMediaItemOnWatchlist(args: {
    mediaItemId: number;
    sendNotificationForReleases?: boolean;
    sendNotificationForEpisodesReleases?: boolean;
  }): Promise<User[]> {
    const {
      mediaItemId,
      sendNotificationForReleases,
      sendNotificationForEpisodesReleases,
    } = args;
    const qb = Database.knex(this.tableName)
      .innerJoin('list', (qb) =>
        qb.on('list.userId', 'user.id').onVal('list.isWatchlist', true)
      )
      .leftJoin('listItem', 'listItem.listId', 'list.id')
      .where('listItem.mediaItemId', mediaItemId)
      .select(
        userNonSensitiveColumns.map((column) => this.tableName + '.' + column)
      );

    if (sendNotificationForReleases) {
      qb.where('sendNotificationForReleases', true);
    }

    if (sendNotificationForEpisodesReleases) {
      qb.where('sendNotificationForEpisodesReleases', true);
    }

    return await qb;
  }

  public async usersWithMediaItemOnWatchlist(
    mediaItemId: number
  ): Promise<User[]> {
    return await Database.knex(this.tableName)
      .innerJoin('list', (qb) =>
        qb.on('list.userId', 'user.id').onVal('list.isWatchlist', true)
      )
      .leftJoin('listItem', 'listItem.listId', 'list.id')
      .where('listItem.mediaItemId', mediaItemId)
      .select(
        userNonSensitiveColumns.map((column) => this.tableName + '.' + column)
      );
  }

  public async findOneWithPassword(
    where: Partial<User>
  ): Promise<User | undefined> {
    return await Database.knex<User>(this.tableName).where(where).first();
  }

  public override async create(user: Omit<User, 'id'>) {
    user.password = await argon2.hash(user.password);

    const res = await Database.knex.transaction(async (trx) => {
      const [res] = await trx<User>('user').insert(
        _.pick(user, this.columnNames ?? []),
        'id'
      );

      const currentDate = new Date().getTime();

      if (!res) {
        throw new Error('Failed to create user');
      }

      await trx('list').insert({
        name: 'Watchlist',
        userId: res.id,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: currentDate,
        updatedAt: currentDate,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      });

      return res;
    });

    return res.id;
  }

  public override async update(user: Partial<User>) {
    const result = _.cloneDeep(user);

    if (result.password) {
      result.password = await argon2.hash(result.password);
    }

    return await super.update(result);
  }

  public async verifyPassword(user: User, password: string) {
    return await argon2.verify(user.password, password);
  }
}

export const userRepository = new UserRepository();
