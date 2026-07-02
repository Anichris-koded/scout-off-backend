// Set required env vars before any module is loaded in tests
process.env.CONTRACT_ID =
  process.env.CONTRACT_ID ??
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
process.env.DB_PATH = process.env.DB_PATH ?? ":memory:";
// Use port 0 so each test file's server instance binds to a random
// available port, preventing EADDRINUSE conflicts across test suites.
process.env.PORT = process.env.PORT ?? "0";
process.env.STELLAR_HEALTH_CHECK = "false";

import { initDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";

initDb();
// Ensure migrations are applied in tests (initDb() only creates base tables)
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
runMigrations((global as any).__db ?? require("../src/db").getDb());
