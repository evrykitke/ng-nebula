import { HttpErrorResponse } from '@angular/common/http';
import { ApiException } from '../service-proxies/service-proxies';

/** The server's error shape: RFC 9457 problem details (`application/problem+json`). */
interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
}

/**
 * A single, fully-described API failure. Every failed request is normalised to
 * this shape by the API interceptor before it reaches a component, so callers
 * never have to know whether the throw came from Angular's HttpClient or a
 * NSwag proxy. `requestId` correlates with the server's log for that request.
 */
export class ApiError extends Error {
  /** Brand for cheap, cross-bundle instance checks. */
  readonly isApiError = true;

  constructor(
    /** HTTP status, or 0 when the server could not be reached. */
    readonly status: number,
    /** The problem's `title` (e.g. `Unprocessable Entity`). */
    readonly title: string,
    /** Human-readable message: the problem `detail` when the server sent one. */
    override readonly message: string,
    /** Server request id (from the `x-request-id` header) for log correlation. */
    readonly requestId?: string,
    /** The request that failed, for logging/debugging. */
    readonly method?: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static is(obj: unknown): obj is ApiError {
    return obj instanceof ApiError || (obj as ApiError | null)?.isApiError === true;
  }
}

/**
 * Normalise any thrown error into an {@link ApiError}. Handles an already-built
 * `ApiError`, Angular's `HttpErrorResponse` (raw HTTP layer / interceptor), and
 * NSwag's `ApiException` (which carries the raw body as a string), reading the
 * problem-details `title`/`detail` from whichever arrived.
 */
export function toApiError(err: unknown, req?: { method: string; url: string }): ApiError {
  if (ApiError.is(err)) return err;

  if (err instanceof HttpErrorResponse) {
    // A status of 0 means the request never reached the server.
    if (err.status === 0) {
      return new ApiError(0, 'network', 'Cannot reach the server.', undefined, req?.method, err.url ?? req?.url);
    }
    const problem = asProblem(err.error);
    const requestId = err.headers?.get('x-request-id') ?? undefined;
    return build(err.status, problem, err.statusText || 'Request failed', requestId, req?.method, err.url ?? req?.url);
  }

  if (ApiException.isApiException(err)) {
    const problem = asProblem(parseJson(err.response));
    const requestId = (err.headers?.['x-request-id'] as string | undefined) ?? undefined;
    return build(err.status, problem, err.message || 'Request failed', requestId, req?.method, req?.url);
  }

  return new ApiError(0, 'unknown', err instanceof Error ? err.message : 'Unexpected error', undefined, req?.method, req?.url);
}

/** Accessor for call sites that only need status/title/message. */
export function apiErrorInfo(err: unknown): { status: number; title?: string; message?: string } {
  const e = toApiError(err);
  return { status: e.status, title: e.title, message: e.message };
}

function build(
  status: number,
  problem: ProblemDetails | undefined,
  fallbackMessage: string,
  requestId?: string,
  method?: string,
  url?: string,
): ApiError {
  const title = problem?.title ?? `http_${status}`;
  const message = problem?.detail ?? problem?.title ?? fallbackMessage;
  return new ApiError(status, title, message, requestId, method, url);
}

function asProblem(body: unknown): ProblemDetails | undefined {
  if (body && typeof body === 'object') return body as ProblemDetails;
  return undefined;
}

function parseJson(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
