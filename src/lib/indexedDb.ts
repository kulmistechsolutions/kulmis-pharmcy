import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

interface OfflineDB extends DBSchema {
  sales_queue: {
    key: string
    value: OfflineRecord
    indexes: { 'by-status': string; 'by-created-at': number; 'by-next-attempt': number }
  }
  lab_queue: {
    key: string
    value: OfflineRecord
    indexes: { 'by-status': string; 'by-created-at': number; 'by-next-attempt': number }
  }
  expenses_queue: {
    key: string
    value: OfflineRecord
    indexes: { 'by-status': string; 'by-created-at': number; 'by-next-attempt': number }
  }
  debts_queue: {
    key: string
    value: OfflineRecord
    indexes: { 'by-status': string; 'by-created-at': number; 'by-next-attempt': number }
  }
  inventory_queue: {
    key: string
    value: OfflineRecord
    indexes: { 'by-status': string; 'by-created-at': number; 'by-next-attempt': number }
  }
  payments_queue: {
    key: string
    value: OfflineRecord
    indexes: { 'by-status': string; 'by-created-at': number; 'by-next-attempt': number }
  }
  sync_logs: {
    key: string
    value: SyncLogEntry
    indexes: { 'by-created-at': number }
  }
}

export type OfflineStore = keyof Pick<
  OfflineDB,
  'sales_queue' | 'lab_queue' | 'expenses_queue' | 'debts_queue' | 'inventory_queue' | 'payments_queue'
>

export interface OfflineRecord {
  local_id: string
  target: OfflineStore
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payload: any
  created_at: number
  sync_status: 'pending' | 'in_progress' | 'conflict'
  retries: number
  next_attempt: number
  last_error?: string
  conflict_reason?: string
}

export interface SyncLogEntry {
  id: string
  created_at: number
  message: string
  status: 'success' | 'error'
  details?: any
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

export const getOfflineDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('kulmis-offline', 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        const ensureStore = (name: OfflineStore) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'local_id' })
            store.createIndex('by-status', 'sync_status')
            store.createIndex('by-created-at', 'created_at')
            store.createIndex('by-next-attempt', 'next_attempt')
          } else if (transaction) {
            const store = transaction.objectStore(name)
            if (!store.indexNames.contains('by-next-attempt')) {
              store.createIndex('by-next-attempt', 'next_attempt')
            }
            if (!store.indexNames.contains('by-status')) {
              store.createIndex('by-status', 'sync_status')
            }
            if (!store.indexNames.contains('by-created-at')) {
              store.createIndex('by-created-at', 'created_at')
            }
          }
        }

        if (oldVersion < 1) {
          const salesStore = db.createObjectStore('sales_queue', { keyPath: 'local_id' })
          salesStore.createIndex('by-status', 'sync_status')
          salesStore.createIndex('by-created-at', 'created_at')
          salesStore.createIndex('by-next-attempt', 'next_attempt')

          const labStore = db.createObjectStore('lab_queue', { keyPath: 'local_id' })
          labStore.createIndex('by-status', 'sync_status')
          labStore.createIndex('by-created-at', 'created_at')
          labStore.createIndex('by-next-attempt', 'next_attempt')

          const logStore = db.createObjectStore('sync_logs', { keyPath: 'id' })
          logStore.createIndex('by-created-at', 'created_at')
        } else {
          ensureStore('sales_queue')
          ensureStore('lab_queue')
        }

        ensureStore('expenses_queue')
        ensureStore('debts_queue')
        ensureStore('inventory_queue')
        ensureStore('payments_queue')
      },
    })
  }

  return dbPromise
}

export const enqueueRecord = async (storeName: OfflineStore, record: OfflineRecord) => {
  const db = await getOfflineDB()
  await db.put(storeName, record)
}

export const getPendingRecords = async (storeName: OfflineStore) => {
  const db = await getOfflineDB()
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.store
  const pending = await store.index('by-status').getAll('pending')
  const inProgress = await store.index('by-status').getAll('in_progress')
  return [...pending, ...inProgress]
}

export const getConflictRecords = async (storeName: OfflineStore) => {
  const db = await getOfflineDB()
  return db.getAllFromIndex(storeName, 'by-status', 'conflict')
}

export const markRecordStatus = async (
  storeName: OfflineStore,
  localId: string,
  status: OfflineRecord['sync_status'],
  options: { lastError?: string; nextAttempt?: number; conflictReason?: string; resetRetries?: boolean } = {}
) => {
  const db = await getOfflineDB()
  const record = await db.get(storeName, localId)
  if (!record) return
  record.sync_status = status
  if (options.resetRetries) {
    record.retries = 0
  }
  if (status === 'pending' && !options.nextAttempt) {
    record.next_attempt = Date.now()
  }
  if (options.nextAttempt !== undefined) {
    record.next_attempt = options.nextAttempt
  }
  if (options.lastError !== undefined) {
    record.last_error = options.lastError
  }
  if (options.conflictReason !== undefined) {
    record.conflict_reason = options.conflictReason
  }
  await db.put(storeName, record)
}

export const updateRecordRetries = async (storeName: OfflineStore, localId: string, updater: (record: OfflineRecord) => void) => {
  const db = await getOfflineDB()
  const record = await db.get(storeName, localId)
  if (!record) return
  updater(record)
  await db.put(storeName, record)
}

export const deleteRecord = async (storeName: OfflineStore, localId: string) => {
  const db = await getOfflineDB()
  await db.delete(storeName, localId)
}

export const logSyncEvent = async (entry: SyncLogEntry) => {
  const db = await getOfflineDB()
  await db.put('sync_logs', entry)
}
