export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found'): ApiError {
  return new ApiError(404, message);
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, message, details);
}
