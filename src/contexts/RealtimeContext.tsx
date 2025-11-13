import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useUser } from './UserContext'

interface RealtimeContextValue {
  socket: Socket | null
  connected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue>({ socket: null, connected: false })

const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  try {
    const url = new URL(apiUrl)
    url.pathname = '/'
    return url.toString().replace(/\/$/, '')
  } catch {
    return 'http://localhost:5000'
  }
}

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useUser()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (loading) {
      return
    }

    const token = localStorage.getItem('token')

    if (!user || !token) {
      setConnected(false)
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    const baseUrl = getApiBaseUrl()
    const newSocket = io(baseUrl, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
    })

    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)

    newSocket.on('connect', handleConnect)
    newSocket.on('disconnect', handleDisconnect)
    newSocket.on('connect_error', (err) => {
      console.error('Realtime connection error:', err)
    })

    setSocket(newSocket)

    return () => {
      newSocket.off('connect', handleConnect)
      newSocket.off('disconnect', handleDisconnect)
      newSocket.disconnect()
    }
  }, [user?._id, loading])

  const value = useMemo(
    () => ({
      socket,
      connected,
    }),
    [socket, connected]
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export const useRealtime = () => {
  return useContext(RealtimeContext)
}

export const useRealtimeEvent = <T,>(event: string, handler: (payload: T) => void) => {
  const { socket } = useRealtime()

  useEffect(() => {
    if (!socket) return

    socket.on(event, handler)
    return () => {
      socket.off(event, handler)
    }
  }, [socket, event, handler])
}




