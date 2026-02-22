// Todos - Main Entry Point
// This file bootstraps the application

import { app } from "./app.ts";
import { closeConnection } from "./db/index.ts";

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
    Deno.exit(0);
  } catch (error) {
    log("error", "Error during shutdown", { error: String(error) });
    Deno.exit(1);
  }
}

// Register signal handlers
Deno.addSignalListener("SIGTERM", () => shutdown("SIGTERM"));
Deno.addSignalListener("SIGINT", () => shutdown("SIGINT"));

// Initialize application
function initialize() {
  try {
    log("info", "Starting Todos service", { port });
  } catch (error) {
    log("error", "Initialization failed", { error: String(error) });
    throw error;
  }
}

// Start the server
try {
  initialize();
  Deno.serve({ port }, app.fetch);
} catch (error: unknown) {
  log("error", "Failed to start server", { error: String(error) });
  Deno.exit(1);
}
