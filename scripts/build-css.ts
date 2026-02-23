#!/usr/bin/env -S deno run --permission-set=build
/**
 * Build Tailwind CSS using Deno's npm compatibility
 */

import autoprefixer from "npm:autoprefixer@10";
import cssnano from "npm:cssnano@7";
import postcss from "npm:postcss@8";
import tailwindcss from "npm:tailwindcss@3";

const inputPath = new URL("../src/public/input.css", import.meta.url).pathname;
const outputPath = new URL("../src/public/output.css", import.meta.url)
  .pathname;
const configPath = new URL("../tailwind.config.js", import.meta.url).pathname;

// Read input CSS
const css = await Deno.readTextFile(inputPath);

// Load config
const config = (await import(`file://${configPath}`)).default;

// Process with PostCSS + Tailwind
const result = await postcss([
  tailwindcss(config),
  autoprefixer(),
  cssnano({ preset: "default" }),
]).process(css, {
  from: inputPath,
  to: outputPath,
});

// Write output
await Deno.writeTextFile(outputPath, result.css);

console.log(`✓ Built ${outputPath}`);
