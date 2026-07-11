/**
 * CRIAS API Client
 * Handles all HTTP requests to the backend
 */

const API_BASE_URL = '/api';

class APIClient {
  constructor() {
    this.token = localStorage.getItem('crias_token');
  }

  getToken() {
    // Always get fresh token from localStorage
    this.token = localStorage.getItem('crias_token');
    return this.token;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('crias_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('crias_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Always get fresh token
    const token = this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();
      
      console.log(`API Response:`, data);

      if (!response.ok) {
        console.error('API Error Response:', { status: response.status, data });
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/pages/login.html';
        }
        // Handle validation errors (array of errors)
        let errorMsg = data.detail || data.message;
        if (data.errors && Array.isArray(data.errors)) {
          errorMsg = data.errors.map(e => e.msg || e.message).join(', ');
        }
        throw new Error(errorMsg || `Request failed (${response.status})`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error.message);
      // Network errors or JSON parse errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error - please check your connection');
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(fullName, email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password })
    });
    this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  // Firms endpoints
  async createFirm(firmData) {
    return this.request('/firms', {
      method: 'POST',
      body: JSON.stringify(firmData)
    });
  }

  async getFirms(page = 1, limit = 20, search = '') {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    return this.request(`/firms?${params}`);
  }

  async getFirm(id) {
    return this.request(`/firms/${id}`);
  }

  async updateFirm(id, firmData) {
    return this.request(`/firms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(firmData)
    });
  }

  async deleteFirm(id) {
    return this.request(`/firms/${id}`, { method: 'DELETE' });
  }

  async submitFinancialData(firmId, data) {
    return this.request(`/firms/${firmId}/data`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getFirmEntries(firmId, page = 1, limit = 20) {
    return this.request(`/firms/${firmId}/entries?page=${page}&limit=${limit}`);
  }

  // Prediction endpoints
  async predict(firmId, entryId = null, modelName = 'xgboost') {
    return this.request('/predict', {
      method: 'POST',
      body: JSON.stringify({ firmId, entryId, modelName })
    });
  }

  async getPredictionHistory(firmId, page = 1, limit = 20) {
    return this.request(`/predict/${firmId}?page=${page}&limit=${limit}`);
  }

  async getLatestPrediction(firmId) {
    return this.request(`/predict/${firmId}/latest`);
  }

  async getPrediction(predictionId) {
    return this.request(`/predict/prediction/${predictionId}`);
  }

  async explain(predictionId) {
    return this.request('/predict/explain', {
      method: 'POST',
      body: JSON.stringify({ predictionId })
    });
  }

  async generateCounterfactuals(predictionId, targetPd = 0.30) {
    return this.request('/predict/counterfactuals', {
      method: 'POST',
      body: JSON.stringify({ predictionId, targetPd })
    });
  }

  async getStrategies(predictionId) {
    return this.request('/predict/strategies', {
      method: 'POST',
      body: JSON.stringify({ predictionId })
    });
  }

  // Admin endpoints
  async getUsers(page = 1, limit = 20) {
    return this.request(`/admin/users?page=${page}&limit=${limit}`);
  }

  async updateUserRole(userId, role) {
    return this.request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  async deactivateUser(userId) {
    return this.request(`/admin/users/${userId}`, { method: 'DELETE' });
  }

  async getAuditLogs(page = 1, limit = 50, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    return this.request(`/admin/logs?${params}`);
  }

  async getModels() {
    return this.request('/admin/models');
  }

  async setActiveModel(modelName) {
    return this.request('/admin/models/active', {
      method: 'PUT',
      body: JSON.stringify({ modelName })
    });
  }
}

// Global API instance
const api = new APIClient();
