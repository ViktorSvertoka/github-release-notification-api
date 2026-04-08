CREATE TABLE "notification_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "repository_id" integer NOT NULL,
  "tag" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_deliveries_repository_tag_email_unique" UNIQUE("repository_id", "tag", "email")
);

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_repository_id_repositories_id_fk"
  FOREIGN KEY ("repository_id")
  REFERENCES "public"."repositories"("id")
  ON DELETE cascade
  ON UPDATE no action;
