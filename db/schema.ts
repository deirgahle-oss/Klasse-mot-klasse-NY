import { pgTable, text, jsonb, timestamp, integer, doublePrecision, bigint, boolean, primaryKey, index } from 'drizzle-orm/pg-core';
export const games = pgTable('games', {
 id: text().primaryKey(), owner: text().notNull(), title: text().notNull(), classes: jsonb().$type<string[]>().notNull(),
 state: jsonb().$type<any>().notNull(), questions: jsonb().$type<any[]>().notNull(), share: text().notNull().unique(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
}, t => [index('games_owner_idx').on(t.owner)]);
export const players = pgTable('players', {
 id: text().primaryKey(), gameId: text('game_id').notNull().references(()=>games.id,{onDelete:'cascade'}),
 secretHash: text('secret_hash').notNull(), name: text().notNull(), className: text('class_name').notNull(), eligibleFrom: integer('eligible_from').notNull(),
 joinedAt: timestamp('joined_at',{withTimezone:true}).defaultNow().notNull(),
}, t => [index('players_game_idx').on(t.gameId)]);
export const answers = pgTable('answers', {
 gameId: text('game_id').notNull().references(()=>games.id,{onDelete:'cascade'}),
 playerId: text('player_id').notNull().references(()=>players.id,{onDelete:'cascade'}), questionId: text('question_id').notNull(),
 value: doublePrecision().notNull(), locked: boolean().notNull().default(false), points: doublePrecision(), sequence: bigint({mode:'number'}).notNull(),
 updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),
}, t=>[primaryKey({columns:[t.playerId,t.questionId]}),index('answers_game_idx').on(t.gameId)]);
