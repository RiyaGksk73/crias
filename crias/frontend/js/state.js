/**
 * CRIAS State Management
 * Simple state management for the application
 */

const state = {
  // Current state
  data: {
    firms: [],
    currentFirm: null,
    currentPrediction: null,
    predictions: [],
    users: [],
    auditLogs: []
  },

  // Pagination state
  pagination: {
    firms: { page: 1, limit: 20, total: 0 },
    predictions: { page: 1, limit: 20, total: 0 },
    users: { page: 1, limit: 20, total: 0 },
    logs: { page: 1, limit: 50, total: 0 }
  },

  // Listeners
  listeners: {},

  // Get state value
  get(key) {
    return this.data[key];
  },

  // Set state value and notify listeners
  set(key, value) {
    this.data[key] = value;
    this.notify(key, value);
  },

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    };
  },

  // Notify listeners of state change
  notify(key, value) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(callback => callback(value));
    }
  },

  // Pagination helpers
  getPagination(key) {
    return this.pagination[key];
  },

  setPagination(key, pagination) {
    this.pagination[key] = { ...this.pagination[key], ...pagination };
  }
};

// Utility functions
const utils = {
  // Format date
  formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Format date with time
  formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Format number with commas
  formatNumber(num, decimals = 0) {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  // Format currency
  formatCurrency(num) {
    if (num === null || num === undefined) return '-';
    return '$' + this.formatNumber(num, 0);
  },

  // Format percentage
  formatPercent(num, decimals = 1) {
    if (num === null || num === undefined) return '-';
    return (num * 100).toFixed(decimals) + '%';
  },

  // Get risk class
  getRiskClass(riskLabel) {
    return riskLabel || 'low';
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Show alert message
  showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    alertContainer.appendChild(alert);

    setTimeout(() => {
      alert.remove();
    }, 5000);
  },

  // Show loading spinner
  showLoading(container) {
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.innerHTML = '<div class="spinner"></div>';
    container.innerHTML = '';
    container.appendChild(loading);
  },

  // Show empty state
  showEmpty(container, message = 'No data found') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>${message}</p>
      </div>
    `;
  },

  // Parse URL parameters
  getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }
};
