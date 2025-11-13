import React, { useMemo, useState } from 'react'
import { Bell, Check, Loader2, Trash2 } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const topNotifications = useMemo(() => notifications.slice(0, 5), [notifications])

  const handleItemClick = async (id: string, link?: string | null) => {
    await markAsRead(id)
    if (link) {
      navigate(link)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                <p className="text-xs text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => markAllAsRead()}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Mark all as read"
                  disabled={loading || unreadCount === 0}
                >
                  <Check className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading notifications...
                </div>
              )}

              {!loading && topNotifications.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                  You're all caught up! 🎉
                </div>
              )}

              {!loading &&
                topNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                      notification.status === 'unread' ? 'bg-primary-50/60' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-[11px] text-gray-400 mt-2">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex flex-col items-center space-y-2">
                        <button
                          onClick={() => handleItemClick(notification.id, notification.link)}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          View
                        </button>
                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="text-gray-400 hover:text-red-500"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {notifications.length > 5 && (
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/dashboard/notifications')
                }}
                className="w-full text-sm font-medium text-primary-600 hover:bg-primary-50 py-3 transition-colors"
              >
                View all notifications
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}




