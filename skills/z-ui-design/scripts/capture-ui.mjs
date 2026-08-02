#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const DEFAULT_VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: node capture-ui.mjs <url-or-file> [options]

Options:
  --out <directory>              Output directory (default: ui-captures)
  --viewport <name:WIDTHxHEIGHT> Capture only the named custom viewports; repeatable
  --wait-for <selector>          Wait for a selector before capture
  --wait-ms <milliseconds>       Additional stabilization delay (default: 0)
  --browser-path <path>          Chromium or Chrome executable
  --viewport-only                Capture the viewport instead of the full page
  --help                         Show this help
`);
  process.exit(exitCode);
}

function fail(message) {
  process.stderr.write(`capture-ui: ${message}\n`);
  process.exit(1);
}

function takeValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function parseViewport(value) {
  const match = /^([a-zA-Z0-9_-]+):(\d+)x(\d+)$/.exec(value);
  if (!match) fail(`invalid viewport "${value}"; expected name:WIDTHxHEIGHT`);
  const width = Number(match[2]);
  const height = Number(match[3]);
  if (width < 240 || width > 7680 || height < 240 || height > 7680) {
    fail(`viewport "${value}" is outside the supported 240-7680 px range`);
  }
  return { name: match[1].toLowerCase(), width, height };
}

function parseArgs(args) {
  const options = {
    out: "ui-captures",
    viewports: [],
    waitFor: null,
    waitMs: 0,
    browserPath: null,
    fullPage: true,
    target: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help") usage();
    if (arg === "--viewport-only") {
      options.fullPage = false;
      continue;
    }
    if (arg === "--out") {
      options.out = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--viewport") {
      options.viewports.push(parseViewport(takeValue(args, index, arg)));
      index += 1;
      continue;
    }
    if (arg === "--wait-for") {
      options.waitFor = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--wait-ms") {
      options.waitMs = Number(takeValue(args, index, arg));
      if (!Number.isInteger(options.waitMs) || options.waitMs < 0 || options.waitMs > 60000) {
        fail("--wait-ms must be an integer between 0 and 60000");
      }
      index += 1;
      continue;
    }
    if (arg === "--browser-path") {
      options.browserPath = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) fail(`unknown option ${arg}`);
    if (options.target) fail("provide exactly one URL or file path");
    options.target = arg;
  }

  if (!options.target) usage(1);
  if (options.viewports.length === 0) options.viewports = DEFAULT_VIEWPORTS;
  const names = new Set();
  for (const viewport of options.viewports) {
    if (names.has(viewport.name)) fail(`duplicate viewport name "${viewport.name}"`);
    names.add(viewport.name);
  }
  return options;
}

function resolveTarget(value) {
  const filePath = path.resolve(value);
  if (fs.existsSync(filePath)) return pathToFileURL(filePath).href;

  const candidate = /^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/.test(value)
    ? `http://${value}`
    : value;
  let target;
  try {
    target = new URL(candidate);
  } catch {
    fail(`"${value}" is neither an existing file nor a valid URL`);
  }
  if (!["http:", "https:", "file:"].includes(target.protocol)) {
    fail(`unsupported URL protocol ${target.protocol}`);
  }
  return target.href;
}

function requireFromWorkspace(name) {
  const loaders = [
    createRequire(pathToFileURL(path.join(process.cwd(), "package.json"))),
    createRequire(import.meta.url),
  ];
  for (const loader of loaders) {
    try {
      return loader(name);
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  fail(`missing dependency "${name}"; make it available from the current project or skill directory`);
}

async function launchBrowser(chromium, explicitPath) {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) fail(`browser executable not found: ${explicitPath}`);
    return chromium.launch({ headless: true, executablePath: explicitPath });
  }

  const candidates = [
    null,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  let lastError;
  for (const executablePath of candidates) {
    if (executablePath && !fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Unable to launch Chromium. Run npx playwright install chromium or pass --browser-path. ${lastError?.message ?? ""}`,
  );
}

async function stabilize(page, options) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  if (options.waitFor) {
    await page.locator(options.waitFor).first().waitFor({ state: "visible", timeout: 30000 });
  }
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const pendingImages = [...document.images]
      .filter((image) => !image.complete)
      .map(
        (image) =>
          new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
      );
    await Promise.all(pendingImages);
  });
  if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = resolveTarget(options.target);
  const { chromium } = requireFromWorkspace("playwright");
  const browser = await launchBrowser(chromium, options.browserPath);
  const outputDirectory = path.resolve(options.out);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const captures = [];

  try {
    for (const viewport of options.viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: "light",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
      await stabilize(page, options);
      const filename = `${viewport.name}-${viewport.width}x${viewport.height}.png`;
      const screenshotPath = path.join(outputDirectory, filename);
      await page.screenshot({ path: screenshotPath, fullPage: options.fullPage });
      captures.push({
        viewport,
        path: screenshotPath,
        pageUrl: page.url(),
        title: await page.title(),
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(`${JSON.stringify({ target, fullPage: options.fullPage, captures }, null, 2)}\n`);
}

main().catch((error) => fail(error.stack || error.message));
