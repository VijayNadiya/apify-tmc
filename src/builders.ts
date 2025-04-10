import { PlaywrightCrawler, PlaywrightRequestHandler } from "crawlee";
import {
  CRAWL_BROWSER_INGOGNITO,
  CRAWL_BROWSER_TYPE,
  CRAWL_CONCURRENCY_MAX,
  CRAWL_HEADLESS,
  CRAWL_NAVIGATION_TIMEOUT_SECS,
  CRAWL_REQUESTS_PER_MINUTE_MAX,
  CRAWL_REQUEST_ATTEMPTS_MAX,
  CRAWL_REQUEST_HANDLER_TIMEOUT_SECS,
  CRAWL_SESSION_POOL_ENABLED,
  CRAWL_SESSION_REQUESTS_MAX,
} from "./config.js";
import {
  playwrightFailureHandler,
  playwrightNavigationInit,
  playwrightNavigationLanding,
  playwrightRetryHandler,
} from "./handlers.js";
import { proxyConfiguration } from "./proxy.js";
import { browserLauncher } from "./utils.js";

export function buildPlaywrightCrawler(
  router: PlaywrightRequestHandler,
): PlaywrightCrawler {
  return new PlaywrightCrawler({
    requestHandler: router,
    requestHandlerTimeoutSecs: CRAWL_REQUEST_HANDLER_TIMEOUT_SECS,
    navigationTimeoutSecs: CRAWL_NAVIGATION_TIMEOUT_SECS,
    headless: CRAWL_HEADLESS,
    maxRequestsPerMinute: CRAWL_REQUESTS_PER_MINUTE_MAX,
    maxRequestRetries: CRAWL_REQUEST_ATTEMPTS_MAX - 1,
    maxConcurrency: CRAWL_CONCURRENCY_MAX,
    useSessionPool: CRAWL_SESSION_POOL_ENABLED,
    sessionPoolOptions: {
      sessionOptions: {
        maxUsageCount: CRAWL_SESSION_REQUESTS_MAX,
      },
    },
    launchContext: {
      launcher: browserLauncher(CRAWL_BROWSER_TYPE),
      useIncognitoPages: CRAWL_BROWSER_INGOGNITO,
    },
    // proxyConfiguration,
    errorHandler: playwrightRetryHandler,
    failedRequestHandler: playwrightFailureHandler,
    preNavigationHooks: [playwrightNavigationInit],
    postNavigationHooks: [playwrightNavigationLanding],
  });
}
