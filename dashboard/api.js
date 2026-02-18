export function createApi(apiBase) {
  return async (path, options = {}) => {
    const isForm = options.body instanceof FormData;
    const headers = options.headers || {};
    if (!isForm) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${apiBase}${path}`, { ...options, headers });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  };
}
