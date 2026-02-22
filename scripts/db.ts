#!/usr/bin/env -S deno run --allow-run --allow-env
/**
 * Atlas database schema management wrapper
 *
 * Automatically fetches DATABASE_URL_SESSION from Google Secret Manager,
 * or uses the environment variable if set.
 *
 * Usage:
 *   deno task db:apply   # Apply schema changes
 *   deno task db:diff    # Show planned changes
 *   deno task db:seed    # Insert default data
 */

const APP_NAME = "todos";
const SCHEMA_NAME = "todos";
const GCP_PROJECT = "mklv-infrastructure";

async function getDatabaseUrl(): Promise<string> {
  // Check environment variable first
  const envUrl = Deno.env.get("DATABASE_URL_SESSION");
  if (envUrl) {
    console.log("Using DATABASE_URL_SESSION from environment");
    return envUrl;
  }

  // Fetch session pooler URL from Secret Manager (required for Atlas prepared statements)
  console.log("Fetching DATABASE_URL_SESSION from Secret Manager...");
  const secretName = `${APP_NAME}-database-url-session`;

  const command = new Deno.Command("gcloud", {
    args: [
      "secrets",
      "versions",
      "access",
      "latest",
      `--secret=${secretName}`,
      `--project=${GCP_PROJECT}`,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr);
    console.error(`Failed to fetch secret: ${errorMsg}`);
    console.error(
      "\nMake sure you're authenticated with gcloud and have access to the secret.",
    );
    Deno.exit(1);
  }

  return new TextDecoder().decode(stdout).trim();
}

async function runAtlas(
  subcommand: string,
  databaseUrl: string,
): Promise<void> {
  const repoRoot = new URL("../", import.meta.url).pathname;
  const schemaFile = `${repoRoot}db/schema.hcl`;

  const args = [
    "schema",
    subcommand,
    "--to",
    `file://${schemaFile}`,
    "--url",
    databaseUrl,
    "--schema",
    SCHEMA_NAME,
  ];

  // Add --auto-approve for apply
  if (subcommand === "apply") {
    args.push("--auto-approve");
  }

  console.log(`Running: atlas schema ${subcommand}\n`);

  const command = new Deno.Command("atlas", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();

  if (code !== 0) {
    Deno.exit(code);
  }
}

async function runTruncate(databaseUrl: string): Promise<void> {
  console.log("Dropping all tables in schema (Atlas will recreate them)...\n");

  const sql = `
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['task_history', 'task_contexts', 'recurrence_rules',
                         'saved_filters', 'tasks', 'context_time_windows',
                         'contexts', 'projects'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = '${SCHEMA_NAME}' AND table_name = tbl) THEN
      EXECUTE format('DROP TABLE %I.%I CASCADE', '${SCHEMA_NAME}', tbl);
      RAISE NOTICE 'Dropped: %.%', '${SCHEMA_NAME}', tbl;
    END IF;
  END LOOP;
END $$;
`;

  const command = new Deno.Command("psql", {
    args: [databaseUrl, "-c", sql],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();

  if (code !== 0) {
    Deno.exit(code);
  }

  console.log("\nAll tables dropped successfully.");
}

async function runSeed(databaseUrl: string): Promise<void> {
  console.log("Seeding default data...\n");

  // Insert default "work" context with Mon-Fri 9am-5pm time windows
  const sql = `
-- Create default work context if it doesn't exist
INSERT INTO ${SCHEMA_NAME}.contexts (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'work')
ON CONFLICT DO NOTHING;

-- Create time windows for Mon-Fri (days 1-5)
INSERT INTO ${SCHEMA_NAME}.context_time_windows (context_id, day_of_week, start_time, end_time)
SELECT '00000000-0000-0000-0000-000000000001', day, '09:00'::time, '17:00'::time
FROM generate_series(1, 5) AS day
ON CONFLICT DO NOTHING;

SELECT 'Seeded default work context' AS status;
`;

  const command = new Deno.Command("psql", {
    args: [databaseUrl, "-c", sql],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();

  if (code !== 0) {
    Deno.exit(code);
  }

  console.log("\nSeed data inserted successfully.");
}

// Main
const subcommand = Deno.args[0];

if (
  !subcommand ||
  !["apply", "diff", "truncate", "seed"].includes(subcommand)
) {
  console.log("Usage: db.ts <apply|diff|truncate|seed>");
  console.log("");
  console.log("Commands:");
  console.log("  apply     Apply schema changes to the database");
  console.log("  diff      Show planned schema changes without applying");
  console.log(
    "  truncate  Truncate all tables (use before destructive migrations)",
  );
  console.log("  seed      Insert default data (work context)");
  Deno.exit(1);
}

const databaseUrl = await getDatabaseUrl();

if (subcommand === "truncate") {
  await runTruncate(databaseUrl);
} else if (subcommand === "seed") {
  await runSeed(databaseUrl);
} else {
  await runAtlas(subcommand, databaseUrl);
}
