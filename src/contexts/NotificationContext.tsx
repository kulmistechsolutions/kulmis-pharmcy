import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Notification } from '@/types/notification'
import { useRealtimeEvent } from './RealtimeContext'
import { useUser } from './UserContext'

interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  removeNotification: (id: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  removeNotification: async () => {},
})

const toNotification = (item: any): Notification => ({
  id: String(item.id || item._id || ''),
  type: item.type,
  title: item.title,
  message: item.message,
  status: item.status === 'read' ? 'read' : 'unread',
  link: item.link ?? null,
  metadata: item.metadata ?? null,
  expiresAt: item.expiresAt ?? item.expires_at ?? null,
  sentBy: item.sentBy ?? item.sent_by ?? null,
  userId: item.userId ?? item.user_id ?? null,
  createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
  updatedAt: item.updatedAt ?? item.updated_at ?? item.createdAt ?? new Date().toISOString(),
})

const normalizeResponse = (data: any): Notification[] => {
  if (!data) return []
  if (Array.isArray(data)) return data.map(toNotification)
  if (Array.isArray(data.notifications)) return data.notifications.map(toNotification)
  if (Array.isArray(data.results)) return data.results.map(toNotification)
  return []
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const calculateUnread = useCallback((items: Notification[]) => {
    return items.filter((n) => n.status === 'unread').length
  }, [])

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    setLoading(true)
    try {
      const response = await api.getNotifications({ limit: 20 })
      const list = normalizeResponse(response)
      setNotifications(list)
      setUnreadCount(calculateUnread(list))
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [user, calculateUnread])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useRealtimeEvent<any>('notification:new', (payload) => {
    const notification = toNotification(
      'notification' in (payload || {}) ? (payload as any).notification : payload
    )
    setNotifications((prev) => {
      const exists = prev.find((item) => item.id === notification.id)
      if (exists) {
        return prev.map((item) => (item.id === notification.id ? notification : item))
      }
      return [notification, ...prev].slice(0, 30)
    })
    setUnreadCount((prev) => prev + 1)
  })

  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await api.markNotificationRead(id)
      const updated = toNotification(response)
      setNotifications((prev) => {
        const next: Notification[] = prev.map((item) => (item.id === updated.id ? updated : item))
        setUnreadCount(calculateUnread(next))
        return next
      })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }, [calculateUnread])

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead()
      setNotifications((prev) => {
        const next: Notification[] = prev.map((item) => ({ ...item, status: 'read' as const }))
        setUnreadCount(0)
        return next
      })
    } catch (error) {
      console.error('Failed to mark notifications as read:', error)
    }
  }, [])

  const removeNotification = useCallback(async (id: string) => {
    try {
      await api.deleteNotification(id)
      setNotifications((prev) => {
        const next = prev.filter((item) => item.id !== id)
        setUnreadCount(calculateUnread(next))
        return next
      })
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }, [calculateUnread])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh: loadNotifications,
      markAsRead,
      markAllAsRead,
      removeNotification,
    }),
    [notifications, unreadCount, loading, loadNotifications, markAsRead, markAllAsRead, removeNotification]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => useContext(NotificationContext)


