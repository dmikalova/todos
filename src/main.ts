// Todos - Main Entry Point
// This file bootstraps the application

import { app } from "./app.ts";
import { closeConnection } from "./db/index.ts";
import "./secrets.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");

// Structured logging helper
function log(
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log("info", `Received ${signal}, shutting down gracefully...`);

  try {
    await closeConnection();
    log("info", "Database connections closed");
    log("info", "Shutdown complete");
  } catch (error) {
    log("error", "Error during shutdown", { error: String(error) });
  }

  // Only exit in production — in dev, --watch needs the process to end naturally
  if (Deno.env.get("DENO_ENV") !== "development") {
    Deno.exit(signal === "SIGTERM" ? 0 : 1);
  }
}

// Register signal handlers
Deno.addSignalListener("SIGTERM", () => shutdown("SIGTERM"));
Deno.addSignalListener("SIGINT", () => shutdown("SIGINT"));

// Initialize application
async function initialize() {
  try {
    // In development, apply DB migrations on each restart (supports --watch=db/)
    if (Deno.env.get("DENO_ENV") === "development") {
      const cmd = new Deno.Command("deno", {
        args: ["task", "db:local"],
        stdout: "inherit",
        stderr: "inherit",
      });
      const result = await cmd.output();
      if (!result.success) {
        log("warn", "DB migration failed", { code: result.code });
      }
    }
    log("info", "Starting Todos service", { port });
  } catch (error) {
    log("error", "Initialization failed", { error: String(error) });
    throw error;
  }
}

// Start the server
try {
  await initialize();
  Deno.serve({ port }, app.fetch);
} catch (error: unknown) {
  log("error", "Failed to start server", { error: String(error) });
  Deno.exit(1);
}
