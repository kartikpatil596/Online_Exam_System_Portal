/**
 * Global API Client module for handling REST requests to Flask backend.
 */
function getApiBaseUrl() {
    const customUrl = localStorage.getItem('custom_api_url');
    if (customUrl) return customUrl;

    const host = window.location.hostname;
    const protocol = window.location.protocol;

    // Local development or opening HTML file directly
    if (host === 'localhost' || host === '127.0.0.1' || host === '' || protocol === 'file:') {
        return 'http://localhost:5000/api';
    }

    // Default to relative /api for Netlify proxy or configured backend
    return '/api';
}

const API_BASE_URL = getApiBaseUrl();

async function apiRequest(endpoint, method = 'GET', body = null, customHeaders = {}) {
    const token = localStorage.getItem('access_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...customHeaders
    };

    const config = {
        method,
        headers
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        let response;
        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        } catch (netErr) {
            // Fallback attempt to http://localhost:5000/api if relative /api failed
            if (API_BASE_URL === '/api') {
                const fallbackUrl = `http://localhost:5000/api${endpoint}`;
                response = await fetch(fallbackUrl, config);
            } else {
                throw netErr;
            }
        }

        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            if (response.status === 401 && !endpoint.includes('/auth/login')) {
                // Token expired or invalid
                localStorage.removeItem('access_token');
                localStorage.removeItem('user_role');
                const rootPath = (typeof getAppRootUrl === 'function') ? getAppRootUrl() : './';
                window.location.href = rootPath + 'login.html';
            }
            throw new Error(data.error || data.message || `API error (${response.status})`);
        }
        return data;
    } catch (error) {
        console.error(`API Error [${method} ${endpoint}]:`, error);
        if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('NetworkError')) {
            throw new Error('Cannot connect to API server. Please ensure Flask backend is running on http://localhost:5000');
        }
        throw error;
    }
}
