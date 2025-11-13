import React, { useState } from 'react'
import { RefreshCcw, WifiOff, Wifi, AlertOctagon } from 'lucide-react'
import { useConnectivity } from '@/contexts/ConnectivityContext'
import { Button } from '@/components/ui/Button'
import { SyncIssuesModal } from '@/components/SyncIssuesModal'

export const ConnectivityBanner: React.FC = () => {
  const { status, pendingCount, conflictCount, lastSyncedAt, syncNow } = useConnectivity()
  const [showIssues, setShowIssues] = useState(false)

  if (status === 'online' && pendingCount === 0 && conflictCount === 0 && !lastSyncedAt) {
    return null
  }

  const baseClasses = 'flex items-center justify-between px-4 py-3 text-sm rounded-xl border shadow-sm'

  return (
    <>
      {status === 'offline' && (
        <div className={`${baseClasses} bg-yellow-50 border-yellow-200 text-yellow-800`}>
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>Offline mode: new changes will be saved locally and synced when you reconnect.</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-yellow-700">
            <span>Pending sync: {pendingCount}</span>
            {conflictCount > 0 && <span>Conflicts: {conflictCount}</span>}
          </div>
        </div>
      )}

      {status === 'syncing' && (
        <div className={`${baseClasses} bg-blue-50 border-blue-200 text-blue-800 animate-pulse`}>
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-4 h-4 animate-spin" />
            <span>Syncing your offline changes...</span>
          </div>
          <span className="text-xs text-blue-700">Pending sync: {pendingCount}</span>
        </div>
      )}

      {status === 'online' && pendingCount > 0 && (
        <div className={`${baseClasses} bg-blue-50 border-blue-200 text-blue-800`}>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>Online. Queued changes will sync shortly...</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700">Pending sync: {pendingCount}</span>
            <Button size="sm" variant="outline" onClick={syncNow}>
              Sync now
            </Button>
          </div>
        </div>
      )}

      {conflictCount > 0 && (
        <div className={`${baseClasses} bg-red-50 border-red-200 text-red-800`}>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" />
            <span>{conflictCount} change{conflictCount === 1 ? '' : 's'} need attention before they can sync.</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowIssues(true)}>
            Review
          </Button>
        </div>
      )}

      {status === 'online' && pendingCount === 0 && conflictCount === 0 && lastSyncedAt && (
        <div className={`${baseClasses} bg-green-50 border-green-200 text-green-800`}>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>All changes synced.</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs text-green-700">Last synced: {lastSyncedAt.toLocaleString()}</span>
          </div>
        </div>
      )}

      <SyncIssuesModal open={showIssues} onOpenChange={setShowIssues} />
    </>
  )
}
