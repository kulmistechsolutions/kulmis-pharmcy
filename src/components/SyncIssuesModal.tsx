import React from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useConnectivity } from '@/contexts/ConnectivityContext'
import { Button } from '@/components/ui/Button'

interface SyncIssuesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const targetLabels: Record<string, string> = {
  sales: 'Sales',
  lab: 'Lab Cashier',
  expenses: 'Expenses',
  debts: 'Debts',
  inventory: 'Inventory',
  payments: 'Payments',
}

export const SyncIssuesModal: React.FC<SyncIssuesModalProps> = ({ open, onOpenChange }) => {
  const { conflicts, retryConflict } = useConnectivity()

  if (!open) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Offline Sync Issues</h2>
              <p className="text-sm text-gray-500">Resolve the items below to resume automatic syncing.</p>
            </div>
          </div>
          <button
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-4">
          {conflicts.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-6 text-sm text-green-700">
              No conflicts remain. You can close this window.
            </div>
          ) : (
            conflicts.map((conflict) => (
              <div key={conflict.local_id} className="rounded-xl border border-red-100 bg-red-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      {targetLabels[conflict.target] || conflict.target}
                    </p>
                    <p className="text-xs text-red-500">
                      Queued {new Date(conflict.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryConflict(conflict.target, conflict.local_id)}
                  >
                    Retry
                  </Button>
                </div>
                {conflict.conflict_reason && (
                  <p className="mt-3 text-sm text-red-700 font-medium">{conflict.conflict_reason}</p>
                )}
                {conflict.last_error && (
                  <p className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{conflict.last_error}</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {conflicts.length > 0 && (
            <Button
              onClick={async () => {
                await Promise.all(conflicts.map((conflict) => retryConflict(conflict.target, conflict.local_id)))
              }}
            >
              Retry All
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
