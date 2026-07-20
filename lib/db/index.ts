import { Pool } from "pg";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

config({path: ".env"})

const sql = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 7000, // 7 seconds connection timeout
})

export const db = drizzle(sql,{schema})

