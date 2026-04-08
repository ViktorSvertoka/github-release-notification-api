CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'unsubscribed');

CREATE TABLE "repositories" (
  "id" serial PRIMARY KEY NOT NULL,
  "full_name" text NOT NULL,
  "last_seen_tag" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "repositories_full_name_unique" UNIQUE("full_name")
);

CREATE TABLE "subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "repository_id" integer NOT NULL,
  "status" "subscription_status" NOT NULL,
  "confirm_token" text NOT NULL,
  "unsubscribe_token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_confirm_token_unique" UNIQUE("confirm_token"),
  CONSTRAINT "subscriptions_unsubscribe_token_unique" UNIQUE("unsubscribe_token"),
  CONSTRAINT "subscriptions_email_repository_unique" UNIQUE("email", "repository_id")
);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_repository_id_repositories_id_fk"
  FOREIGN KEY ("repository_id")
  REFERENCES "public"."repositories"("id")
  ON DELETE cascade
  ON UPDATE no action;
