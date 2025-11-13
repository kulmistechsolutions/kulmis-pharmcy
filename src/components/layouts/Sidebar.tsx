import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  DollarSign,
  FileText,
  TrendingUp,
  TestTube,
  BookOpen,
  Settings,
  CreditCard,
  Receipt,
  Shield,
  Users,
  X,
  Megaphone,
  Activity,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import { usePermissions } from '@/hooks/usePermissions'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation()
  const { user } = useUser()
  const { hasPermission } = usePermissions()

  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', permission: 'dashboard:view' },
    { icon: ShoppingCart, label: 'Sales', path: '/dashboard/sales', permission: 'sales:view' },
    { icon: Pill, label: 'Medicines', path: '/dashboard/medicines', permission: 'medicines:view' },
    { icon: DollarSign, label: 'Debts', path: '/dashboard/debts', permission: 'debts:view' },
    { icon: FileText, label: 'Expenses', path: '/dashboard/expenses', permission: 'expenses:view' },
    { icon: FileText, label: 'Invoices', path: '/dashboard/invoices', permission: 'invoices:view' },
    { icon: Receipt, label: 'Transactions', path: '/dashboard/transactions', permission: 'transactions:view' },
    { icon: TrendingUp, label: 'Reports', path: '/dashboard/reports', permission: 'reports:view' },
    { icon: TestTube, label: 'Lab Cashier', path: '/dashboard/lab-cashier', permission: 'lab:view' },
    { icon: BookOpen, label: 'Tutorials', path: '/dashboard/tutorials', permission: 'tutorials:view' },
    { icon: CreditCard, label: 'Subscription', path: '/dashboard/subscription', permission: 'subscription:view' },
    ...(user?.role === 'super_admin'
      ? [
          { icon: Shield, label: 'Super Admin', path: '/dashboard/super-admin', permission: null },
          { icon: Megaphone, label: 'Banner Management', path: '/dashboard/super-admin/banners', permission: null },
          { icon: Shield, label: 'User Management', path: '/dashboard/admin', permission: null },
        ]
      : []
    ),
    ...(user?.role === 'pharmacy_owner'
      ? [
          { icon: Users, label: 'Staff Users', path: '/dashboard/users', permission: 'staff:view' },
        ]
      : []
    ),
    ...(user?.role === 'pharmacy_owner' || user?.role === 'super_admin'
      ? [{ icon: Activity, label: 'Sync Logs', path: '/dashboard/sync-logs', permission: null }]
      : []),
    { icon: Bell, label: 'Notifications', path: '/dashboard/notifications', permission: null },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings', permission: 'settings:view' },
  ]

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => {
    if (!item.permission) {
      // For items without permission requirement, check role-based access
      if (item.path === '/dashboard/users' && user?.role !== 'pharmacy_owner' && user?.role !== 'super_admin') {
        return false
      }
      return true // No permission required
    }
    return hasPermission(item.permission)
  })

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-40 transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:static lg:z-auto lg:shadow-none lg:h-full shadow-xl',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'w-64 flex-shrink-0'
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
                <Pill className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Kulmis</h1>
                <p className="text-xs text-gray-500">Pharmacy</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 lg:p-6 space-y-1 overflow-y-auto overflow-x-hidden">
            {menuItems.map((item) => {
              const Icon = item.icon
              const allowNestedHighlight = !['/dashboard', '/dashboard/super-admin'].includes(item.path)
              const isActive =
                location.pathname === item.path ||
                (allowNestedHighlight && location.pathname.startsWith(`${item.path}/`))

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                    'hover:bg-primary-50 hover:text-primary-600',
                    isActive
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'text-gray-700'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 lg:p-6 border-t border-gray-200">
            <div className="px-4 py-2 bg-blue-50 rounded-xl">
              <p className="text-xs font-medium text-primary-600">Premium Plan</p>
              <p className="text-xs text-gray-600">Expires in 15 days</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

