import { PERMISSIONS } from '../models/Permission.js';

// Middleware to check if user has specific permission
export const hasPermission = (requiredPermission) => {
  return (req, res, next) => {
    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Pharmacy owner has all permissions within their pharmacy
    if (req.user.role === 'pharmacy_owner') {
      return next();
    }

    // Check if user has the required permission
    const userPermissions = req.user.permissions || [];
    
    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: `Permission denied. Required: ${requiredPermission}`,
      });
    }

    next();
  };
};

// Middleware to check if user has any of the required permissions
export const hasAnyPermission = (...permissions) => {
  return (req, res, next) => {
    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Pharmacy owner has all permissions within their pharmacy
    if (req.user.role === 'pharmacy_owner') {
      return next();
    }

    // Check if user has any of the required permissions
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        message: `Permission denied. Required one of: ${permissions.join(', ')}`,
      });
    }

    next();
  };
};

// Middleware to check if user has all required permissions
export const hasAllPermissions = (...permissions) => {
  return (req, res, next) => {
    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Pharmacy owner has all permissions within their pharmacy
    if (req.user.role === 'pharmacy_owner') {
      return next();
    }

    // Check if user has all required permissions
    const userPermissions = req.user.permissions || [];
    const hasAll = permissions.every(perm => userPermissions.includes(perm));

    if (!hasAll) {
      return res.status(403).json({
        message: `Permission denied. Required all of: ${permissions.join(', ')}`,
      });
    }

    next();
  };
};













