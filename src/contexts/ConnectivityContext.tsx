import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { getOfflineDB } from '@/lib/indexedDb'
import {
  processOfflineQueues,
  getAllConflictRecords,
  resetConflictRecord,
} from '@/lib/offlineQueue'
import type { QueueTarget } from '@/lib/offlineQueue'

export type ConnectivityStatus = 'online' | 'offline' | 'syncing'

interface ConflictSummary {
  target: QueueTarget
  local_id: string
  created_at: number
  last_error?: string
  conflict_reason?: string
}

interface ConnectivityContextValue {
  isOnline: boolean
  status: ConnectivityStatus
  pendingCount: number
  conflictCount: number
  conflicts: ConflictSummary[]
  lastSyncedAt: Date | null
  setStatus: (status: ConnectivityStatus) => void
  setPendingCount: (count: number) => void
  updateLastSynced: () => void
  refreshPending: () => Promise<void>
  syncNow: () => Promise<void>
  retryConflict: (target: QueueTarget, localId: string) => Promise<void>
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined)

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [status, setStatus] = useState<ConnectivityStatus>(isOnline ? 'online' : 'offline')
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [conflicts, setConflicts] = useState<ConflictSummary[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const refreshPendingCount = useCallback(async () => {
    try {
      const db = await getOfflineDB()
      const queues = ['sales_queue', 'lab_queue', 'expenses_queue', 'debts_queue', 'inventory_queue', 'payments_queue'] as const
      let totalPending = 0

      for (const queue of queues) {
        const pending = await db.getAllFromIndex(queue, 'by-status', 'pending')
        const inProgress = await db.getAllFromIndex(queue, 'by-status', 'in_progress')
        totalPending += (pending?.length || 0) + (inProgress?.length || 0)
      }

      setPendingCount(totalPending)

      const conflictRecords = await getAllConflictRecords()
      setConflictCount(conflictRecords.length)
      setConflicts(
        conflictRecords.map(({ target, record }) => ({
          target,
          local_id: record.local_id,
          created_at: record.created_at,
          last_error: record.last_error,
          conflict_reason: record.conflict_reason,
        }))
      )
    } catch (error) {
      console.warn('Unable to read offline queue', error)
    }
  }, [])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      setStatus('online')
      await refreshPendingCount()
      await syncQueues()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setStatus('offline')
    }

    const handleQueueUpdate = () => {
      refreshPendingCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('offline-queue-updated', handleQueueUpdate)

    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('offline-queue-updated', handleQueueUpdate)
    }
  }, [refreshPendingCount])

  const updateLastSynced = useCallback(() => {
    setLastSyncedAt(new Date())
    refreshPendingCount()
  }, [refreshPendingCount])

  const syncQueues = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setStatus('syncing')
    const result = await processOfflineQueues()
    await refreshPendingCount()
    if (result.failed === 0 && result.conflicts === 0) {
      setStatus('online')
      updateLastSynced()
    } else {
      setStatus('online')
    }
  }, [refreshPendingCount, updateLastSynced])

  const syncNow = useCallback(async () => {
    await syncQueues()
  }, [syncQueues])

  const retryConflict = useCallback(async (target: QueueTarget, localId: string) => {
    await resetConflictRecord(target, localId)
    await refreshPendingCount()
  }, [refreshPendingCount])

  const value = useMemo(
    () => ({
      isOnline,
      status,
      pendingCount,
      conflictCount,
      conflicts,
      lastSyncedAt,
      setStatus,
      setPendingCount,
      updateLastSynced,
      refreshPending: refreshPendingCount,
      syncNow,
      retryConflict,
    }),
    [
      isOnline,
      status,
      pendingCount,
      conflictCount,
      conflicts,
      lastSyncedAt,
      refreshPendingCount,
      syncNow,
      retryConflict,
    ]
  )

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
}

export const useConnectivity = () => {
  const context = useContext(ConnectivityContext)
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider')
  }
  return context
}
