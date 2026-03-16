import _ from 'lodash';
import { Database } from 'src/dbconfig';
import { applyMethodDecorator, traceMethod } from 'src/logger/tracing';

export const omitUndefinedValues = <T extends object>(value: Partial<T>) =>
  _.pickBy(value, (v) => v !== undefined) as Partial<T>;

export const definedOrUndefined = <T>(
  value: T | null | undefined
): T | undefined => (value == null ? undefined : value);

export const definedOrNull = <T>(value: T | null | undefined): T | null =>
  value == null ? null : value;

const BATCH_SIZE = 30;

export const repository = <T extends object>(args: {
  tableName: string;
  primaryColumnName: keyof T;
  columnNames?: ReadonlyArray<keyof T>;
  booleanColumnNames?: ReadonlyArray<keyof T>;
  uniqueBy?: (value: Partial<T>) => Partial<T>;
}) => {
  const {
    primaryColumnName,
    tableName,
    columnNames,
    booleanColumnNames,
    uniqueBy,
  } = args;

  class Repository {
    public readonly tableName = tableName;
    public readonly columnNames = columnNames;
    public readonly primaryColumnName = primaryColumnName;
    public readonly booleanColumnNames = booleanColumnNames;
    public readonly uniqueBy = uniqueBy;

    public serialize(value: Partial<T>): unknown {
      if (!this.booleanColumnNames) {
        return value;
      }

      return {
        ...value,
        ..._(this.booleanColumnNames)
          .keyBy()
          .mapValues((key) =>
            value[key] !== undefined ? (value[key] ? 1 : 0) : undefined
          )
          .value(),
      };
    }

    public deserialize(value: Partial<Record<keyof T, unknown>>): T {
      if (!this.booleanColumnNames) {
        return value as T;
      }

      return {
        ...value,
        ..._(this.booleanColumnNames)
          .keyBy()
          .mapValues((key) =>
            value[key] !== undefined ? Boolean(value[key]) : undefined
          )
          .value(),
      } as T;
    }

    public stripValue(value: Partial<T>) {
      if (!this.columnNames) {
        return value;
      }

      return _.pick(value, this.columnNames) as Partial<T>;
    }

    public async count(where?: Partial<T>): Promise<number> {
      const res = await Database.knex(this.tableName)
        .where(omitUndefinedValues((where ?? {}) as Partial<T>))
        .count<{ count: number }[]>('* as count')
        .first();

      return Number(res?.count ?? 0);
    }

    public async find(where?: Partial<T>): Promise<T[]> {
      const res = (await Database.knex<T>(this.tableName).where(
        omitUndefinedValues((where ?? {}) as Partial<T>)
      )) as T[];

      return res.map((value) => this.deserialize(value));
    }

    public async findOne(where?: Partial<T>): Promise<T | undefined> {
      const res = (await Database.knex<T>(this.tableName)
        .where(omitUndefinedValues((where ?? {}) as Partial<T>))
        .first()) as T | undefined;

      if (res) {
        return this.deserialize(res);
      }
    }

    public async delete(where?: Partial<T>) {
      return Database.knex<T>(this.tableName)
        .delete()
        .where(omitUndefinedValues((where ?? {}) as Partial<T>));
    }

    public async deleteManyById<A extends typeof args.primaryColumnName>(
      ids: (T extends { [K in A]: infer Type } ? Type : never)[]
    ) {
      return Database.knex(this.tableName)
        .delete()
        .whereIn(primaryColumnName.toString(), ids as any[]);
    }

    public async create(value: Partial<T>) {
      if (this.uniqueBy) {
        return this.createUnique(value, this.uniqueBy);
      }

      const res = await Database.knex(this.tableName)
        .insert(this.serialize(omitUndefinedValues(this.stripValue(value))))
        .returning(this.primaryColumnName as string);

      if (res?.length > 0) {
        return res[0]?.[this.primaryColumnName];
      }
    }

    public async createUnique(
      value: Partial<T>,
      uniqueBy: (value: Partial<T>) => Partial<T>
    ) {
      return await Database.knex.transaction(async (trx) => {
        const existingItem = await trx(this.tableName)
          .where(omitUndefinedValues(uniqueBy(value)))
          .first();

        if (!existingItem) {
          const res = await trx(this.tableName)
            .insert(this.serialize(omitUndefinedValues(this.stripValue(value))))
            .returning(this.primaryColumnName as string);

          if (res?.length > 0) {
            return res[0]?.[this.primaryColumnName];
          }
        }
      });
    }

    public async createMany(values: Partial<T>[]) {
      if (values.length === 0) {
        return;
      }

      if (this.uniqueBy) {
        return this.createManyUnique(values, this.uniqueBy);
      }

      const res = (await (Database.knex as any)
        .batchInsert(
          this.tableName,
          values.map((value) =>
            this.serialize(omitUndefinedValues(this.stripValue(value)))
          ),
          BATCH_SIZE
        )
        .returning(this.primaryColumnName as string)) as Partial<T>[];

      res.forEach(
        (value, index) =>
          (values[index]![this.primaryColumnName] =
            value[this.primaryColumnName])
      );

      return res.map((value) => value[this.primaryColumnName]);
    }

    public async createManyUnique(
      values: Partial<T>[],
      uniqueBy: (value: Partial<T>) => Partial<T>,
      limitQuery?: Partial<T>
    ) {
      const serialize = (item: Partial<T>) => JSON.stringify(uniqueBy(item));

      return await Database.knex.transaction(async (trx) => {
        const fetchAllItems = async () => {
          return (await trx(this.tableName).where(
            (limitQuery ?? {}) as Partial<T>
          )) as T[];
        };

        const fetchMatchingItems = async () => {
          const existingItems: T[] = [];

          for (const value of values) {
            const res = (await trx(this.tableName).where(uniqueBy(value))) as T[];

            res.forEach((item) => existingItems.push(item));
          }

          return existingItems;
        };

        const existingItems =
          values.length < 100
            ? await fetchMatchingItems()
            : await fetchAllItems();
        const uniqueExistingItems = new Set(
          existingItems.map((item) => serialize(item))
        );

        const newItems = _(values)
          .filter((item) => !uniqueExistingItems.has(serialize(item)))
          .map((item) => ({
            item: item,
            serializedItem: serialize(item),
          }))
          .uniqBy('serializedItem')
          .map((value) => value.item)
          .value();

        if (newItems.length > 0) {
          const res = (await (Database.knex as any)
            .batchInsert(
              this.tableName,
              newItems.map((value) =>
                this.serialize(omitUndefinedValues(this.stripValue(value)))
              ),
              BATCH_SIZE
            )
            .returning(this.primaryColumnName as string)
            .transacting(trx)) as Partial<T>[];

          res.forEach(
            (value, index) =>
              (newItems[index]![this.primaryColumnName] =
                value[this.primaryColumnName])
          );

          return res.map((value) => value[this.primaryColumnName]);
        }
      });
    }

    public async update(value: Partial<T>): Promise<Partial<T>> {
      const qb = Database.knex(this.tableName).update(
        this.serialize(omitUndefinedValues(this.stripValue(value)))
      );

      if (value[primaryColumnName] !== undefined) {
        qb.where(
          primaryColumnName as string,
          value[primaryColumnName] as any
        );
      }

      await qb;

      return value;
    }

    public async updateWhere(params: { where: Partial<T>; value: Partial<T> }) {
      const { value, where } = params;

      await Database.knex(this.tableName)
        .update(this.serialize(omitUndefinedValues(this.stripValue(value))))
        .where(where);
    }

    public async updateOrCreate(params: {
      where: Partial<T>;
      value: Partial<T>;
    }) {
      const { value, where } = params;

      await Database.knex.transaction(async (trx) => {
        const existingItem = await trx(this.tableName)
          .where(omitUndefinedValues(where))
          .first();

        if (existingItem) {
          await trx(this.tableName)
            .update(this.serialize(omitUndefinedValues(this.stripValue(value))))
            .where(primaryColumnName, existingItem[primaryColumnName]);
        } else {
          await trx(this.tableName).insert(
            this.serialize(omitUndefinedValues(this.stripValue(value)))
          );
        }
      });
    }
  }

  [
    'count',
    'find',
    'findOne',
    'delete',
    'deleteManyById',
    'create',
    'createUnique',
    'createMany',
    'createManyUnique',
    'update',
    'updateWhere',
    'updateOrCreate',
  ].forEach((methodName) =>
    applyMethodDecorator(
      Repository.prototype,
      methodName as keyof Repository,
      traceMethod({ includeResult: false })
    )
  );

  return Repository;
};
