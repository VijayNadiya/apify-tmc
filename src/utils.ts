import { Dictionary } from "crawlee";
import { format as formatDate, formatISO } from "date-fns";
import { BrowserType, Page, chromium, firefox, webkit } from "playwright";
import { decodeTime } from "ulid";
import { saveNavigation } from "./sinks/clickhouse.js";
import { putContentHtml, putScreenshotPng } from "./sinks/contrail.js";
import { Navigation, NavigationOutcome } from "./types/navigation.js";

export function formatDateInISO(date: Date | null | undefined) {
  if (date === undefined) {
    return undefined;
  }

  if (date === null) {
    return undefined;
  }

  return formatISO(date, { representation: "date" });
}

export function formatTimestampInISO(date: Date | null | undefined) {
  if (date === undefined) {
    return undefined;
  }

  if (date === null) {
    return undefined;
  }

  return formatISO(date, { representation: "complete" });
}

export function dateFromId(id: string) {
  return new Date(decodeTime(id));
}

export function dateFormatFromId(id: string, format: string) {
  return formatDate(dateFromId(id), format);
}

export function utcTimestampParts() {
  const now = new Date();
  const utcNow = new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  );
  const utcNowMs = now.getUTCMilliseconds();
  return { utcNow, utcNowMs };
}

export function parseDate(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  if (normalizedValue === undefined) {
    return undefined;
  }

  return new Date(normalizedValue);
}

export function normalizeText(value: string | null | undefined) {
  return undefinedIfEmptyString(value?.trim());
}

export function undefinedIfEmptyString(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return undefined;
  }

  if (value === "") {
    return undefined;
  }

  return value;
}

export function spawnUserData(userData: Dictionary): Dictionary {
  // Clone userData without stateful Navigation & attach parentId
  const { parentId, navigation, ...etc } = userData;
  const nav = navigation as Navigation | undefined;

  return {
    parentId: nav?.id,
    ...etc,
  };
}

export async function endNavigationAsSuccess(nav: Navigation, page: Page) {
  await endNavigation(NavigationOutcome.Success, nav, page);
}

export async function endNavigation(
  outcome: NavigationOutcome,
  nav: Navigation,
  page: Page,
) {
  await saveNavigation(
    nav.declareEnding(
      outcome,
      page.url(),
      await page.title(),
      await putContentHtml(nav.id, await page.content()),
      await putScreenshotPng(nav.id, await page.screenshot({ fullPage: true })),
    ),
  );
}

export function browserLauncher(name: string): BrowserType {
  switch (name) {
    case "chromium":
      return chromium;
    case "firefox":
      return firefox;
    case "webkit":
      return webkit;
    case "random":
      return [chromium, firefox, webkit][Math.floor(Math.random() * 3)];
    default:
      throw new Error(`Unsupported browser type: ${name}`);
  }
}
