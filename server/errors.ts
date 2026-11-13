/**
 * The HTTP statuses this API actually uses. Narrow enough that Hono's `c.json`
 * accepts it without a cast, broad enough for the failures the routes produce.
 */
export type ApiStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

/**
 * An API failure that is safe to show a person.
 *
 * The frontend already has `SaveError` for the same job. This is the server-side
 * twin: it carries the HTTP status, the machine-readable code the repository
 * maps back into `SaveError`, and the dotted config path when the failure is a
 * validation problem.
 */
export class ApiError extends Error {
  constructor(
    readonly status: ApiStatus,
    message: string,
    readonly code?: string,
    readonly path?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
