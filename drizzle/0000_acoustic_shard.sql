CREATE TYPE "public"."asset_status" AS ENUM('DRAFT', 'PUBLISHED', 'UNDER_OFFER', 'SOLD', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('ACTIVE', 'LICENSE_ONLY', 'PRE_REVENUE');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('FULL_SALE', 'MAJORITY', 'MINORITY', 'ASSET_PURCHASE');--> statement-breakpoint
CREATE TYPE "public"."investor_type" AS ENUM('STRATEGIC', 'PE_VC', 'FAMILY_OFFICE', 'ANGEL', 'SEARCH_FUND');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'uk');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('SUSPEND', 'REINSTATE', 'REMOVE', 'UNLIST_ASSET', 'RELIST_ASSET');--> statement-breakpoint
CREATE TYPE "public"."moderation_target" AS ENUM('USER', 'ASSET');--> statement-breakpoint
CREATE TYPE "public"."sector" AS ENUM('BANK', 'FINTECH', 'PAYMENT', 'EMI', 'CRYPTO', 'LENDING', 'WEALTH');--> statement-breakpoint
CREATE TYPE "public"."started_by" AS ENUM('BUYER', 'SELLER');--> statement-breakpoint
CREATE TYPE "public"."timeline" AS ENUM('NOW', '3_MONTHS', '6_MONTHS', 'EXPLORING');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('BUYER', 'SELLER', 'MANAGER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REMOVED');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"seller_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sector" "sector" NOT NULL,
	"country" text NOT NULL,
	"jurisdiction" text DEFAULT '' NOT NULL,
	"license_type" text DEFAULT '' NOT NULL,
	"business_status" "business_status" DEFAULT 'ACTIVE' NOT NULL,
	"deal_type" "deal_type" DEFAULT 'FULL_SALE' NOT NULL,
	"stake_offered" integer DEFAULT 100 NOT NULL,
	"asking_price_cents" bigint DEFAULT 0 NOT NULL,
	"revenue_cents" bigint DEFAULT 0 NOT NULL,
	"ebitda_cents" bigint DEFAULT 0 NOT NULL,
	"employees" integer DEFAULT 0 NOT NULL,
	"founded_year" integer,
	"status" "asset_status" DEFAULT 'DRAFT' NOT NULL,
	"status_reason" text,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"investor_type" "investor_type" DEFAULT 'STRATEGIC' NOT NULL,
	"ticket_min_cents" bigint DEFAULT 0 NOT NULL,
	"ticket_max_cents" bigint DEFAULT 0 NOT NULL,
	"sectors" text DEFAULT '[]' NOT NULL,
	"jurisdictions" text DEFAULT '[]' NOT NULL,
	"deal_types" text DEFAULT '[]' NOT NULL,
	"timeline" timeline DEFAULT 'EXPLORING' NOT NULL,
	"proof_of_funds" boolean DEFAULT false NOT NULL,
	"listed_in_directory" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"started_by" "started_by" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_type" "moderation_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"target_label" text NOT NULL,
	"action" "moderation_action" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_assets" (
	"buyer_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_assets_buyer_id_asset_id_pk" PRIMARY KEY("buyer_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"country" text NOT NULL,
	"website" text,
	"about" text DEFAULT '' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"deals_closed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"status_reason" text,
	"status_changed_at" timestamp with time zone,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_assets" ADD CONSTRAINT "saved_assets_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_assets" ADD CONSTRAINT "saved_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_reference_idx" ON "assets" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status","sector");--> statement-breakpoint
CREATE INDEX "assets_seller_idx" ON "assets" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "buyer_directory_idx" ON "buyer_profiles" USING btree ("listed_in_directory");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_idx" ON "conversations" USING btree ("buyer_id","seller_id","asset_id") WHERE "conversations"."asset_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_no_asset_idx" ON "conversations" USING btree ("buyer_id","seller_id") WHERE "conversations"."asset_id" is null;--> statement-breakpoint
CREATE INDEX "conversations_buyer_idx" ON "conversations" USING btree ("buyer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_seller_idx" ON "conversations" USING btree ("seller_id","last_message_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_created_idx" ON "moderation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role","status");