import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Menu, LogOut, Settings } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { api } from '@/lib/api'
import { ConnectivityIndicator } from '@/components/ConnectivityIndicator'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface TopbarProps {
  onMenuClick: () => void
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  const navigate = useNavigate()
  const { user, refreshUser } = useUser()
  const [showDropdown, setShowDropdown] = useState(false)

  const handleLogout = () => {
    api.logout()
    refreshUser()
    navigate('/login')
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin'
      case 'pharmacy_owner':
        return 'Pharmacy Owner'
      case 'technician':
        return 'Technician'
      case 'staff':
        return 'Staff Member'
      default:
        return 'User'
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-4">
        {/* Left: Menu Button */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Right: Notifications & User */}
        <div className="flex items-center space-x-3">
          <ConnectivityIndicator />
          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">{user?.pharmacyName || 'User'}</p>
                <p className="text-xs text-gray-500">{getRoleLabel(user?.role)}</p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1">
                  {user && (user.role === 'pharmacy_owner' || user.role === 'super_admin' || (user.permissions && user.permissions.includes('settings:view'))) && (
                    <button
                      onClick={() => {
                        navigate('/dashboard/settings')
                        setShowDropdown(false)
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

