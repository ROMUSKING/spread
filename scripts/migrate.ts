#!/usr/bin/env tsx
/**
 * Minimal migration runner for Phase 0.
 * Executes the canonical DDL in packages/db/migrations in lexical order.
 * Usage: pnpm migrate   (after docker db up)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPostgresQueryable } from "@erp/db";

async function main() {
  const db = createPostgresQueryable();
  const migDir = join(process.cwd(), "packages/db/migrations");
  // Only the 0001 for MVP
  const files = ["0001_command_outbox_core.sql"];
  for (const f of files) {
    const sql = readFileSync(join(migDir, f), "utf8");
    console.log(`[migrate] applying ${f}`);
    // Naive split on ; for bootstrap (real would use better parser)
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const stmt of statements) {
      try {
        await (db as any).query(stmt + ";");
      } catch (e: any) {
        if (/already exists|duplicate/i.test(String(e.message))) {
          // idempotent ok
          continue;
        }
        console.warn(`[migrate] non-fatal on stmt: ${e.message?.slice(0, 120)}`);
      }
    }
  }
  console.log("[migrate] done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
