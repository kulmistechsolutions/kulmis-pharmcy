import React from 'react'
import { Wifi, WifiOff, RefreshCcw, AlertOctagon } from 'lucide-react'
import { useConnectivity } from '@/contexts/ConnectivityContext'

export const ConnectivityIndicator: React.FC = () => {
  const { status, pendingCount, conflictCount, lastSyncedAt } = useConnectivity()

  const baseClasses = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium'

  if (conflictCount > 0) {
    return (
      <span className={`${baseClasses} bg-red-100 text-red-700`}>
        <AlertOctagon className="w-3 h-3" /> Conflicts ({conflictCount})
      </span>
    )
  }

  if (status === 'offline') {
    return (
      <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
        <WifiOff className="w-3 h-3" /> Offline
      </span>
    )
  }

  if (status === 'syncing') {
    return (
      <span className={`${baseClasses} bg-blue-100 text-blue-700`}>
        <RefreshCcw className="w-3 h-3 animate-spin" /> Syncing ({pendingCount})
      </span>
    )
  }

  if (status === 'online' && pendingCount > 0) {
    return (
      <span className={`${baseClasses} bg-blue-100 text-blue-700`}>
        <Wifi className="w-3 h-3" /> Sync queued ({pendingCount})
      </span>
    )
  }

  return (
    <span className={`${baseClasses} bg-green-100 text-green-700`}>
      <Wifi className="w-3 h-3" /> Online
      {lastSyncedAt && <span className="text-[10px] text-green-600 ml-1">Synced {lastSyncedAt.toLocaleTimeString()}</span>}
    </span>
  )
}
