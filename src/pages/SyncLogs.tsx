import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCcw, Filter, Wifi, Activity, AlertOctagon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useConnectivity } from '@/contexts/ConnectivityContext'
import { useUser } from '@/contexts/UserContext'
import { useStaffOptions } from '@/hooks/useStaffOptions'
import { api } from '@/lib/api'
import { format } from 'date-fns'

interface SyncLog {
  _id: string
  target: string
  status: 'queued' | 'synced' | 'failed' | 'conflict'
  message?: string
  metadata?: Record<string, unknown>
  user_email?: string
  user_id?: string
  created_at: string
  local_id?: string
}

const statusStyles: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-700',
  synced: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  conflict: 'bg-yellow-100 text-yellow-700',
}

const statusLabels: Record<string, string> = {
  queued: 'Queued',
  synced: 'Synced',
  failed: 'Failed',
  conflict: 'Conflict',
}

const targetLabels: Record<string, string> = {
  sales: 'Sales',
  lab: 'Lab Cashier',
  expenses: 'Expenses',
  debts: 'Debts',
  inventory: 'Inventory',
  payments: 'Payments',
}

export const SyncLogs: React.FC = () => {
  const { user } = useUser()
  const { status: connectionStatus, pendingCount, conflictCount, lastSyncedAt, syncNow } = useConnectivity()
  const { options: staffOptions, loading: staffLoading } = useStaffOptions()

  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [targetFilter, setTargetFilter] = useState<string>('all')
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('') 
  const [endDate, setEndDate] = useState<string>('') 
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'staff' && user._id) {
      setStaffFilter(user._id)
    }
  }, [user?._id, user?.role])

  const canFilterStaff = useMemo(
    () => user?.role === 'pharmacy_owner' || user?.role === 'super_admin',
    [user?.role]
  )

  const filteredStaffOptions = useMemo(() => {
    const mapped = staffOptions.map((option) => ({
      value: option.value,
      label: option.label,
      role: option.role,
    }))

    if (canFilterStaff) {
      return [
        { value: 'all', label: 'All Staff', role: 'all' },
        ...mapped.filter(
          (option, index, self) => self.findIndex((o) => o.value === option.value) === index
        ),
      ]
    }

    return mapped
  }, [staffOptions, canFilterStaff])

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const response: any = await api.getSyncLogs({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        target: targetFilter !== 'all' ? targetFilter : undefined,
        staffId: staffFilter !== 'all' ? staffFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })

      setLogs(response?.data || [])
      setSummary(response?.summary || {})
      setLastSynced(response?.lastSyncedAt || null)
    } catch (error: any) {
      console.error('Failed to load sync logs:', error)
      alert(error.message || 'Failed to load sync logs')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, targetFilter, staffFilter, startDate, endDate])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const lastSyncedLabel = useMemo(() => {
    const value = lastSynced || lastSyncedAt
    if (!value) return 'No successful sync yet'
    return `Last synced: ${format(new Date(value), 'PPpp')}`
  }, [lastSynced, lastSyncedAt])

  const statusTotals = useMemo(() => {
    return {
      queued: summary.queued || 0,
      synced: summary.synced || 0,
      failed: summary.failed || 0,
      conflict: summary.conflict || 0,
    }
  }, [summary])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Offline Sync Logs</h1>
          <p className="text-gray-600 mt-2">Monitor offline queue activity, conflicts, and retries.</p>
          <p className="text-xs text-gray-500 mt-1">{lastSyncedLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={loadLogs} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={syncNow} variant="primary" disabled={connectionStatus === 'syncing'}>
            <Wifi className="w-4 h-4 mr-2" />
            Sync Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" /> Pending Queue
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{pendingCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-yellow-500" /> Conflicts
          </p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">{conflictCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600">Synced</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{statusTotals.synced}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600">Failed</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{statusTotals.failed}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
            <Filter className="w-4 h-4" />
            Filters
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="synced">Synced</option>
              <option value="failed">Failed</option>
              <option value="conflict">Conflict</option>
            </select>
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="all">All Modules</option>
              {Object.entries(targetLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {filteredStaffOptions.length > 0 && (
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                disabled={staffLoading}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {filteredStaffOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
            {(startDate || endDate) && (
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Clear Dates
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-12 text-center text-gray-600">Loading sync logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No sync logs found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full align-middle px-5 sm:px-6 lg:px-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Module</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Message</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {format(new Date(log.created_at), 'PPpp')}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-800">
                        {targetLabels[log.target] || log.target}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[log.status]}`}>
                          {statusLabels[log.status] || log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {log.message || '—'}
                        {log.metadata?.retries !== undefined && (
                          <span className="ml-2 text-xs text-gray-500">
                            Retries: {String(log.metadata.retries)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{log.user_email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}



