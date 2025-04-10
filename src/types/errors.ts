import { Response } from "playwright";

class ResponseError extends Error {}

export class ResponseTimeoutError extends ResponseError {
  constructor(
    message: string,
    public readonly requestMethod?: string,
    public readonly requestUrl?: string,
    public readonly requestHeaders?: Record<string, string>,
  ) {
    super(message);
  }
}

export class ResponseStatusError extends ResponseError {
  constructor(
    message: string,
    public readonly requestMethod: string,
    public readonly requestUrl: string,
    public readonly requestHeaders: Record<string, string>,
    public readonly responseStatus: number,
    public readonly responseUrl: string,
    public readonly responseHeaders: Record<string, string>,
    public readonly responseBody?: string,
  ) {
    super(message);
  }

  static async fromResponse(
    message: string,
    response: Response,
  ): Promise<ResponseStatusError> {
    const {
      requestMethod,
      requestUrl,
      requestHeaders,
      responseStatus,
      responseUrl,
      responseHeaders,
      responseBody,
    } = await captureResponseContext(response);

    return new ResponseStatusError(
      message,
      requestMethod,
      requestUrl,
      requestHeaders,
      responseStatus,
      responseUrl,
      responseHeaders,
      responseBody,
    );
  }
}

export class ResponseBodyError extends Error {
  constructor(
    message: string,
    public readonly requestMethod: string,
    public readonly requestUrl: string,
    public readonly requestHeaders: Record<string, string>,
    public readonly responseStatus: number,
    public readonly responseUrl: string,
    public readonly responseHeaders: Record<string, string>,
    public readonly responseBody: string,
  ) {
    super(message);
  }

  static async fromResponse(
    message: string,
    response: Response,
    body: string,
  ): Promise<ResponseBodyError> {
    const {
      requestMethod,
      requestUrl,
      requestHeaders,
      responseStatus,
      responseUrl,
      responseHeaders,
    } = await captureResponseContext(response);

    return new ResponseBodyError(
      message,
      requestMethod,
      requestUrl,
      requestHeaders,
      responseStatus,
      responseUrl,
      responseHeaders,
      body,
    );
  }
}

async function captureResponseContext(response: Response) {
  const request = response.request();
  const requestHeaders = await request
    .allHeaders()
    .catch(() => request.headers());
  const responseHeaders = await response
    .allHeaders()
    .catch(() => response.headers());
  const text = await response.text().catch(() => undefined);

  return {
    requestMethod: request.method(),
    requestUrl: request.url(),
    requestHeaders,
    responseStatus: response.status(),
    responseUrl: response.url(),
    responseHeaders,
    responseBody: text,
  };
}
