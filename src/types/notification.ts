export interface Notification {
  id: string
  type: string
  title: string
  message: string
  status: 'unread' | 'read'
  link?: string | null
  metadata?: Record<string, any> | null
  expiresAt?: string | null
  sentBy?: string | null
  userId?: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationListResponse {
  notifications: Notification[]
  total: number
  page: number
  limit: number
}


