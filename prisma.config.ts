import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  // Client generation needs the schema, not privileged database credentials.
  // Commands that connect to Postgres still require an explicitly configured URL.
  datasource: process.env.DIRECT_URL ? { url: process.env.DIRECT_URL } : undefined
});
