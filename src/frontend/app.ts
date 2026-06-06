// Frontend app entry point
// This file is vendored and served as /vendor/app.js

// Self-hosted fonts (bundled via fontsource, inlined as data URLs by esbuild)
// Use latin-only subsets to keep bundle small (~54KB vs ~1.1MB for all subsets)
import "npm:@fontsource/noto-sans@5/latin-400.css";
import "npm:@fontsource/noto-sans@5/latin-500.css";
import "npm:@fontsource/noto-sans@5/latin-700.css";

// Import all components which register themselves via @customElement
import "./components/todo-app.ts";
