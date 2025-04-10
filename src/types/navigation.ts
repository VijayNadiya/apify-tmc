import { parse as parseUrl } from "tldts";
import { ulid } from "ulid";
import { utcTimestampParts } from "../utils.js";

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "TRACE"
  | "OPTIONS"
  | "CONNECT"
  | "PATCH";

export interface CollectedUrls {
  label: string[];
  url: string[];
}

export enum NavigationOutcome {
  Success = "Success",
  Retry = "Retry",
  Failure = "Failure",
}

export interface HttpProxy {
  host: string;
  port: number | string;
  user?: string;
}

interface IExceptional {
  exception_present?: boolean;
  exception_name?: string;
  exception_type?: string;
  exception_message?: string;
  exception_stack_trace?: string;
}

export class Navigation implements IExceptional {
  constructor(
    id: string | undefined,
    attempt: number | undefined,
    parent_id: string | undefined,
    office_code: string | undefined,
    session_id: string | undefined,
    request_proxy: HttpProxy | undefined,
    method: HttpMethod,
    url: string,
    headers: Record<string, string> | undefined,
    tags: object | undefined,
  ) {
    this.id = id ?? ulid();
    this.attempt = attempt ?? 0;
    this.parent_id = parent_id;
    this.office_code = office_code;
    const { utcNow, utcNowMs } = utcTimestampParts();
    this.started_at = utcNow;
    this.started_at_ms = utcNowMs;
    this.session_id = session_id;
    this.method = method;
    this.request_headers = headers;
    this.request_proxy = request_proxy;
    this.url = url;
    const parsedUrl = parseUrl(url);
    this.host = parsedUrl.hostname ?? undefined;
    this.domain = parsedUrl.domain ?? this.host;
    this.collected_urls = {
      label: [],
      url: [],
    };
    this.tags = tags;
  }

  id: string;
  attempt: number;
  parent_id?: string;
  outcome?: NavigationOutcome;
  started_at: Date;
  started_at_ms: number;
  ended_at?: Date;
  ended_at_ms?: number;
  domain?: string;
  host?: string;
  url: string;
  session_id?: string;
  method: HttpMethod;
  request_headers?: Record<string, string>;
  request_proxy?: HttpProxy;
  upstream_proxy?: HttpProxy;
  remote_address?: string;
  remote_port?: number;
  redirected?: boolean;
  security_details?: object;
  status_code?: number;
  response_headers?: Record<string, string>;
  landing_domain?: string;
  landing_host?: string;
  landing_url?: string;
  title?: string;
  content_location?: string;
  screenshot_location?: string;
  collected_urls: CollectedUrls;
  office_code?: string;
  tags?: object;
  exception_present?: boolean;
  exception_name?: string;
  exception_type?: string;
  exception_message?: string;
  exception_stack_trace?: string;

  collectUrls(label: string, urls: string[]) {
    for (const url of urls) {
      this.collectUrl(label, url);
    }
  }

  collectUrl(label: string, url: string) {
    this.collected_urls.label.push(label);
    this.collected_urls.url.push(url);
  }

  declareException(error: Error) {
    this.exception_present = true;
    this.exception_name = error.name;
    this.exception_type = error.constructor.name;
    this.exception_message = error.message;
    this.exception_stack_trace = error.stack;
  }

  declareLanding(
    url: string | undefined,
    requestHeaders?: Record<string, string>,
    status?: number,
    responseHeaders?: Record<string, string>,
    remoteAddress?: string,
    remotePort?: number,
    securityDetails?: object,
  ) {
    if (status) {
      this.status_code = status;
    }

    if (requestHeaders) {
      this.request_headers = requestHeaders;
    }

    if (responseHeaders) {
      this.response_headers = responseHeaders;
    }

    if (remoteAddress) {
      this.remote_address = remoteAddress;
    }

    if (remotePort) {
      this.remote_port = remotePort;
    }

    if (securityDetails) {
      this.security_details = securityDetails;
    }

    if (url === undefined) {
      return;
    }

    this.redirected = url !== this.url;
    this.landing_url = url;
    const parsedUrl = parseUrl(url);
    this.landing_host = parsedUrl.hostname ?? undefined;
    this.landing_domain = parsedUrl.domain ?? this.landing_host;
  }

  declareEnding(
    outcome: NavigationOutcome,
    landingUrl?: string,
    title?: string,
    contentLocation?: string,
    screenshotLocation?: string,
  ): Navigation {
    this.outcome = outcome;
    const { utcNow, utcNowMs } = utcTimestampParts();
    this.ended_at = utcNow;
    this.ended_at_ms = utcNowMs;
    if (landingUrl && landingUrl !== this.landing_url) {
      this.declareLanding(landingUrl);
    }
    this.title = title;
    this.content_location = contentLocation;
    this.screenshot_location = screenshotLocation;

    return this;
  }
}
