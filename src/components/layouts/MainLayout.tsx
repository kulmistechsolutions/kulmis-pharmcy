import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUser } from '@/contexts/UserContext'
import { api } from '@/lib/api'
import type { Banner } from '@/types/banner'
import { PromoBannerModal } from '@/components/PromoBannerModal'
import { ConnectivityBanner } from '@/components/ConnectivityBanner'
import { Button } from '@/components/ui/Button'

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, loading } = useUser()
  const [bannerQueue, setBannerQueue] = useState<Banner[]>([])
  const [fetchedForUser, setFetchedForUser] = useState<string | null>(null)
  const [isFetchingBanner, setIsFetchingBanner] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const trialDaysRemaining = useMemo(() => {
    if (!user?.trialEnd) return null
    const end = new Date(user.trialEnd)
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }, [user?.trialEnd])

  const isTrialActive =
    user?.planType === 'trial' && !user?.isTrialExpired && (trialDaysRemaining ?? 0) >= 0

  const trialLockBehavior = user?.trialAutoLockBehavior || 'lock'

  const isLocked =
    !!user &&
    user.role !== 'super_admin' &&
    user.planType === 'trial' &&
    trialLockBehavior === 'lock' &&
    (user.isTrialExpired || (trialDaysRemaining !== null && trialDaysRemaining <= 0))

  const showTrialUpgradeNotice =
    !!user &&
    user.role !== 'super_admin' &&
    user.planType === 'trial' &&
    trialLockBehavior === 'notice' &&
    (user.isTrialExpired || (trialDaysRemaining !== null && trialDaysRemaining <= 0))

  useEffect(() => {
    if (!user || loading) return
    if (user.role === 'super_admin') return

    const allowedPaths = ['/dashboard/subscription']
    const isAllowed = allowedPaths.some((path) => location.pathname.startsWith(path))

    if (isLocked && !isAllowed) {
      navigate('/dashboard/subscription', { replace: true, state: { locked: true } })
    }
  }, [user, loading, isLocked, location.pathname, navigate])

  useEffect(() => {
    if (loading) return

    if (!user) {
      setBannerQueue([])
      setFetchedForUser(null)
      return
    }

    if (fetchedForUser === user._id) {
      return
    }

    const fetchBanners = async () => {
      setIsFetchingBanner(true)
      try {
        const banners = await api.getActiveBanners()
        setBannerQueue(Array.isArray(banners) ? banners : [])
        setFetchedForUser(user._id)
      } catch (error) {
        console.error('Error fetching banners:', error)
      } finally {
        setIsFetchingBanner(false)
      }
    }

    fetchBanners()
  }, [loading, user, fetchedForUser])

  const activeBanner = bannerQueue.length ? bannerQueue[0] : null

  const handleDismissBanner = async (bannerId: string) => {
    try {
      await api.dismissBanner(bannerId)
    } catch (error) {
      console.error('Error dismissing banner:', error)
    } finally {
      setBannerQueue((prev) => prev.filter((banner) => banner._id !== bannerId))
    }
  }

  return (
    <>
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto w-full">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 min-h-full space-y-4">
              <ConnectivityBanner />
              {isTrialActive && (
                <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-yellow-900">
                      🕓 Free Trial Active — {trialDaysRemaining ?? 0} day{(trialDaysRemaining ?? 0) === 1 ? '' : 's'} remaining.
                    </p>
                    <p className="text-xs text-yellow-700">
                      Upgrade now to keep uninterrupted access after your trial ends.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-500 text-yellow-800 hover:bg-yellow-100"
                    onClick={() => navigate('/dashboard/subscription')}
                  >
                    Upgrade Now
                  </Button>
                </div>
              )}
              {isLocked && (
                <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-red-900">
                      ❌ Your free trial has expired.
                    </p>
                    <p className="text-xs text-red-700">
                      Access is limited until you upgrade to a paid plan.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/dashboard/subscription')}
                  >
                    Upgrade Plan
                  </Button>
                </div>
              )}
              {showTrialUpgradeNotice && !isLocked && (
                <div className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      ⚠️ Your free trial has ended.
                    </p>
                    <p className="text-xs text-blue-700">
                      Some features may be limited. Upgrade now to restore full access.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500 text-blue-800 hover:bg-blue-100"
                    onClick={() => navigate('/dashboard/subscription')}
                  >
                    Upgrade Now
                  </Button>
                </div>
              )}
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {activeBanner && !isFetchingBanner && (
        <PromoBannerModal banner={activeBanner} onDismiss={() => handleDismissBanner(activeBanner._id)} />
      )}
    </>
  )
}

