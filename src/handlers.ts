import path from "path";
import { BrowserErrorHandler, PlaywrightCrawlingContext } from "crawlee";
import { writeFile } from "fs/promises";
import {
  CONTENT_FAILURE_LOCAL_PATH,
  SCREENSHOT_FAILURE_LOCAL_PATH,
} from "./config.js";
import { saveNavigation } from "./sinks/clickhouse.js";
import { putContentHtml, putScreenshotPng } from "./sinks/contrail.js";
import { Navigation, NavigationOutcome } from "./types/navigation.js";

/**
 * Middleware for handling Navigation initialization for PlaywrightCrawler request processing.
 *
 * @param ctx - The PlaywrightCrawlingContext object containing request information.
 */
export async function playwrightNavigationInit(
  ctx: PlaywrightCrawlingContext,
): Promise<void> {
  const { request, log, session, proxyInfo } = ctx;
  // Create a new Navigation object for each request
  // chained to the previous Navigation when present.
  const { officeCode, parentId, navigation, ...tags } = request.userData;
  const proxy = proxyInfo
    ? {
        host: proxyInfo.hostname,
        port: proxyInfo.port,
        user: proxyInfo.username,
      }
    : undefined;

  tags.requestId = request.id;
  const prevNav = navigation as Navigation | undefined;
  const nav = new Navigation(
    prevNav?.id,
    request.retryCount,
    parentId,
    officeCode,
    session?.id,
    proxy,
    request.method,
    request.url,
    request.headers,
    tags,
  );
  request.userData.navigation = nav;

  log.info("Beginning new Navigation.", {
    state: request.state,
    id: nav.id,
    attempt: nav.attempt,
    url: request.url,
    officeCode: officeCode,
    proxyInfo: proxyInfo,
    requestId: request.id,
  });
}

export async function playwrightNavigationLanding(
  ctx: PlaywrightCrawlingContext,
): Promise<void> {
  const { request, log, response } = ctx;
  const nav = request.userData.navigation as Navigation | undefined;

  if (!nav) {
    log.error("Navigation not found in request.userData!", {
      requestId: request.id,
      url: request.url,
      responseUrl: response?.url(),
    });
    throw new Error("Navigation not found in request.userData!");
  }

  if (!response) {
    log.warning("No response found for request!", {
      id: nav.id,
      url: request.url,
      requestId: request.id,
    });
    return;
  }

  await response.finished();

  const remote = await response.serverAddr();
  const security = (await response.securityDetails()) ?? undefined;
  const requestHeaders = await response.request().allHeaders();
  const responseHeaders = await response.allHeaders();

  log.info("Initial page landing made for request.", {
    state: request.state,
    id: nav.id,
    url: request.url,
    status: response.status(),
    responseUrl: response.url(),
    remoteAddress: remote?.ipAddress,
    remotePort: remote?.port,
    securityDetails: security,
  });

  // Capture initial landing state from response.
  nav.declareLanding(
    response.url(),
    requestHeaders,
    response.status(),
    responseHeaders,
    remote?.ipAddress,
    remote?.port,
    security,
  );
}

/**
 * Retry handler for Playwright browser errors. Intended for use with
 * the `errorHandler` attribute of a `PlaywrightCrawlerOptions` when
 * constructing a `PlaywrightCrawler`.
 * @param ctx The crawling context.
 * @param error The error that occurred.
 * @returns A promise that resolves when the handler is complete.
 */
export const playwrightRetryHandler: BrowserErrorHandler<
  PlaywrightCrawlingContext
> = async (ctx, error): Promise<void> => {
  await playwrightExceptionHandler(NavigationOutcome.Retry, ctx, error);
};

/**
 * Handles failures that occur during Playwright crawling. Intended for
 * the `failedRequestHandler` attribute of `PlaywrightCrawlerOptions`
 * when constructing a `PlaywrightCrawler`.
 * @param ctx The crawling context.
 * @param error The error that occurred.
 * @returns A promise that resolves when the handling is complete.
 */
export const playwrightFailureHandler: BrowserErrorHandler<
  PlaywrightCrawlingContext
> = async (ctx, error): Promise<void> => {
  await playwrightExceptionHandler(NavigationOutcome.Failure, ctx, error);
};

/**
 * Handles exceptions that occur during Playwright crawling, including Navigation data attachment and saving.
 *
 * @param outcome - The navigation outcome.
 * @param ctx - The Playwright crawling context.
 * @param error - The error that occurred.
 */
async function playwrightExceptionHandler(
  outcome: NavigationOutcome,
  ctx: PlaywrightCrawlingContext,
  error: Error,
): Promise<void> {
  const { request, response, page, log, session } = ctx;
  const nav = request.userData.navigation as Navigation | undefined;

  log.exception(error, "Encountered an Error during Navigation!", {
    state: request.state,
    id: nav?.id,
    attempt: nav?.attempt,
    requestId: request.id,
    url: request.url,
    responseUrl: response?.url(),
    loadedUrl: request.loadedUrl,
    error,
  });
  nav?.declareException(error);

  // Use indepenedent try/catch wrappers around Page interactions.
  let title: string | undefined;
  let url: string | undefined;
  try {
    title = await page.title();
    url = page.url();
  } catch (error) {
    log.warning("Failed to retrieve page title!", {
      id: nav?.id,
      attempt: nav?.attempt,
      requestId: request.id,
      error,
    });
  }

  let content: string | undefined;
  try {
    content = await page.content();
  } catch (error) {
    log.warning("Failed to retrieve page content!", {
      id: nav?.id,
      attempt: nav?.attempt,
      requestId: request.id,
      error,
    });
  }

  let screenshot: Buffer | undefined;
  try {
    screenshot = await page.screenshot({ fullPage: true });
  } catch (error) {
    log.warning("Failed to retrieve page screenshot!", {
      id: nav?.id,
      attempt: nav?.attempt,
      requestId: request.id,
      error,
    });
  }

  // Mark session as bad.
  // TODO: Add more robust session management.
  if (session) {
    session.markBad();
  }

  if (nav instanceof Navigation) {
    await saveNavigation(
      nav.declareEnding(
        outcome,
        url ?? response?.url() ?? request.loadedUrl,
        title,
        content ? await putContentHtml(nav.id, content) : undefined,
        screenshot ? await putScreenshotPng(nav.id, screenshot) : undefined,
      ),
    );
  }

  if (SCREENSHOT_FAILURE_LOCAL_PATH && screenshot) {
    await writeFile(
      path.join(
        SCREENSHOT_FAILURE_LOCAL_PATH,
        `${request.userData.id ?? request.id}_screenshot.png`,
      ),
      screenshot,
    );
  }
  if (CONTENT_FAILURE_LOCAL_PATH && content) {
    await writeFile(
      path.join(
        CONTENT_FAILURE_LOCAL_PATH,
        `${request.userData.id ?? request.id}_content.html`,
      ),
      content,
    );
  }
}
