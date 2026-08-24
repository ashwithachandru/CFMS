const rbacRepo = require('../repositories/mssql/rbac.repository');

/**
 * Middleware factory enforcing RBAC module permissions for authenticated requests.
 * @param {string} moduleKey - e.g. 'warehouses', 'users', 'reports', 'sla', 'categories'
 * @param {'read' | 'write'} requiredAction - Action required ('read' or 'write')
 */
const requirePermission = (moduleKey, requiredAction = 'write') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const userId = req.user.userId || req.user.id;
      const role = req.user.role;

      // Administrators have full access unless specifically overridden
      const perm = await rbacRepo.getEffectiveUserPermission(userId, role, moduleKey);

      if (requiredAction === 'read' && !perm.canRead) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Read (View) permission revoked for module '${moduleKey}'`
        });
      }

      if (requiredAction === 'write' && !perm.canWrite) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Write (Edit) permission revoked for module '${moduleKey}'`
        });
      }

      next();
    } catch (err) {
      console.error(`RBAC middleware error on module '${moduleKey}':`, err);
      return res.status(500).json({ success: false, message: 'Internal server error evaluating permission' });
    }
  };
};

module.exports = {
  requirePermission
};
