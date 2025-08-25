-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "agreement_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"language" varchar(20) NOT NULL,
	"template_content" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mobile" varchar(15) NOT NULL,
	"email" varchar,
	"password" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"username" varchar,
	CONSTRAINT "customers_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "customers_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "societies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_name" text NOT NULL,
	"area" text NOT NULL,
	"district" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"landmark" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" varchar(20) DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"phone" varchar,
	"username" varchar,
	CONSTRAINT "admin_users_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society" text NOT NULL,
	"area" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"district" text,
	"landmark" text,
	"usage_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdf_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"language" varchar(20) NOT NULL,
	"html_template" text NOT NULL,
	"dynamic_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditional_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "word_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"language" text DEFAULT 'english' NOT NULL,
	"structure" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"language" varchar(20) DEFAULT 'english' NOT NULL,
	"owner_details" jsonb NOT NULL,
	"tenant_details" jsonb NOT NULL,
	"property_details" jsonb NOT NULL,
	"rental_terms" jsonb NOT NULL,
	"additional_clauses" text[] DEFAULT '{""}',
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"agreement_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"parent_agreement_id" varchar,
	"renewed_from_id" varchar,
	"documents" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"owner_documents" jsonb DEFAULT '{}'::jsonb,
	"tenant_documents" jsonb DEFAULT '{}'::jsonb,
	"property_documents" jsonb DEFAULT '{}'::jsonb,
	"notarized_document" jsonb DEFAULT '{}'::jsonb,
	"property_id" varchar,
	"edited_html" text,
	"edited_at" timestamp,
	CONSTRAINT "agreements_agreement_number_unique" UNIQUE("agreement_number")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"flat_number" text NOT NULL,
	"building" text,
	"society" text NOT NULL,
	"area" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"district" text,
	"landmark" text,
	"property_type" varchar(20) NOT NULL,
	"purpose" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"username" varchar(255),
	"mobile" varchar(20),
	"phone" varchar(20),
	"password" varchar(255),
	"status" varchar(20) DEFAULT 'active',
	"permissions" text[],
	"default_role" varchar(255),
	"name" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "customer_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customer_roles_customer_id_role_id_key" UNIQUE("customer_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_roles" ADD CONSTRAINT "customer_roles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_roles" ADD CONSTRAINT "customer_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "address_area_idx" ON "addresses" USING btree ("area" text_ops);--> statement-breakpoint
CREATE INDEX "address_city_idx" ON "addresses" USING btree ("city" text_ops);--> statement-breakpoint
CREATE INDEX "address_society_idx" ON "addresses" USING btree ("society" text_ops);--> statement-breakpoint
CREATE INDEX "property_address_idx" ON "properties" USING btree ("society" text_ops,"area" text_ops,"city" text_ops);--> statement-breakpoint
CREATE INDEX "property_customer_idx" ON "properties" USING btree ("customer_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_mobile_idx" ON "users" USING btree ("mobile" text_ops) WHERE (mobile IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username" text_ops) WHERE (username IS NOT NULL);
*/