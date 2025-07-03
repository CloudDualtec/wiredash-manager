
// Detect the current host and use it for API calls instead of hardcoded localhost
const getApiBaseUrl = () => {
  // If we're in development and accessing via localhost, use localhost for backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  
  // For other hosts (IP access), use the same host but port 5000 for backend
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5000/api`;
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // User management
  async getUsers() {
    return this.request('/users');
  }

  async createUser(userData: { name: string; email: string; password: string; enabled?: boolean }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: Partial<{ name: string; email: string; password: string; enabled: boolean }>) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Router configuration
  async getRouterConfig() {
    return this.request('/config/router');
  }

  async saveRouterConfig(config: {
    routerType: string;
    endpoint: string;
    port?: string;
    user: string;
    password: string;
    useHttps?: boolean;
  }) {
    return this.request('/config/router', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // WireGuard configuration
  async getWireguardConfig() {
    return this.request('/config/wireguard');
  }

  async saveWireguardConfig(config: {
    endpointPadrao?: string;
    portaPadrao?: string;
    rangeIpsPermitidos?: string;
    dnsCliente?: string;
  }) {
    return this.request('/config/wireguard', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

export const apiService = new ApiService();
