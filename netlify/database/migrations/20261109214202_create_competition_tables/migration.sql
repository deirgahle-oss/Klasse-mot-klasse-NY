CREATE TABLE "answers" (
	"game_id" text NOT NULL,
	"player_id" text,
	"question_id" text,
	"value" double precision NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"points" double precision,
	"sequence" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_pkey" PRIMARY KEY("player_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY,
	"owner" text NOT NULL,
	"title" text NOT NULL,
	"classes" jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"questions" jsonb NOT NULL,
	"share" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY,
	"game_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"name" text NOT NULL,
	"class_name" text NOT NULL,
	"eligible_from" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "answers_game_idx" ON "answers" ("game_id");--> statement-breakpoint
CREATE INDEX "games_owner_idx" ON "games" ("owner");--> statement-breakpoint
CREATE INDEX "players_game_idx" ON "players" ("game_id");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;