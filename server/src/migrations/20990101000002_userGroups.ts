import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create userGroup table
  const hasUserGroupTable = await knex.schema.hasTable('userGroup');
  if (!hasUserGroupTable) {
    await knex.schema.createTable('userGroup', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table
        .integer('createdBy')
        .notNullable()
        .references('id')
        .inTable('user')
        .onDelete('cascade');
      table.bigInteger('createdAt').notNullable();
      table.bigInteger('updatedAt').nullable();
      table.bigInteger('deletedAt').nullable();

      table.index('createdBy');
    });
  }

  // Create userGroupMember table
  const hasUserGroupMemberTable = await knex.schema.hasTable('userGroupMember');
  if (!hasUserGroupMemberTable) {
    await knex.schema.createTable('userGroupMember', (table) => {
      table.increments('id').primary();
      table
        .integer('groupId')
        .notNullable()
        .references('id')
        .inTable('userGroup')
        .onDelete('cascade');
      table
        .integer('userId')
        .notNullable()
        .references('id')
        .inTable('user')
        .onDelete('cascade');
      table.string('role').notNullable(); // 'admin' or 'viewer'
      table.bigInteger('addedAt').notNullable();

      table.unique(['groupId', 'userId']);
      table.index('userId');
    });
  }

  // Create groupPlatformRating table
  const hasGroupPlatformRatingTable = await knex.schema.hasTable('groupPlatformRating');
  if (!hasGroupPlatformRatingTable) {
    await knex.schema.createTable('groupPlatformRating', (table) => {
      table.increments('id').primary();
      table
        .integer('groupId')
        .notNullable()
        .references('id')
        .inTable('userGroup')
        .onDelete('cascade');
      table
        .integer('mediaItemId')
        .notNullable()
        .references('id')
        .inTable('mediaItem')
        .onDelete('cascade');
      table.float('rating').nullable();

      table.unique(['groupId', 'mediaItemId']);
      table.index('mediaItemId');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order (respecting FK constraints)
  const hasGroupPlatformRatingTable = await knex.schema.hasTable('groupPlatformRating');
  if (hasGroupPlatformRatingTable) {
    await knex.schema.dropTable('groupPlatformRating');
  }

  const hasUserGroupMemberTable = await knex.schema.hasTable('userGroupMember');
  if (hasUserGroupMemberTable) {
    await knex.schema.dropTable('userGroupMember');
  }

  const hasUserGroupTable = await knex.schema.hasTable('userGroup');
  if (hasUserGroupTable) {
    await knex.schema.dropTable('userGroup');
  }
}
