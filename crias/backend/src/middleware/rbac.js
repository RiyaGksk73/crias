const rbac = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        type: 'https://httpstatuses.com/403',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

// Role hierarchy helpers
const isAnalyst = rbac(['analyst', 'manager', 'admin']);
const isManager = rbac(['manager', 'admin']);
const isAdmin = rbac(['admin']);

module.exports = {
  rbac,
  isAnalyst,
  isManager,
  isAdmin
};
