import React, { useMemo, useState } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { Button } from '@/components/ui/Button'
import { format } from 'date-fns'
import { Bell, Check, Loader2, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Filter = 'all' | 'unread'

export const Notifications: React.FC = () => {
  const { notifications, unreadCount, loading, refresh, markAsRead, markAllAsRead, removeNotification } = useNotifications()
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((item) => item.status === 'unread')
    }
    return notifications
  }, [notifications, filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Bell className="w-6 h-6 text-primary-500" />
            <span>Notification Center</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Stay informed about important updates, reminders, and system alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>
            All
          </Button>
          <Button variant={filter === 'unread' ? 'primary' : 'outline'} onClick={() => setFilter('unread')}>
            Unread {unreadCount > 0 && <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-2 text-xs font-semibold text-primary-600">{unreadCount}</span>}
          </Button>
          <Button variant="outline" onClick={() => refresh()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing
              </>
            ) : (
              'Refresh'
            )}
          </Button>
          <Button variant="outline" onClick={() => markAllAsRead()} disabled={loading || unreadCount === 0}>
            <Check className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-600 text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading notifications...
            </div>
          )}

          {!loading && filteredNotifications.length === 0 && (
            <div className="text-center py-12 px-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No notifications yet</h3>
              <p className="text-sm text-gray-500 mt-2">
                We'll let you know as soon as there's something new to review.
              </p>
              <Button className="mt-4" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          )}

          {!loading &&
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                  notification.status === 'unread' ? 'bg-primary-50/60' : 'bg-white'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        notification.status === 'unread' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {notification.type.replace(/_/g, ' ')}
                    </span>
                    <p className="text-sm text-gray-400">
                      {format(new Date(notification.createdAt), 'PPpp')}
                    </p>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-gray-900">{notification.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                  {notification.link && (
                    <Button
                      variant="link"
                      className="px-0 mt-2"
                      onClick={async () => {
                        await markAsRead(notification.id)
                        navigate(notification.link as string)
                      }}
                    >
                      View details
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notification.status === 'unread' && (
                    <Button size="sm" variant="outline" onClick={() => markAsRead(notification.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Mark read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-500 hover:text-red-500"
                    onClick={() => removeNotification(notification.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}




