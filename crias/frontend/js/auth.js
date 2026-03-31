/**
 * CRIAS Auth Module
 * Handles authentication state and guards
 */

const auth = {
  user: null,

  async init() {
    const token = localStorage.getItem('crias_token');
    if (!token) {
      return false;
    }

    try {
      const data = await api.getMe();
      this.user = data.user;
      return true;
    } catch (error) {
      console.error('Auth init error:', error);
      localStorage.removeItem('crias_token');
      return false;
    }
  },

  isAuthenticated() {
    return !!this.user;
  },

  getUser() {
    return this.user;
  },

  hasRole(roles) {
    if (!this.user) return false;
    if (typeof roles === 'string') roles = [roles];
    return roles.includes(this.user.role);
  },

  isAdmin() {
    return this.hasRole('admin');
  },

  isManager() {
    return this.hasRole(['manager', 'admin']);
  },

  async logout() {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    this.user = null;
    window.location.href = '/pages/login.html';
  },

  requireAuth() {
    if (!localStorage.getItem('crias_token')) {
      window.location.href = '/pages/login.html';
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.isAdmin()) {
      window.location.href = '/pages/dashboard.html';
      return false;
    }
    return true;
  }
};

// Auth guard for protected pages
async function protectPage(requiredRole = null) {
  const isAuth = await auth.init();
  
  if (!isAuth) {
    window.location.href = '/pages/login.html';
    return false;
  }

  if (requiredRole && !auth.hasRole(requiredRole)) {
    window.location.href = '/pages/dashboard.html';
    return false;
  }

  // Update UI with user info
  updateUserUI();
  return true;
}

function updateUserUI() {
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  
  if (userNameEl && auth.user) {
    userNameEl.textContent = auth.user.fullName;
  }
  
  if (userRoleEl && auth.user) {
    userRoleEl.textContent = auth.user.role;
    userRoleEl.className = `badge badge-${auth.user.role}`;
  }

  // Show/hide admin nav
  const adminNav = document.querySelectorAll('.admin-only');
  adminNav.forEach(el => {
    el.style.display = auth.isAdmin() ? '' : 'none';
  });
}
