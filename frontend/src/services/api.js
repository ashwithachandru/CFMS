const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let accessToken = '';
let logoutHandler = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => {
  return accessToken;
};

export const registerLogoutHandler = (handler) => {
  logoutHandler = handler;
};

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  options.headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (accessToken) {
    options.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  // Ensure cookies (for refresh token) are transmitted in cross-origin requests
  options.credentials = 'include';
  
  let response;
  try {
    response = await fetch(url, options);
  } catch (netErr) {
    console.error(`[API Network Error] Could not reach ${url}:`, netErr.message);
    throw new Error(`Failed to connect to API server at ${BASE_URL}. Please verify the backend is running on port 4000.`);
  }
  
  // Automatic refresh token logic on 401 Unauthorized
  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    console.log('Access token expired. Attempting automatic silent refresh...');
    try {
      const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData.data.accessToken;
        setAccessToken(newAccessToken);
        
        // Retry the original request with the new access token
        options.headers['Authorization'] = `Bearer ${newAccessToken}`;
        response = await fetch(url, options);
      } else {
        console.warn('Session expired. Logging out user...');
        if (logoutHandler) {
          logoutHandler();
        }
      }
    } catch (err) {
      console.error('Token refresh request failed:', err.message);
      if (logoutHandler) {
        logoutHandler();
      }
    }
  }
  
  return response;
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  postFormData: (endpoint, formData, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { ...options.headers };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
      ...options
    });
  },
  put: (endpoint, body, options) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};
