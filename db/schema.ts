import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().default('My Instagram schedule'),
  instagramAccountId: text('instagram_account_id'),
  instagramUsername: text('instagram_username'),
  caption: text('caption').notNull().default(''),
  intervalDays: integer('interval_days').notNull().default(2),
  timezone: text('timezone').notNull().default('America/New_York'),
  status: text('status', { enum: ['draft', 'active', 'paused'] }).notNull().default('draft'),
  nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('idx_schedules_status_next_run').on(table.status, table.nextRunAt)]);

export const scheduleTimes = sqliteTable('schedule_times', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  minuteOfDay: integer('minute_of_day').notNull(),
  position: integer('position').notNull(),
}, (table) => [index('idx_schedule_times_schedule_position').on(table.scheduleId, table.position)]);

export const mediaItems = sqliteTable('media_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(),
  filename: text('filename').notNull(),
  mediaType: text('media_type', { enum: ['image', 'video'] }).notNull(),
  position: integer('position').notNull(),
  state: text('state', { enum: ['queued', 'publishing', 'published', 'failed'] }).notNull().default('queued'),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp_ms' }),
  instagramMediaId: text('instagram_media_id'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('idx_media_items_schedule_position').on(table.scheduleId, table.position),
  index('idx_media_items_state_scheduled').on(table.state, table.scheduledFor),
]);
