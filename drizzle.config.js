import { defineConfig } from "drizzle-kit";
var drizzle_config_default = defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.js",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.LOVABLE_DB_MIGRATION_URL ?? ""
  }
});
export {
  drizzle_config_default as default
};
