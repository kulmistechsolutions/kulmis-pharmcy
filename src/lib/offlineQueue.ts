import {
  enqueueRecord,
  deleteRecord,
  getPendingRecords,
  getConflictRecords,
  logSyncEvent,
  markRecordStatus,
  updateRecordRetries,
} from '@/lib/indexedDb'
import type { OfflineStore, OfflineRecord } from '@/lib/indexedDb'

export type QueueTarget = 'sales' | 'lab' | 'expenses' | 'debts' | 'inventory' | 'payments'

interface QueuePayload {
  target: QueueTarget
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payload: any
}

interface SyncResult {
  synced: number
  failed: number
  conflicts: number
}

const storeMap: Record<QueueTarget, OfflineStore> = {
  sales: 'sales_queue',
  lab: 'lab_queue',
  expenses: 'expenses_queue',
  debts: 'debts_queue',
  inventory: 'inventory_queue',
  payments: 'payments_queue',
}

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000/api'

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

const generateLocalId = (target: QueueTarget) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${target}_${crypto.randomUUID()}`
  }
  return `${target}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const computeNextAttempt = (retries: number) => {
  const base = 5000 // 5 seconds
  const maxDelay = 5 * 60 * 1000 // 5 minutes
  const delay = Math.min(maxDelay, base * Math.pow(2, Math.max(0, retries)))
  return Date.now() + delay
}

const postSyncLog = async (log: {
  target: QueueTarget
  status: 'queued' | 'synced' | 'failed' | 'conflict'
  message?: string
  localId?: string
  metadata?: Record<string, unknown>
  timestamp?: number
}) => {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return
    }
    await fetch(`${apiBaseUrl}/sync/logs`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        logs: [
          {
            target: log.target,
            status: log.status,
            message: log.message,
            localId: log.localId,
            metadata: log.metadata,
            timestamp: log.timestamp ?? Date.now(),
          },
        ],
      }),
    })
  } catch (error) {
    console.warn('Failed to push sync log to server', error)
  }
}

export const queueMutation = async ({ target, endpoint, method, payload }: QueuePayload) => {
  const local_id = generateLocalId(target)
  const store = storeMap[target]
  const record: OfflineRecord = {
    local_id,
    target: store,
    endpoint,
    method,
    payload,
    created_at: Date.now(),
    sync_status: 'pending',
    retries: 0,
    next_attempt: Date.now(),
  }

  await enqueueRecord(store, record)
  await logSyncEvent({
    id: `${local_id}_queued`,
    created_at: Date.now(),
    message: `Queued ${target} mutation while offline`,
    status: 'success',
    details: { endpoint, method },
  })
  postSyncLog({
    target,
    status: 'queued',
    message: 'Queued mutation while offline',
    localId: local_id,
    metadata: { endpoint, method },
    timestamp: Date.now(),
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('offline-queue-updated'))
  }
  return local_id
}

export const getQueuedRecords = async (target: QueueTarget) => {
  const storeName = storeMap[target]
  return getPendingRecords(storeName)
}

export const getConflictQueueRecords = async (target: QueueTarget) => {
  const storeName = storeMap[target]
  return getConflictRecords(storeName)
}

export const resetConflictRecord = async (target: QueueTarget, localId: string) => {
  const storeName = storeMap[target]
  await markRecordStatus(storeName, localId, 'pending', { conflictReason: undefined, lastError: undefined, resetRetries: true })
  postSyncLog({
    target,
    status: 'queued',
    message: 'Conflict reset by user, queued for retry',
    localId,
    timestamp: Date.now(),
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('offline-queue-updated'))
  }
}

export const getAllConflictRecords = async () => {
  const queues: QueueTarget[] = ['sales', 'lab', 'expenses', 'debts', 'inventory', 'payments']
  const result: Array<{ target: QueueTarget; record: OfflineRecord }> = []
  for (const target of queues) {
    const conflicts = await getConflictQueueRecords(target)
    conflicts.forEach((record) => result.push({ target, record }))
  }
  return result
}

export const processOfflineQueues = async (): Promise<SyncResult> => {
  const queues: QueueTarget[] = ['sales', 'lab', 'expenses', 'debts', 'inventory', 'payments']
  let synced = 0
  let failed = 0
  let conflicts = 0

  for (const target of queues) {
    const storeName = storeMap[target]
    const pendingRecords = await getPendingRecords(storeName)

    for (const record of pendingRecords) {
      if (record.sync_status === 'pending' && record.next_attempt && record.next_attempt > Date.now()) {
        continue
      }

      await markRecordStatus(storeName, record.local_id, 'in_progress')
      try {
        const response = await fetch(`${apiBaseUrl}${record.endpoint}`, {
          method: record.method,
          headers: getAuthHeaders(),
          body: record.method === 'DELETE' ? undefined : JSON.stringify(record.payload),
        })

        if (!response.ok) {
          if (response.status === 409 || response.status === 422) {
            const message = await response.text()
            await markRecordStatus(storeName, record.local_id, 'conflict', {
              lastError: message,
              conflictReason: `Server rejected change (${response.status})`,
            })
            await logSyncEvent({
              id: `${record.local_id}_conflict_${Date.now()}`,
              created_at: Date.now(),
              message: `Conflict detected for ${target} mutation`,
              status: 'error',
              details: { status: response.status, message },
            })
            postSyncLog({
              target,
              status: 'conflict',
              message,
              localId: record.local_id,
              metadata: { endpoint: record.endpoint, method: record.method, status: response.status },
              timestamp: Date.now(),
            })
            conflicts += 1
            continue
          }
          throw new Error(`Sync failed with status ${response.status}`)
        }

        await deleteRecord(storeName, record.local_id)
        await logSyncEvent({
          id: `${record.local_id}_synced_${Date.now()}`,
          created_at: Date.now(),
          message: `Synced ${target} mutation`,
          status: 'success',
        })
        postSyncLog({
          target,
          status: 'synced',
          message: 'Mutation synced successfully',
          localId: record.local_id,
          metadata: { endpoint: record.endpoint, method: record.method },
          timestamp: Date.now(),
        })
        synced += 1
      } catch (error) {
        failed += 1
        await updateRecordRetries(storeName, record.local_id, (rec) => {
          rec.retries += 1
          rec.sync_status = 'pending'
          rec.last_error = (error as Error).message
          rec.next_attempt = computeNextAttempt(rec.retries)
        })
        await logSyncEvent({
          id: `${record.local_id}_failed_${Date.now()}`,
          created_at: Date.now(),
          message: `Failed to sync ${target} mutation`,
          status: 'error',
          details: { error: (error as Error).message },
        })
        postSyncLog({
          target,
          status: 'failed',
          message: (error as Error).message,
          localId: record.local_id,
          metadata: {
            endpoint: record.endpoint,
            method: record.method,
            retries: record.retries + 1,
          },
          timestamp: Date.now(),
        })
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('offline-queue-updated'))
  }

  return { synced, failed, conflicts }
}
