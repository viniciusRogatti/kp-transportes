const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

export function getRequestIdFromError(error: unknown) {
  if (!error || typeof error !== 'object') return null;

  const response = (error as {
    response?: {
      data?: { requestId?: unknown };
      headers?: Record<string, unknown> & { get?: (name: string) => unknown };
    };
  }).response;
  const headers = response?.headers;
  const headerValue = typeof headers?.get === 'function'
    ? headers.get('x-request-id')
    : headers?.['x-request-id'];
  const candidate = String(response?.data?.requestId || headerValue || '').trim();

  return REQUEST_ID_PATTERN.test(candidate) ? candidate : null;
}

export function withRequestReference(message: string, error: unknown) {
  const requestId = getRequestIdFromError(error);
  return requestId ? `${message} Referência: ${requestId}.` : message;
}
