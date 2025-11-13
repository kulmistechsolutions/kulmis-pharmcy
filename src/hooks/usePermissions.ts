import { useUser } from '@/contexts/UserContext'

export const usePermissions = () => {
  const { user } = useUser()

  const hasPermission = (permission: string): boolean => {
    if (!user) return false

    // Super admin has all permissions
    if (user.role === 'super_admin') return true

    // Pharmacy owner has all permissions
    if (user.role === 'pharmacy_owner') return true

    // Staff users need specific permissions
    if (user.role === 'staff') {
      return user.permissions?.includes(permission) || false
    }

    return false
  }

  const hasAnyPermission = (...permissions: string[]): boolean => {
    if (!user) return false

    if (user.role === 'super_admin' || user.role === 'pharmacy_owner') return true

    if (user.role === 'staff') {
      return permissions.some(perm => user.permissions?.includes(perm)) || false
    }

    return false
  }

  const hasAllPermissions = (...permissions: string[]): boolean => {
    if (!user) return false

    if (user.role === 'super_admin' || user.role === 'pharmacy_owner') return true

    if (user.role === 'staff') {
      return permissions.every(perm => user.permissions?.includes(perm)) || false
    }

    return false
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    user,
  }
}

