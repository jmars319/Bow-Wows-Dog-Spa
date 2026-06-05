function buildUrl(baseUrl, path, params) {
  const url = new URL(`${baseUrl}${path}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.pathname + url.search;
}

async function request(baseUrl, method, path, body, options = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(buildUrl(baseUrl, path, options.params), {
    method,
    credentials: 'include',
    headers: isFormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Request failed with status ${response.status}`);
    error.response = { status: response.status, data };
    throw error;
  }
  return { data };
}

function createApi(baseUrl) {
  return {
    get: (path, options) => request(baseUrl, 'GET', path, undefined, options),
    post: (path, body, options) => request(baseUrl, 'POST', path, body, options),
    put: (path, body, options) => request(baseUrl, 'PUT', path, body, options),
    delete: (path, options) => request(baseUrl, 'DELETE', path, undefined, options),
  };
}

export const api = createApi('/api/admin');
export const publicApi = createApi('/api/public');
