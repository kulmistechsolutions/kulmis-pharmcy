import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (!decoded || !decoded.id) {
        return res.status(401).json({ message: 'Not authorized, invalid token' });
      }

      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const isSuperAdmin = req.user.role === 'super_admin';
      const isStaff = req.user.role === 'staff';

      const accountId =
        isStaff && req.user.created_by
          ? req.user.created_by
          : req.user._id;

      const tenantScopeIds = isSuperAdmin
        ? null
        : Array.from(
            new Set(
              [
                accountId?.toString?.(),
                req.user._id?.toString?.(),
              ].filter(Boolean)
            )
          );

      req.accountId = accountId;
      req.tenantScopeIds = tenantScopeIds;
      req.isSuperAdminRequest = isSuperAdmin;
      req.user = req.user.toObject ? req.user.toObject() : req.user;
      req.user.tenantId = accountId;
      req.user.primaryAccountId = accountId;
      req.user.tenantScopeIds = tenantScopeIds;
      req.user.isSuperAdmin = isSuperAdmin;

      next();
    } catch (error) {
      console.error('Auth error:', error.message);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Not authorized, invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Not authorized, token expired' });
      }
      
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

const isPrivileged = (user = {}) =>
  user.role === 'super_admin' || user.role === 'pharmacy_owner';

const getUserPermissions = (user = {}) =>
  Array.isArray(user.permissions) ? user.permissions : [];

export const requireOwner = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (isPrivileged(req.user)) {
      return next();
    }

    return res.status(403).json({
      message: 'Only pharmacy owners or super admins can perform this action',
    });
  };
};

export const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (isPrivileged(req.user) || permissions.length === 0) {
      return next();
    }

    const userPermissions = getUserPermissions(req.user);
    const missing = permissions.filter(
      (perm) => !userPermissions.includes(perm)
    );

    if (missing.length > 0) {
      return res.status(403).json({
        message: 'Insufficient permissions to perform this action',
        missingPermissions: missing,
      });
    }

    next();
  };
};

export const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (isPrivileged(req.user) || permissions.length === 0) {
      return next();
    }

    const userPermissions = getUserPermissions(req.user);
    const hasAny = permissions.some((perm) => userPermissions.includes(perm));

    if (!hasAny) {
      return res.status(403).json({
        message: 'You do not have access to this resource',
        requiredPermissions: permissions,
      });
    }

    next();
  };
};

