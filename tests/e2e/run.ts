#!/usr/bin/env -S deno run --allow-all
// E2E test runner using Playwright
// Launches browser and runs all E2E test specs

import { type Browser, chromium, type Page } from "playwright";

// Test configuration
const BASE_URL = Deno.env.get("E2E_BASE_URL") || "http://localhost:8000";
const HEADLESS = Deno.env.get("E2E_HEADLESS") !== "false";
const SLOW_MO = parseInt(Deno.env.get("E2E_SLOW_MO") || "0");

// Test state
interface TestContext {
  browser: Browser;
  page: Page;
  baseUrl: string;
}

// Test result tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  duration: number;
}

const results: TestResult[] = [];

// Test registration
type TestFn = (ctx: TestContext) => Promise<void>;
const tests: { name: string; fn: TestFn }[] = [];

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

// Assertions
export function expect(value: unknown) {
  return {
    toBe(expected: unknown) {
      if (value !== expected) {
        throw new Error(`Expected ${expected} but got ${value}`);
      }
    },
    toContain(expected: string) {
      if (typeof value !== "string" || !value.includes(expected)) {
        throw new Error(`Expected "${value}" to contain "${expected}"`);
      }
    },
    toBeTruthy() {
      if (!value) {
        throw new Error(`Expected truthy value but got ${value}`);
      }
    },
    toBeFalsy() {
      if (value) {
        throw new Error(`Expected falsy value but got ${value}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof value !== "number" || value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toHaveLength(expected: number) {
      const arr = value as unknown[];
      if (!Array.isArray(arr) || arr.length !== expected) {
        throw new Error(
          `Expected array of length ${expected} but got ${arr?.length}`,
        );
      }
    },
  };
}

// Import all test specs
// Note: Dynamic imports load the test files
async function loadTests() {
  await import("./task-crud.spec.ts");
  await import("./next-page.spec.ts");
  await import("./filter.spec.ts");
  await import("./context.spec.ts");
  await import("./import-export.spec.ts");
}

// Run all tests
async function runTests() {
  console.log(`\n🎭 Playwright E2E Tests`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Headless: ${HEADLESS}`);
  console.log("");

  // Launch browser
  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
  });

  try {
    for (const { name, fn } of tests) {
      const page = await browser.newPage();
      const ctx: TestContext = {
        browser,
        page,
        baseUrl: BASE_URL,
      };

      const start = performance.now();
      try {
        await fn(ctx);
        const duration = performance.now() - start;
        results.push({ name, passed: true, duration });
        console.log(`✅ ${name} (${Math.round(duration)}ms)`);
      } catch (error) {
        const duration = performance.now() - start;
        results.push({
          name,
          passed: false,
          error: error instanceof Error ? error : new Error(String(error)),
          duration,
        });
        console.log(`❌ ${name} (${Math.round(duration)}ms)`);
        console.log(`   Error: ${error}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log("");
  console.log(
    `📊 Results: ${passed}/${total} passed (${Math.round(totalTime)}ms)`,
  );

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`   - ${result.name}`);
      if (result.error) {
        console.log(`     ${result.error.message}`);
      }
    }
    Deno.exit(1);
  }
}

// Main
await loadTests();
await runTests();
