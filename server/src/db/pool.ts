import pg from "pg";
import { env } from "../env.js";

// Postgres DATE columns (OID 1082) default to parsing into JS Date objects,
// which then serialize as full timestamps and break the plain "YYYY-MM-DD"
// DateString contract shared with the client. Keep them as raw strings.
pg.types.setTypeParser(1082, (value: string) => value);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
});
