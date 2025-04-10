export const CORSEARCH_ENV =
  process.env.TMC_CORSEARCH_ENV ?? process.env.CORSEARCH_ENV ?? "development";

export const SCREENSHOT_FAILURE_LOCAL_PATH =
  process.env.TMC_SCREENSHOT_FAILURE_LOCAL_PATH ??
  process.env.SCREENSHOT_FAILURE_LOCAL_PATH;
export const SCREENSHOT_SUCCESS_LOCAL_PATH =
  process.env.TMC_SCREENSHOT_SUCCESS_LOCAL_PATH ??
  process.env.SCREENSHOT_SUCCESS_LOCAL_PATH;

export const CONTENT_FAILURE_LOCAL_PATH =
  process.env.TMC_CONTENT_FAILURE_LOCAL_PATH ??
  process.env.CONTENT_FAILURE_LOCAL_PATH;
export const CONTENT_SUCCESS_LOCAL_PATH =
  process.env.TMC_CONTENT_SUCCESS_LOCAL_PATH ??
  process.env.CONTENT_SUCCESS_LOCAL_PATH;

export const CLICKHOUSE_URL =
  process.env.TMC_CLICKHOUSE_URL ??
  process.env.CLICKHOUSE_URL ??
  "http://clickhouse.tmc.marquer.me";
export const CLICKHOUSE_DB =
  process.env.TMC_CLICKHOUSE_DB ??
  process.env.CLICKHOUSE_DB ??
  "tmc_development";
export const CLICKHOUSE_USER =
  process.env.TMC_CLICKHOUSE_USER ?? process.env.CLICKHOUSE_USER ?? "tmc-user";
export const CLICKHOUSE_PASSWORD =
  process.env.TMC_CLICKHOUSE_PASSWORD ??
  process.env.CLICKHOUSE_PASSWORD ??
  "1234abcd";

export const COVERAGE_WRITE_LOCAL_PATH =
  process.env.TMC_COVERAGE_WRITE_LOCAL_PATH ??
  process.env.COVERAGE_WRITE_LOCAL_PATH;

export const MARK_WRITE_LOCAL_PATH =
  process.env.TMC_MARK_WRITE_LOCAL_PATH ?? process.env.MARK_WRITE_LOCAL_PATH;

export const NAVIGATION_WRITE_LOCAL_PATH =
  process.env.TMC_NAVIGATION_WRITE_LOCAL_PATH ??
  process.env.NAVIGATION_WRITE_LOCAL_PATH;

export const PROXY_DISABLED = strToBool(
  process.env.TMC_PROXY_DISABLED ?? process.env.PROXY_DISABLED ?? "false",
);
export const PROXY_HOST = process.env.TMC_PROXY_HOST ?? process.env.PROXY_HOST;
export const PROXY_PORT = process.env.TMC_PROXY_PORT ?? process.env.PROXY_PORT;
export const PROXY_USER = process.env.TMC_PROXY_USER ?? process.env.PROXY_USER;
export const PROXY_PASSWORD =
  process.env.TMC_PROXY_PASSWORD ?? process.env.PROXY_PASSWORD;
export const PROXY_URL_TEMPLATE =
  process.env.TMC_PROXY_URL_TEMPLATE ?? process.env.PROXY_URL_TEMPLATE;

export const CRAWL_HEADLESS = strToBool(
  process.env.TMC_CRAWL_HEADLESS ?? process.env.CRAWL_HEADLESS ?? "true",
);
export const CRAWL_NAVIGATION_TIMEOUT_SECS = Number(
  process.env.TMC_CRAWL_NAVIGATION_TIMEOUT_SECS ??
    process.env.CRAWL_NAVIGATION_TIMEOUT_SECS ??
    "6000",
);
export const CRAWL_REQUEST_HANDLER_TIMEOUT_SECS = Number(
  process.env.TMC_CRAWL_REQUEST_HANDLER_TIMEOUT_SECS ??
    process.env.CRAWL_REQUEST_HANDLER_TIMEOUT_SECS ??
    "6000",
);
export const CRAWL_CONCURRENCY_MAX = Number(
  process.env.TMC_CRAWL_CONCURRENCY_MAX ??
    process.env.CRAWL_CONCURRENCY_MAX ??
    "5",
);
export const CRAWL_REQUESTS_PER_MINUTE_MAX = Number(
  process.env.TMC_CRAWL_REQUESTS_PER_MINUTE_MAX ??
    process.env.CRAWL_REQUESTS_PER_MINUTE_MAX ??
    "120",
);
export const CRAWL_REQUEST_ATTEMPTS_MAX = Number(
  process.env.TMC_CRAWL_REQUEST_ATTEMPTS_MAX ??
    process.env.CRAWL_REQUEST_ATTEMPTS_MAX ??
    "5",
);
export const CRAWL_SESSION_POOL_ENABLED = strToBool(
  process.env.TMC_CRAWL_SESSION_POOL_ENABLED ??
    process.env.CRAWL_SESSION_POOL_ENABLED ??
    "true",
);
export const CRAWL_SESSION_REQUESTS_MAX = Number(
  process.env.TMC_CRAWL_SESSION_REQUESTS_MAX ??
    process.env.CRAWL_SESSION_REQUESTS_MAX ??
    "20",
);
export const CRAWL_BROWSER_INGOGNITO = strToBool(
  process.env.TMC_CRAWL_BROWSER_INGOGNITO ??
    process.env.CRAWL_BROWSER_INGOGNITO ??
    "false",
);
export const CRAWL_BROWSER_TYPE =
  process.env.TMC_CRAWL_BROWSER_TYPE ??
  process.env.CRAWL_BROWSER_TYPE ??
  "chromium";

function strToBool(str: string) {
  switch (str?.toLowerCase().trim()) {
    case "true":
    case "1":
      return true;
    case "false":
    case "0":
      return false;
    default:
      return Boolean(str);
  }
}
