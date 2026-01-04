/**
 * HTTP helper for integration tests
 * Uses fetch API (available in Node.js 22+)
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:18080';

export interface ApiOptions extends RequestInit {
  token?: string;
  body?: unknown;
}

/**
 * Make an API request to the test gateway
 */
export async function api(path: string, options: ApiOptions = {}): Promise<Response> {
  const { token, body, headers = {}, ...restOptions } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const requestBody = body ? JSON.stringify(body) : undefined;

  return fetch(`${BASE_URL}${path}`, {
    ...restOptions,
    headers: requestHeaders,
    body: requestBody,
  });
}

/**
 * Parse JSON response or return text
 */
export async function parseResponse<T = unknown>(response: Response): Promise<{ status: number; data: T | string }> {
  const contentType = response.headers.get('content-type');
  
  let data: T | string;
  if (contentType?.includes('application/json')) {
    data = await response.json() as T;
  } else {
    data = await response.text();
  }
  
  return {
    status: response.status,
    data,
  };
}

/**
 * Helper to make authenticated API calls
 */
export async function authenticatedApi<T = unknown>(
  path: string,
  token: string,
  options: Omit<ApiOptions, 'token'> = {}
): Promise<{ status: number; data: T | string }> {
  const response = await api(path, { ...options, token });
  return parseResponse<T>(response);
}

