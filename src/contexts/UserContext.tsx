import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface User {
  _id: string
  pharmacyName: string
  email: string
  phone: string
  role: 'super_admin' | 'pharmacy_owner' | 'technician' | 'staff'
  permissions?: string[]
  subscription?: any
  planType?: 'trial' | 'paid'
  trialStart?: string
  trialEnd?: string
  trialDaysGranted?: number
  isTrialExpired?: boolean
  subscriptionStatus?: 'trial' | 'active' | 'expired' | 'pending'
  subscriptionPlanId?: string | null
  trialReminderSentAt?: string | null
  trialExpiredNotifiedAt?: string | null
  trialAutoLockBehavior?: 'lock' | 'notice'
}

interface UserContextType {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      const userData = await api.getCurrentUser()
      setUser(userData as User)
    } catch (error) {
      console.error('Error fetching user:', error)
      setUser(null)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  // Expose refreshUser to window for logout
  useEffect(() => {
    (window as any).refreshUser = refreshUser
  }, [refreshUser])

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

