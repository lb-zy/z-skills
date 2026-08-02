#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const DEFAULT_VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const PRIORITY_SCORE = { P0: 4, P1: 3, P2: 2, P3: 1 };

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: node audit-ui.mjs <url-or-file> [options]

Options:
  --out <file>                   Also write the JSON report to a file
  --viewport <name:WIDTHxHEIGHT> Audit only the named custom viewports; repeatable
  --wait-for <selector>          Wait for a selector before auditing
  --wait-ms <milliseconds>       Additional stabilization delay (default: 0)
  --browser-path <path>          Chromium or Chrome executable
  --fail-on <P0|P1|P2|P3|none>  Exit 1 at or above this priority (default: none)
  --help                         Show this help
`);
  process.exit(exitCode);
}

function fail(message) {
  process.stderr.write(`audit-ui: ${message}\n`);
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
    out: null,
    viewports: [],
    waitFor: null,
    waitMs: 0,
    browserPath: null,
    failOn: "none",
    target: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help") usage();
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
    if (arg === "--fail-on") {
      const value = takeValue(args, index, arg);
      options.failOn = value.toLowerCase() === "none" ? "none" : value.toUpperCase();
      if (options.failOn !== "none" && !(options.failOn in PRIORITY_SCORE)) {
        fail("--fail-on must be P0, P1, P2, P3, or none");
      }
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

function loaders() {
  return [
    createRequire(pathToFileURL(path.join(process.cwd(), "package.json"))),
    createRequire(import.meta.url),
  ];
}

function requireDependency(name) {
  for (const loader of loaders()) {
    try {
      return loader(name);
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  fail(`missing dependency "${name}"; make it available from the current project or skill directory`);
}

function optionalDependency(name) {
  for (const loader of loaders()) {
    try {
      return loader(name);
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  return null;
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
  });
  if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
}

function finding(rule, priority, category, location, evidence, impact, recommendation, confidence = "high") {
  return { rule, priority, category, location, evidence, impact, recommendation, confidence };
}

async function inspectDom(page, viewport) {
  const raw = await page.evaluate(({ viewportWidth, mobile }) => {
    const results = [];
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const selector = (element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts = [];
      let current = element;
      while (current?.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        const classes = [...current.classList]
          .filter((name) => /^[a-zA-Z0-9_-]+$/.test(name))
          .slice(0, 2);
        if (classes.length) part += `.${classes.join(".")}`;
        const siblings = current.parentElement
          ? [...current.parentElement.children].filter((item) => item.tagName === current.tagName)
          : [];
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };
    const push = (item) => {
      if (results.length < 100) results.push(item);
    };

    const duplicateIds = new Map();
    for (const element of document.querySelectorAll("[id]")) {
      if (!element.id) continue;
      const items = duplicateIds.get(element.id) ?? [];
      items.push(element);
      duplicateIds.set(element.id, items);
    }
    for (const [id, elements] of duplicateIds) {
      if (elements.length > 1) {
        push({
          rule: "duplicate-id",
          priority: "P2",
          category: "accessibility",
          location: `#${CSS.escape(id)}`,
          evidence: `${elements.length} elements use the same id`,
          impact: "Labels, anchors, and scripted relationships can resolve to the wrong element.",
          recommendation: "Assign a unique id to each element and update every reference.",
          confidence: "high",
        });
      }
    }

    for (const image of document.querySelectorAll("img:not([alt])")) {
      if (!visible(image)) continue;
      push({
        rule: "image-alt",
        priority: "P2",
        category: "accessibility",
        location: selector(image),
        evidence: "Visible image has no alt attribute.",
        impact: "Assistive technology cannot determine whether the image is content or decoration.",
        recommendation: "Add meaningful alt text, or alt=\"\" when the image is intentionally decorative.",
        confidence: "high",
      });
    }

    for (const frame of document.querySelectorAll("iframe:not([title])")) {
      if (!visible(frame)) continue;
      push({
        rule: "frame-title",
        priority: "P2",
        category: "accessibility",
        location: selector(frame),
        evidence: "Visible iframe has no title attribute.",
        impact: "Screen-reader users cannot identify the embedded content before entering it.",
        recommendation: "Add a concise title that identifies the frame's purpose.",
        confidence: "high",
      });
    }

    const roleSelector = [
      "[role=button]",
      "[role=link]",
      "[role=checkbox]",
      "[role=radio]",
      "[role=switch]",
      "[role=tab]",
      "[role=menuitem]",
    ].join(",");
    for (const element of document.querySelectorAll(roleSelector)) {
      if (!visible(element) || element.matches("button, a[href], input, select, textarea")) continue;
      if (element.tabIndex >= 0 || element.getAttribute("aria-disabled") === "true") continue;
      push({
        rule: "custom-control-keyboard",
        priority: "P1",
        category: "interaction",
        location: selector(element),
        evidence: `${element.getAttribute("role")} control is not keyboard focusable`,
        impact: "Keyboard users cannot reach or operate the control.",
        recommendation: "Use the matching native element, or implement focus and keyboard behavior for the custom control.",
        confidence: "high",
      });
    }

    const root = document.documentElement;
    if (root.scrollWidth > viewportWidth + 1) {
      const suspects = [...document.querySelectorAll("body *")]
        .filter((element) => {
          if (!visible(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > viewportWidth + 1;
        })
        .slice(0, 5)
        .map(selector);
      push({
        rule: "horizontal-overflow",
        priority: "P1",
        category: "responsive",
        location: "document",
        evidence: `Document width is ${root.scrollWidth}px at a ${viewportWidth}px viewport${suspects.length ? `; candidates: ${suspects.join(", ")}` : ""}`,
        impact: "Content or controls can be clipped and the page may scroll sideways.",
        recommendation: "Constrain or reflow the reported elements at this viewport, then retest with long content.",
        confidence: "high",
      });
    }

    for (const element of [...document.querySelectorAll("body *")]) {
      if (!visible(element)) continue;
      const style = getComputedStyle(element);
      const clipsX = ["hidden", "clip"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const clipsY = ["hidden", "clip"].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      if (!clipsX && !clipsY) continue;
      if (!element.textContent?.trim() && !element.matches("button, a, input, select, textarea, [role]")) continue;
      push({
        rule: "clipped-content",
        priority: "P2",
        category: "responsive",
        location: selector(element),
        evidence: `Visible content exceeds a container that clips ${clipsX && clipsY ? "both axes" : clipsX ? "horizontally" : "vertically"}`,
        impact: "Text or controls may be partially hidden for this content and viewport.",
        recommendation: "Confirm whether truncation is intentional; otherwise allow wrapping, growth, or an explicit overflow affordance.",
        confidence: "review",
      });
    }

    if (!document.documentElement.lang) {
      push({
        rule: "document-language",
        priority: "P3",
        category: "accessibility",
        location: "html",
        evidence: "The document has no lang attribute.",
        impact: "Assistive technology may pronounce content using the wrong language rules.",
        recommendation: "Set the html lang attribute to the page's primary language.",
        confidence: "high",
      });
    }

    if (mobile && !document.querySelector('meta[name="viewport"]')) {
      push({
        rule: "viewport-meta",
        priority: "P1",
        category: "responsive",
        location: "head",
        evidence: "No viewport meta element is present for the mobile audit.",
        impact: "Mobile browsers may render a desktop layout and scale it down.",
        recommendation: "Add an appropriate viewport declaration and verify on a real mobile browser.",
        confidence: "high",
      });
    }

    if (mobile) {
      const targetSelector = "button, input:not([type=hidden]), select, textarea, [role=button], [role=checkbox], [role=radio], [role=switch], a[href]";
      for (const element of document.querySelectorAll(targetSelector)) {
        if (!visible(element) || element.disabled) continue;
        const style = getComputedStyle(element);
        if (element.matches("a[href]") && style.display === "inline") continue;
        const rect = element.getBoundingClientRect();
        if (rect.width >= 24 && rect.height >= 24) continue;
        push({
          rule: "target-size",
          priority: "P2",
          category: "interaction",
          location: selector(element),
          evidence: `Interactive target is ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
          impact: "The target may be difficult to activate accurately on a touch screen.",
          recommendation: "Provide at least a 24x24px target or verify that a WCAG target-size exception applies.",
          confidence: "review",
        });
      }
    }

    return results;
  }, { viewportWidth: viewport.width, mobile: viewport.width <= 480 });

  return raw.map((item) => ({ ...item, viewport: viewport.name }));
}

function describeNode(node) {
  const attributes = new Map();
  for (let index = 0; index < (node.attributes?.length ?? 0); index += 2) {
    attributes.set(node.attributes[index], node.attributes[index + 1]);
  }
  let description = node.nodeName.toLowerCase();
  if (attributes.get("id")) description += `#${attributes.get("id")}`;
  else if (attributes.get("class")) {
    const classes = attributes.get("class").trim().split(/\s+/).slice(0, 2).join(".");
    if (classes) description += `.${classes}`;
  }
  if (attributes.get("type")) description += `[type=${attributes.get("type")}]`;
  return description;
}

async function inspectAccessibilityTree(page, viewport) {
  const client = await page.context().newCDPSession(page);
  await client.send("Accessibility.enable");
  const { nodes } = await client.send("Accessibility.getFullAXTree");
  const interactiveRoles = new Set([
    "button",
    "checkbox",
    "combobox",
    "link",
    "menuitem",
    "radio",
    "searchbox",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "textbox",
  ]);
  const findings = [];

  for (const axNode of nodes) {
    const role = axNode.role?.value;
    if (axNode.ignored || !interactiveRoles.has(role) || String(axNode.name?.value ?? "").trim()) continue;
    let location = role;
    if (axNode.backendDOMNodeId) {
      try {
        const { node } = await client.send("DOM.describeNode", {
          backendNodeId: axNode.backendDOMNodeId,
          depth: 0,
        });
        location = describeNode(node);
      } catch {
        // Keep the role as a usable fallback location.
      }
    }
    findings.push({
      ...finding(
        "accessible-name",
        "P1",
        "accessibility",
        location,
        `${role} is exposed in the browser accessibility tree without a name`,
        "Screen-reader and voice-control users cannot identify the control's purpose.",
        "Provide a visible label or an equivalent accessible name that describes the action or field.",
      ),
      viewport: viewport.name,
    });
  }

  await client.detach();
  return findings;
}

function axePriority(impact) {
  if (impact === "critical" || impact === "serious") return "P1";
  if (impact === "moderate") return "P2";
  return "P3";
}

async function inspectWithAxe(page, viewport, axe) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () =>
    globalThis.axe.run(document, { resultTypes: ["violations"] }),
  );
  return result.violations.map((violation) => ({
    ...finding(
      `axe:${violation.id}`,
      axePriority(violation.impact),
      "accessibility",
      violation.nodes.slice(0, 3).flatMap((node) => node.target).join(", ") || "document",
      `${violation.help}; ${violation.nodes.length} affected node(s)`,
      violation.description,
      violation.nodes[0]?.failureSummary?.replace(/^Fix (?:all|any) of the following:\s*/i, "") ||
        "Follow the linked axe rule guidance and retest.",
    ),
    viewport: viewport.name,
    reference: violation.helpUrl,
  }));
}

function summarize(findings) {
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const item of findings) byPriority[item.priority] += 1;
  return { total: findings.length, byPriority };
}

function mergeAcrossViewports(findings) {
  const merged = new Map();
  for (const item of findings) {
    const { viewport, ...details } = item;
    const key = JSON.stringify(details);
    const existing = merged.get(key);
    if (existing) {
      if (!existing.viewports.includes(viewport)) existing.viewports.push(viewport);
    } else {
      merged.set(key, { ...details, viewports: [viewport] });
    }
  }
  return [...merged.values()];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = resolveTarget(options.target);
  const { chromium } = requireDependency("playwright");
  const axe = optionalDependency("axe-core");
  const browser = await launchBrowser(chromium, options.browserPath);
  const findings = [];
  const pages = [];
  const coverage = {
    playwright: true,
    axeCore: axe?.version ?? null,
    browserAccessibilityTree: !axe,
    notes: axe
      ? []
      : ["axe-core is not installed; browser accessibility-tree checks ran, but broader automated accessibility rules did not."],
  };

  try {
    for (const viewport of options.viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: "light",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));

      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
      await stabilize(page, options);
      findings.push(...(await inspectDom(page, viewport)));

      if (axe) {
        try {
          findings.push(...(await inspectWithAxe(page, viewport, axe)));
        } catch (error) {
          coverage.notes.push(`axe-core failed at ${viewport.name}: ${error.message}`);
          findings.push(...(await inspectAccessibilityTree(page, viewport)));
        }
      } else {
        findings.push(...(await inspectAccessibilityTree(page, viewport)));
      }

      for (const message of [...new Set(consoleErrors)].slice(0, 20)) {
        findings.push({
          ...finding(
            "runtime-error",
            "P2",
            "interaction",
            "page",
            message,
            "A runtime error can leave content or interactions incomplete.",
            "Reproduce the error, fix its source, and repeat the affected task.",
          ),
          viewport: viewport.name,
        });
      }

      pages.push({ viewport, pageUrl: page.url(), title: await page.title() });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const mergedFindings = mergeAcrossViewports(findings);
  mergedFindings.sort(
    (left, right) =>
      PRIORITY_SCORE[right.priority] - PRIORITY_SCORE[left.priority] ||
      left.rule.localeCompare(right.rule) ||
      left.location.localeCompare(right.location),
  );
  const report = {
    target,
    pages,
    coverage,
    summary: summarize(mergedFindings),
    findings: mergedFindings,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    const reportPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, json);
  }
  process.stdout.write(json);

  if (options.failOn !== "none") {
    const threshold = PRIORITY_SCORE[options.failOn];
    if (mergedFindings.some((item) => PRIORITY_SCORE[item.priority] >= threshold)) process.exitCode = 1;
  }
}

main().catch((error) => fail(error.stack || error.message));
