import React, { useState, useEffect, useMemo } from 'react'
import { Building2, DollarSign, TrendingUp, CheckCircle, XCircle, AlertCircle, Edit, X, Plus, Eye, Lock, Calendar, Package, CreditCard, Search, Clock, Gift, Bell, ShieldAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'
import { Navigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import type { PieLabelRenderProps } from 'recharts'

type Tab = 'overview' | 'plans' | 'requests' | 'pharmacies' | 'analytics' | 'trials'

interface Plan {
  _id: string
  name: string
  duration_days: number
  price: number
  discount: number
  status: string
  activeUsers?: number
  totalRevenue?: number
  planType?: 'trial' | 'paid'
  autoLockBehavior?: 'lock' | 'notice'
  features?: string[]
  description?: string
  limitations?: {
    maxInvoices?: number | null
    maxMedicines?: number | null
    maxLabRecords?: number | null
  }
  isDefaultTrial?: boolean
}

interface PaymentRequest {
  _id: string
  user_id: {
    pharmacyName: string
    email: string
    phone: string
  }
  plan_id: {
    name: string
    duration_days: number
    price: number
  }
  method: string
  sender_number: string
  amount: number
  reference_id: string
  proof_url: string
  status: string
  createdAt: string
}

interface Subscription {
  _id: string
  user_id: {
    pharmacyName: string
    email: string
    phone: string
  }
  plan_id: {
    name: string
    duration_days: number
  }
  price_paid: number
  start_at: string
  end_at: string
  startDate?: string
  endDate?: string
  daysRemaining: number
  status: string
}

interface Pharmacy {
  _id: string
  pharmacyName: string
  email: string
  phone: string
  subscription: Subscription | null
  isActive: boolean
  ownerName?: string
  planName?: string
  daysRemaining?: number | null
  statusLabel?: string
  statusColor?: string
  joinDate?: string
  logoUrl?: string | null
  address?: string | null
  trial?: {
    start?: string
    end?: string
    daysRemaining?: number
    isExpired?: boolean
    status?: string
  } | null
  metrics?: {
    totalSales: number
    totalTransactions: number
    totalProfit: number
    totalDebts: number
    totalDebtsRecorded: number
    totalMedicines: number
    skuCount: number
    totalInvoices: number
    customerCount: number
    lastTransactionAt?: string | null
  }
}

interface PharmacyPerformancePoint {
  month: number
  year: number
  label: string
  totalSales: number
  totalProfit: number
  transactions: number
}

interface PharmacyDetail {
  profile: {
    id: string
    pharmacyName: string
    ownerName?: string
    logoUrl?: string | null
    contact: {
      phone?: string | null
      email?: string | null
      address?: string | null
    }
    registrationDate?: string
    planName?: string
    planType?: string
    daysRemaining?: number | null
    isActive: boolean
    status?: string
  }
  subscription: Subscription | null
  trial: {
    start?: string
    end?: string
    isExpired?: boolean
    daysRemaining?: number | null
  }
  metrics: {
    totalSales: number
    totalTransactions: number
    totalProfit: number
    totalDebts: number
    totalDebtsRecorded: number
    totalMedicines: number
    skuCount: number
    totalInvoices: number
    customerCount: number
    lastTransactionAt?: string | null
  }
  monthlyPerformance: PharmacyPerformancePoint[]
  staffUsers: Array<{
    _id: string
    pharmacyName: string
    email: string
    phone: string
    role: string
    isActive: boolean
    createdAt: string
  }>
}

interface TrialSummary {
  activeTrials: number
  expiringSoon: number
  expiredToday: number
}

interface TrialPharmacy {
  id: string
  pharmacyName: string
  email: string
  phone: string
  trialStart?: string
  trialEnd?: string
  trialDaysGranted?: number
  daysRemaining?: number | null
  isTrialExpired?: boolean
  trialStatus: 'active' | 'expiring' | 'expired' | 'unknown'
  subscriptionStatus?: string
}

export const SuperAdminDashboard: React.FC = () => {
  const { user, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  
  // Overview Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalPharmacies: 0,
    activeSubscriptions: 0,
    expiringSoon: 0,
    expired: 0,
    activeTrials: 0,
    expiredTrials: 0,
  })
  
  // Plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [planForm, setPlanForm] = useState({
    name: '',
    duration_days: '',
    price: '',
    discount: '0',
    description: '',
    status: 'active',
    planType: 'paid' as 'paid' | 'trial',
    autoLockBehavior: 'lock' as 'lock' | 'notice',
    features: '',
    maxInvoices: '',
    maxMedicines: '',
    maxLabRecords: '',
    isDefaultTrial: false,
  })

  // Requests
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  
  // Pharmacies
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null)
  const [showPharmacyModal, setShowPharmacyModal] = useState(false)
  const [pharmacySearch, setPharmacySearch] = useState('')
  const [pharmacyStatusFilter, setPharmacyStatusFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'pending' | 'suspended'>('all')
  const [pharmacyPlanFilter, setPharmacyPlanFilter] = useState<'all' | string>('all')
  const [pharmacySort, setPharmacySort] = useState<'joinDate' | 'totalSales' | 'daysRemaining'>('joinDate')
  const [pharmacyProfile, setPharmacyProfile] = useState<PharmacyDetail | null>(null)
  const [pharmacyProfileLoading, setPharmacyProfileLoading] = useState(false)
  
  // Analytics
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([])
  const [revenueByPlan, setRevenueByPlan] = useState<any[]>([])

  // Trials
  const [trialSummary, setTrialSummary] = useState<TrialSummary>({
    activeTrials: 0,
    expiringSoon: 0,
    expiredToday: 0,
  })
  const [trialPharmacies, setTrialPharmacies] = useState<TrialPharmacy[]>([])
  const [trialStatusFilter, setTrialStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialSearch, setTrialSearch] = useState('')
  const [trialSettingsForm, setTrialSettingsForm] = useState({
    enabled: true,
    durationDays: '30',
    autoLockBehavior: 'lock' as 'lock' | 'notice',
    maxInvoices: '',
    maxMedicines: '',
    maxLabRecords: '',
    defaultPlanId: '',
  })
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']
  const formatCurrency = (value: number) =>
    Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

  const renderRevenueByPlanLabel = (props: PieLabelRenderProps) => {
    const { name, percent } = props as PieLabelRenderProps & { name?: string | number; percent?: number }
    const label = typeof name === 'string' ? name : String(name ?? '')
    const value = typeof percent === 'number' ? percent : 0
    return `${label} ${(value * 100).toFixed(0)}%`
  }

  // Define all functions before useEffect
  const loadOverview = async () => {
    try {
      const [summaryRaw, subscriptionsRaw] = await Promise.all([
        api.getRevenueSummary().catch(() => ({ totalRevenue: 0, totalSubscriptions: 0, expiringSoon: 0, monthlyRevenue: {} })),
        api.getActiveSubscriptions().catch(() => []),
      ])
      const summary: any = summaryRaw ?? {}
      const subscriptions: any[] = Array.isArray(subscriptionsRaw) ? (subscriptionsRaw as any[]) : []
      
      setStats((prev) => ({
        ...prev,
        totalRevenue: summary.totalRevenue || 0,
        totalPharmacies: summary.totalSubscriptions || 0,
        activeSubscriptions: subscriptions.length || 0,
        expiringSoon: summary.expiringSoon || 0,
        expired: 0,
      }))
      
      setMonthlyRevenue(
        summary.monthlyRevenue
          ? Object.entries(summary.monthlyRevenue).map(([month, revenue]: [string, any]) => ({ month, revenue }))
          : []
      )
    } catch (error: any) {
      console.error('Error loading overview:', error)
      // Set default values if API fails
      setStats({
        totalRevenue: 0,
        totalPharmacies: 0,
        activeSubscriptions: 0,
        expiringSoon: 0,
        expired: 0,
        activeTrials: 0,
        expiredTrials: 0,
      })
    }
  }

  const loadPlans = async () => {
    try {
      const data = await api.getPlans()
      setPlans(Array.isArray(data) ? (data as Plan[]) : [])
    } catch (error: any) {
      console.error('Error loading plans:', error)
      setPlans([])
    }
  }

  const loadRequests = async () => {
    try {
      const status = requestFilter === 'all' ? undefined : requestFilter
      const data = await api.getSubscriptionRequests(status)
      setRequests(Array.isArray(data) ? (data as PaymentRequest[]) : [])
    } catch (error: any) {
      console.error('Error loading requests:', error)
      setRequests([])
    }
  }

  const loadPharmacies = async (): Promise<Pharmacy[]> => {
    try {
      const data = (await api.getAllPharmacies()) as Pharmacy[] | undefined
      const list = Array.isArray(data) ? data : []
      setPharmacies(list)

      if (list.length) {
        const aggregates = list.reduce(
          (acc, pharmacy) => {
            if (pharmacy.statusLabel === 'Active') {
              acc.activeSubscriptions += 1
            }
            if (pharmacy.statusLabel === 'Expired') {
              acc.expiredSubscriptions += 1
            }
            if (pharmacy.statusLabel === 'Trial') {
              acc.activeTrials += 1
            }
            if (pharmacy.trial?.isExpired) {
              acc.expiredTrials += 1
            }
            return acc
          },
          {
            activeSubscriptions: 0,
            expiredSubscriptions: 0,
            activeTrials: 0,
            expiredTrials: 0,
          }
        )

        setStats((prev) => ({
          ...prev,
          totalPharmacies: list.length,
          activeSubscriptions: aggregates.activeSubscriptions,
          expired: aggregates.expiredSubscriptions,
          activeTrials: aggregates.activeTrials,
          expiredTrials: aggregates.expiredTrials,
        }))
      } else {
        setStats((prev) => ({
          ...prev,
          totalPharmacies: 0,
          activeSubscriptions: 0,
          expired: 0,
          activeTrials: 0,
          expiredTrials: 0,
        }))
      }

      return list
    } catch (error: any) {
      console.error('Error loading pharmacies:', error)
      setPharmacies([])
      return []
    }
  }

  const loadAnalytics = async () => {
    try {
      const [monthlyRaw, byPlanRaw] = await Promise.all([
        api.getMonthlyRevenue().catch(() => []),
        api.getRevenueByPlan().catch(() => []),
      ])
      const monthly = Array.isArray(monthlyRaw) ? (monthlyRaw as any[]) : []
      const byPlan = Array.isArray(byPlanRaw) ? (byPlanRaw as any[]) : []
      setMonthlyRevenue(monthly)
      setRevenueByPlan(byPlan)
    } catch (error: any) {
      console.error('Error loading analytics:', error)
      setMonthlyRevenue([])
      setRevenueByPlan([])
    }
  }

  const loadTrialData = async () => {
    try {
      setTrialLoading(true)
      const statusParam = trialStatusFilter === 'all' ? undefined : trialStatusFilter
      const [overview, list] = await Promise.all([
        api.getTrialOverview().catch(() => null),
        api.getTrialPharmacies(statusParam).catch(() => []),
      ])

      if (overview?.settings) {
        const freeTrial = overview.settings.freeTrial
        setTrialSettingsForm({
          enabled: !!freeTrial?.enabled,
          durationDays: (freeTrial?.defaultDurationDays ?? 30).toString(),
          autoLockBehavior: (freeTrial?.autoLockBehavior ?? 'lock') as 'lock' | 'notice',
          maxInvoices:
            freeTrial?.limitations?.maxInvoices === null || typeof freeTrial?.limitations?.maxInvoices === 'undefined'
              ? ''
              : String(freeTrial.limitations.maxInvoices),
          maxMedicines:
            freeTrial?.limitations?.maxMedicines === null || typeof freeTrial?.limitations?.maxMedicines === 'undefined'
              ? ''
              : String(freeTrial.limitations.maxMedicines),
          maxLabRecords:
            freeTrial?.limitations?.maxLabRecords === null || typeof freeTrial?.limitations?.maxLabRecords === 'undefined'
              ? ''
              : String(freeTrial.limitations.maxLabRecords),
          defaultPlanId: freeTrial?.defaultPlan?._id ?? '',
        })
      }

      if (overview?.summary) {
        setTrialSummary({
          activeTrials: overview.summary.activeTrials ?? 0,
          expiringSoon: overview.summary.expiringSoon ?? 0,
          expiredToday: overview.summary.expiredToday ?? 0,
        })
      } else {
        setTrialSummary({
          activeTrials: 0,
          expiringSoon: 0,
          expiredToday: 0,
        })
      }

      setTrialPharmacies(list || [])
    } catch (error: any) {
      console.error('Error loading trial data:', error)
      setTrialPharmacies([])
    } finally {
      setTrialLoading(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      switch (activeTab) {
        case 'overview':
          await loadOverview()
          break
        case 'plans':
          await loadPlans()
          break
        case 'requests':
          await loadRequests()
          break
        case 'pharmacies':
          await loadPharmacies()
          break
        case 'analytics':
          await loadAnalytics()
          break
        case 'trials':
          await loadPlans()
          await loadTrialData()
          break
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
      // Don't show alert for 404 errors - might be normal if no data exists yet
      if (!error.message?.includes('Route not found') && !error.message?.includes('404')) {
        alert(`Error: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && user.role === 'super_admin' && !userLoading) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, requestFilter, trialStatusFilter, user, userLoading])

  const planOptions = useMemo(() => {
    const unique = new Set<string>()
    pharmacies.forEach((pharmacy) => {
      unique.add(pharmacy.planName || 'Free Trial')
    })
    if (!unique.size) {
      return []
    }
    return Array.from(unique.values()).sort()
  }, [pharmacies])

  const filteredPharmacies = useMemo(() => {
    const normalizedSearch = pharmacySearch.trim().toLowerCase()

    const matches = pharmacies.filter((pharmacy) => {
      const statusLabel = pharmacy.statusLabel || (pharmacy.isActive ? 'Active' : 'Suspended')

      const statusMatches =
        pharmacyStatusFilter === 'all' ||
        (pharmacyStatusFilter === 'active' && statusLabel === 'Active') ||
        (pharmacyStatusFilter === 'trial' && statusLabel === 'Trial') ||
        (pharmacyStatusFilter === 'expired' && statusLabel === 'Expired') ||
        (pharmacyStatusFilter === 'pending' && statusLabel === 'Pending Approval') ||
        (pharmacyStatusFilter === 'suspended' && (!pharmacy.isActive || statusLabel === 'Suspended'))

      if (!statusMatches) return false

      const planName = pharmacy.planName || 'Free Trial'
      if (pharmacyPlanFilter !== 'all' && planName !== pharmacyPlanFilter) return false

      if (!normalizedSearch) return true

      const name = pharmacy.pharmacyName?.toLowerCase() || ''
      const owner = pharmacy.ownerName?.toLowerCase() || ''
      const email = pharmacy.email?.toLowerCase() || ''
      const phone = pharmacy.phone?.toLowerCase() || ''

      return (
        name.includes(normalizedSearch) ||
        owner.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      )
    })

    const sorted = [...matches].sort((a, b) => {
      switch (pharmacySort) {
        case 'totalSales':
          return (b.metrics?.totalSales || 0) - (a.metrics?.totalSales || 0)
        case 'daysRemaining':
          {
            const daysA =
              typeof a.daysRemaining === 'number'
                ? a.daysRemaining
                : a.trial?.daysRemaining != null
                ? a.trial.daysRemaining
                : 0
            const daysB =
              typeof b.daysRemaining === 'number'
                ? b.daysRemaining
                : b.trial?.daysRemaining != null
                ? b.trial.daysRemaining
                : 0
            return daysB - daysA
          }
        case 'joinDate':
        default:
          return new Date(b.joinDate || 0).getTime() - new Date(a.joinDate || 0).getTime()
      }
    })

    return sorted
  }, [pharmacies, pharmacySearch, pharmacyStatusFilter, pharmacyPlanFilter, pharmacySort])

  const filteredTrials = useMemo(() => {
    const normalized = trialSearch.trim().toLowerCase()
    if (!normalized) return trialPharmacies

    return trialPharmacies.filter((trial) => {
      const name = trial.pharmacyName?.toLowerCase() || ''
      const email = trial.email?.toLowerCase() || ''
      const phone = trial.phone?.toLowerCase() || ''
      return name.includes(normalized) || email.includes(normalized) || phone.includes(normalized)
    })
  }, [trialPharmacies, trialSearch])

  // Early returns must come AFTER all hooks
  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!user || user.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const planData = {
        name: planForm.name,
        duration_days: parseInt(planForm.duration_days),
        price: parseFloat(planForm.price),
        discount: parseFloat(planForm.discount),
        description: planForm.description,
        status: planForm.status,
        planType: planForm.planType,
        autoLockBehavior: planForm.autoLockBehavior,
        features: planForm.features
          .split(',')
          .map((feature) => feature.trim())
          .filter((feature) => feature.length > 0),
        limitations: {
          maxInvoices: planForm.maxInvoices ? parseInt(planForm.maxInvoices) : null,
          maxMedicines: planForm.maxMedicines ? parseInt(planForm.maxMedicines) : null,
          maxLabRecords: planForm.maxLabRecords ? parseInt(planForm.maxLabRecords) : null,
        },
        isDefaultTrial: planForm.planType === 'trial' ? planForm.isDefaultTrial : false,
      }

      if (editingPlan) {
        await api.updatePlan(editingPlan._id, planData)
      } else {
        await api.createPlan(planData)
      }
      
      setShowPlanModal(false)
      setEditingPlan(null)
      setPlanForm({
        name: '',
        duration_days: '',
        price: '',
        discount: '0',
        description: '',
        status: 'active',
        planType: 'paid',
        autoLockBehavior: 'lock',
        features: '',
        maxInvoices: '',
        maxMedicines: '',
        maxLabRecords: '',
        isDefaultTrial: false,
      })
      loadPlans()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan)
    setPlanForm({
      name: plan.name,
      duration_days: plan.duration_days.toString(),
      price: plan.price.toString(),
      discount: plan.discount.toString(),
      description: plan.description || '',
      status: plan.status,
      planType: plan.planType || 'paid',
      autoLockBehavior: plan.autoLockBehavior || 'lock',
      features: (plan.features || []).join(', '),
      maxInvoices: plan.limitations?.maxInvoices != null ? plan.limitations.maxInvoices.toString() : '',
      maxMedicines: plan.limitations?.maxMedicines != null ? plan.limitations.maxMedicines.toString() : '',
      maxLabRecords: plan.limitations?.maxLabRecords != null ? plan.limitations.maxLabRecords.toString() : '',
      isDefaultTrial: !!plan.isDefaultTrial,
    })
    setShowPlanModal(true)
  }

  const handleApproveRequest = async (id: string) => {
    if (!confirm('Approve this subscription request?')) return
    
    try {
      await api.approveSubscription(id)
      alert('Subscription approved successfully!')
      loadRequests()
      loadOverview()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleRejectRequest = async (id: string) => {
    const reason = prompt('Enter rejection reason (optional):')
    try {
      await api.rejectSubscription(id, reason || undefined)
      alert('Subscription request rejected')
      loadRequests()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleViewPharmacy = async (pharmacy: Pharmacy) => {
    setSelectedPharmacy(pharmacy)
    setPharmacyProfile(null)
    setPharmacyProfileLoading(true)
    setShowPharmacyModal(true)
    try {
      const profile = (await api.getPharmacyProfile(pharmacy._id)) as PharmacyDetail
      setPharmacyProfile(profile)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setPharmacyProfileLoading(false)
    }
  }

  const handleResetPassword = async (pharmacyId: string) => {
    const newPassword = prompt('Enter new password (minimum 6 characters):')
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }
    
    try {
      await api.resetPharmacyPassword(pharmacyId, newPassword)
      alert('Password reset successfully!')
      await refreshPharmacyList(pharmacyId)
      await refreshPharmacyProfile(pharmacyId)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const refreshPharmacyProfile = async (pharmacyId: string) => {
    setPharmacyProfileLoading(true)
    try {
      const profile = (await api.getPharmacyProfile(pharmacyId)) as PharmacyDetail
      setPharmacyProfile(profile)
    } catch (error: any) {
      console.error('Error refreshing pharmacy profile:', error)
    } finally {
      setPharmacyProfileLoading(false)
    }
  }

  const refreshPharmacyList = async (pharmacyId?: string) => {
    const list = await loadPharmacies()
    if (pharmacyId) {
      const updated = list.find((item) => item._id === pharmacyId)
      if (updated) {
        setSelectedPharmacy(updated)
      }
    }
  }

  const handleExtendSubscription = async (pharmacyId: string) => {
    const days = prompt('Enter number of days to extend:')
    if (!days || parseInt(days) <= 0) {
      alert('Please enter a valid number of days')
      return
    }
    
    try {
      await api.extendPharmacySubscription(pharmacyId, parseInt(days))
      alert('Subscription extended successfully!')
      await refreshPharmacyList(pharmacyId)
      await refreshPharmacyProfile(pharmacyId)
      if (activeTab === 'overview') {
        loadOverview()
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleExtendTrial = async (pharmacyId: string) => {
    const days = prompt('Enter additional trial days to grant:')
    if (!days || parseInt(days) <= 0) {
      alert('Please enter a valid number greater than zero')
      return
    }

    try {
      await api.extendPharmacyTrial(pharmacyId, parseInt(days))
      alert('Trial extended successfully!')
      await refreshPharmacyList(pharmacyId)
      await refreshPharmacyProfile(pharmacyId)
      await loadTrialData()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleResetTrial = async (pharmacyId: string) => {
    const days = prompt('Reset trial to how many total days? Leave blank for default duration.')
    if (days && parseInt(days) <= 0) {
      alert('Please enter a positive number of days')
      return
    }

    try {
      await api.resetPharmacyTrial(pharmacyId, days ? parseInt(days) : undefined)
      alert('Trial reset successfully!')
      await refreshPharmacyList(pharmacyId)
      await refreshPharmacyProfile(pharmacyId)
      await loadTrialData()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleExpireTrial = async (pharmacyId: string) => {
    if (!confirm('End this trial immediately? The pharmacy will be prompted to upgrade.')) return
    try {
      await api.expirePharmacyTrial(pharmacyId)
      alert('Trial ended successfully!')
      await refreshPharmacyList(pharmacyId)
      await refreshPharmacyProfile(pharmacyId)
      await loadTrialData()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleTogglePharmacyStatus = async (pharmacy: Pharmacy) => {
    const nextStatus = !pharmacy.isActive
    if (
      !confirm(
        nextStatus
          ? `Activate ${pharmacy.pharmacyName}?`
          : `Suspend ${pharmacy.pharmacyName}? They will lose access until reactivated.`
      )
    )
      return
    try {
      await api.updatePharmacyStatus(pharmacy._id, nextStatus)
      await refreshPharmacyList(pharmacy._id)
      await refreshPharmacyProfile(pharmacy._id)
      alert(nextStatus ? 'Pharmacy activated' : 'Pharmacy suspended')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleSendNotification = async (pharmacy: Pharmacy) => {
    const title = prompt(`Notification title for ${pharmacy.pharmacyName}`)
    if (!title) return
    const message = prompt('Notification message')
    if (!message) return
    try {
      await api.broadcastNotification({
        targetPharmacyId: pharmacy._id,
        type: 'admin_notice',
        title,
        message,
      })
      alert('Notification sent successfully!')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleTrialSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        enabled: trialSettingsForm.enabled,
        durationDays: parseInt(trialSettingsForm.durationDays) || 30,
        autoLockBehavior: trialSettingsForm.autoLockBehavior,
        limitations: {
          maxInvoices: trialSettingsForm.maxInvoices ? parseInt(trialSettingsForm.maxInvoices) : null,
          maxMedicines: trialSettingsForm.maxMedicines ? parseInt(trialSettingsForm.maxMedicines) : null,
          maxLabRecords: trialSettingsForm.maxLabRecords ? parseInt(trialSettingsForm.maxLabRecords) : null,
        },
      }

      if (trialSettingsForm.defaultPlanId) {
        payload.defaultPlanId = trialSettingsForm.defaultPlanId
      } else {
        payload.defaultPlanId = null
      }

      await api.updateTrialSettings(payload)
      alert('Trial settings updated successfully!')
      await Promise.all([loadPlans(), loadTrialData()])
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const renderPharmacyProfile = () => {
    if (pharmacyProfileLoading) {
      return <div className="py-12 text-center text-gray-600">Loading pharmacy details...</div>
    }

    if (!selectedPharmacy) {
      return null
    }

    const profileData = pharmacyProfile?.profile || {
      pharmacyName: selectedPharmacy.pharmacyName,
      ownerName: selectedPharmacy.ownerName,
      contact: {
        phone: selectedPharmacy.phone,
        email: selectedPharmacy.email,
        address: selectedPharmacy.address,
      },
      registrationDate: selectedPharmacy.joinDate,
      planName: selectedPharmacy.planName || 'Free Trial',
      planType: selectedPharmacy.subscription ? 'paid' : 'trial',
      daysRemaining:
        selectedPharmacy.daysRemaining ??
        selectedPharmacy.trial?.daysRemaining ??
        null,
      isActive: selectedPharmacy.isActive,
      status: selectedPharmacy.statusLabel,
    }

    const metrics = pharmacyProfile?.metrics || {
      totalSales: selectedPharmacy.metrics?.totalSales || 0,
      totalTransactions: selectedPharmacy.metrics?.totalTransactions || 0,
      totalProfit: selectedPharmacy.metrics?.totalProfit || 0,
      totalDebts: selectedPharmacy.metrics?.totalDebts || 0,
      totalMedicines: selectedPharmacy.metrics?.totalMedicines || 0,
      skuCount: selectedPharmacy.metrics?.skuCount || 0,
      totalInvoices: selectedPharmacy.metrics?.totalInvoices || 0,
      customerCount: selectedPharmacy.metrics?.customerCount || 0,
      lastTransactionAt: selectedPharmacy.metrics?.lastTransactionAt || null,
    }

    const monthlyPerformance = (pharmacyProfile?.monthlyPerformance || []).map((item) => ({
      ...item,
      label:
        item.label ||
        `${new Date(item.year, item.month ? item.month - 1 : 0).toLocaleString('default', {
          month: 'short',
        })} ${item.year}`,
    }))

    const staffUsers = pharmacyProfile?.staffUsers || []
    const trialDaysRemaining =
      pharmacyProfile?.trial?.daysRemaining ?? selectedPharmacy.trial?.daysRemaining ?? null

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
          <div className="border border-gray-200 rounded-2xl p-5 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-700">Owner</p>
                <p>{profileData.ownerName || '—'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Phone</p>
                <p>{profileData.contact?.phone || selectedPharmacy.phone || '—'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Email</p>
                <p>{profileData.contact?.email || selectedPharmacy.email || '—'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Address</p>
                <p>{profileData.contact?.address || '—'}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Join Date</p>
                <p>
                  {profileData.registrationDate
                    ? new Date(profileData.registrationDate).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Status</p>
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                    selectedPharmacy.statusColor || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {selectedPharmacy.statusLabel || (selectedPharmacy.isActive ? 'Active' : 'Inactive')}
                </span>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-2xl p-5 bg-gray-50 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Plan:</span> {profileData.planName || 'Free Trial'}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Days Remaining:</span>{' '}
              {profileData.daysRemaining != null
                ? `${profileData.daysRemaining} day${profileData.daysRemaining === 1 ? '' : 's'}`
                : trialDaysRemaining != null
                ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`
                : '—'}
            </p>
            {pharmacyProfile?.subscription && (
              <>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Start:</span>{' '}
                  {(() => {
                    const startValue =
                      pharmacyProfile.subscription.start_at ||
                      (pharmacyProfile.subscription as any)?.startDate
                    return startValue ? new Date(startValue).toLocaleDateString() : '—'
                  })()}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">End:</span>{' '}
                  {(() => {
                    const endValue =
                      pharmacyProfile.subscription.end_at ||
                      (pharmacyProfile.subscription as any)?.endDate
                    return endValue ? new Date(endValue).toLocaleDateString() : '—'
                  })()}
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => handleResetPassword(selectedPharmacy._id)}>
                <Lock className="w-4 h-4 mr-2" />
                Reset Password
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExtendSubscription(selectedPharmacy._id)}>
                <Calendar className="w-4 h-4 mr-2" />
                Extend Subscription
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExtendTrial(selectedPharmacy._id)}>
                <Clock className="w-4 h-4 mr-2" />
                Extend Trial
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExpireTrial(selectedPharmacy._id)}>
                <XCircle className="w-4 h-4 mr-2" />
                End Trial
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 mt-3 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTogglePharmacyStatus(selectedPharmacy)}
                className={
                  selectedPharmacy.isActive
                    ? 'text-red-600 border-red-300 hover:bg-red-50'
                    : 'text-green-600 border-green-300 hover:bg-green-50'
                }
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                {selectedPharmacy.isActive ? 'Suspend' : 'Activate'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSendNotification(selectedPharmacy)}>
                <Bell className="w-4 h-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Sales</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(metrics.totalSales || 0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-semibold text-gray-900">{metrics.totalTransactions}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Outstanding Debts</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(metrics.totalDebts || 0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Total Profit</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(metrics.totalProfit || 0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Medicines in Stock</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.totalMedicines} units ({metrics.skuCount} SKUs)
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Customers / Invoices</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.customerCount} customers · {metrics.totalInvoices} invoices
            </p>
          </Card>
        </div>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Performance</h3>
          {monthlyPerformance.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyPerformance}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="totalSales" stroke="#6C63FF" fill="url(#colorSales)" name="Sales" />
                <Area type="monotone" dataKey="totalProfit" stroke="#34D399" fill="#34D39920" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-10 text-center text-gray-500 text-sm">No performance data available yet.</div>
          )}
        </Card>

        {staffUsers.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Users</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="py-2 px-3 font-medium text-gray-600">Name</th>
                    <th className="py-2 px-3 font-medium text-gray-600">Email</th>
                    <th className="py-2 px-3 font-medium text-gray-600">Phone</th>
                    <th className="py-2 px-3 font-medium text-gray-600">Role</th>
                    <th className="py-2 px-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.map((staff) => (
                    <tr key={staff._id} className="border-b border-gray-100">
                      <td className="py-2 px-3">{staff.pharmacyName || '—'}</td>
                      <td className="py-2 px-3 text-gray-600">{staff.email}</td>
                      <td className="py-2 px-3 text-gray-600">{staff.phone || '—'}</td>
                      <td className="py-2 px-3 text-gray-600">{staff.role}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            staff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {staff.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    )
  }

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: TrendingUp },
    { id: 'plans' as Tab, label: 'Plans', icon: Package },
    { id: 'requests' as Tab, label: 'Requests', icon: CreditCard },
    { id: 'pharmacies' as Tab, label: 'Pharmacies', icon: Building2 },
    { id: 'analytics' as Tab, label: 'Analytics', icon: DollarSign },
    { id: 'trials' as Tab, label: 'Free Trial', icon: Gift },
  ]

  return (
    <div className="space-y-6 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage subscriptions, plans, and pharmacies</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex flex-nowrap gap-4 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </Card>

        <Card>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Pharmacies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPharmacies}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
                  <p className="text-sm text-gray-600">Expiring Soon</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Trials</p>
              <p className="text-2xl font-bold text-purple-600">{stats.activeTrials}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expired Trials</p>
              <p className="text-2xl font-bold text-gray-700">{stats.expiredTrials}</p>
            </div>
          </div>
        </Card>
      </div>

          {/* Monthly Revenue Chart */}
          {monthlyRevenue.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Monthly Revenue</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#0088FE" name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Subscription Plans</h2>
            <Button onClick={() => {
              setEditingPlan(null)
              setPlanForm({
                name: '',
                duration_days: '',
                price: '',
                discount: '0',
                description: '',
                status: 'active',
              planType: 'paid',
              autoLockBehavior: 'lock',
              features: '',
              maxInvoices: '',
              maxMedicines: '',
              maxLabRecords: '',
              isDefaultTrial: false,
              })
              setShowPlanModal(true)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Plan
            </Button>
          </div>

      <Card>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading plans...</p>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No plans found</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Plan Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Price</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Active Users</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Revenue</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => {
                        return (
                          <tr key={plan._id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{plan.name}</td>
                            <td className="py-3 px-4 text-gray-600">
                              {plan.planType === 'trial' ? (
                                <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                                  Trial{plan.isDefaultTrial ? ' • Default' : ''}
                                </span>
                              ) : (
                                'Paid'
                              )}
                            </td>
                            <td className="py-3 px-4 text-gray-600">{plan.duration_days} days</td>
                            <td className="py-3 px-4">${plan.price.toFixed(2)}</td>
                            <td className="py-3 px-4">{plan.discount}%</td>
                            <td className="py-3 px-4">{plan.activeUsers || 0}</td>
                            <td className="py-3 px-4 font-medium text-green-600">${(plan.totalRevenue || 0).toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                  plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {plan.status === 'active' ? '✅ Active' : '❌ Inactive'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditPlan(plan)}
                                  className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                                  title="Edit Plan"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
                                    await api.updatePlanStatus(plan._id, newStatus)
                                    loadPlans()
                                  }}
                                  className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"
                                  title={plan.status === 'active' ? 'Deactivate Plan' : 'Activate Plan'}
                                >
                                  <ShieldAlert className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden space-y-4">
                  {plans.map((plan) => (
                    <div key={plan._id} className="rounded-2xl border border-gray-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                          <p className="text-xs text-gray-500">{plan.description || 'No description provided'}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            plan.planType === 'trial' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {plan.planType === 'trial' ? `Trial${plan.isDefaultTrial ? ' • Default' : ''}` : 'Paid'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600">
                        <div>
                          <p className="font-semibold text-gray-700">Duration</p>
                          <p>{plan.duration_days} days</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Price</p>
                          <p>${plan.price.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Discount</p>
                          <p>{plan.discount}%</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Active Users</p>
                          <p>{plan.activeUsers || 0}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Revenue</p>
                          <p>${(plan.totalRevenue || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Status</p>
                          <p>{plan.status === 'active' ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>

                      {plan.features?.length ? (
                        <div className="mt-3 text-xs text-gray-600">
                          <p className="font-semibold text-gray-700">Features</p>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {plan.features.map((feature, index) => (
                              <li key={`${plan._id}-feature-${index}`}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <Button size="sm" className="w-full" onClick={() => handleEditPlan(plan)}>
                          <Edit className="w-4 h-4 mr-2" /> Edit Plan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={async () => {
                            const newStatus = plan.status === 'active' ? 'inactive' : 'active'
                            await api.updatePlanStatus(plan._id, newStatus)
                            loadPlans()
                          }}
                        >
                          <ShieldAlert className="w-4 h-4 mr-2" />
                          {plan.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Subscription Requests</h2>
            <div className="flex space-x-2">
          <Button
                variant={requestFilter === 'all' ? 'primary' : 'outline'}
                onClick={() => setRequestFilter('all')}
          >
                All
          </Button>
          <Button
                variant={requestFilter === 'pending' ? 'primary' : 'outline'}
                onClick={() => setRequestFilter('pending')}
          >
                Pending
          </Button>
          <Button
                variant={requestFilter === 'approved' ? 'primary' : 'outline'}
                onClick={() => setRequestFilter('approved')}
          >
                Approved
          </Button>
          <Button
                variant={requestFilter === 'rejected' ? 'primary' : 'outline'}
                onClick={() => setRequestFilter('rejected')}
          >
                Rejected
          </Button>
            </div>
          </div>

          <Card>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Pharmacy</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Plan</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Method</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Reference</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{req.user_id.pharmacyName}</p>
                            <p className="text-sm text-gray-600">{req.user_id.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">{req.plan_id.name}</td>
                        <td className="py-3 px-4">{req.method}</td>
                        <td className="py-3 px-4 font-medium">${req.amount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{req.reference_id || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            req.status === 'approved' ? 'bg-green-100 text-green-700' :
                            req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {req.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApproveRequest(req._id)}
                                className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req._id)}
                                className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Pharmacies Tab */}
      {activeTab === 'pharmacies' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">All Pharmacies</h2>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={pharmacySearch}
                onChange={(e) => setPharmacySearch(e.target.value)}
                placeholder="Search by pharmacy, owner, email, or phone"
                className="w-full rounded-xl border border-gray-300 bg-white px-10 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600" htmlFor="pharmacy-status-filter">
                  Status
                </label>
                <select
                  id="pharmacy-status-filter"
                  value={pharmacyStatusFilter}
                  onChange={(e) =>
                    setPharmacyStatusFilter(
                      e.target.value as 'all' | 'active' | 'trial' | 'expired' | 'pending' | 'suspended'
                    )
                  }
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600" htmlFor="pharmacy-plan-filter">
                  Plan
                </label>
                <select
                  id="pharmacy-plan-filter"
                  value={pharmacyPlanFilter}
                  onChange={(e) =>
                    setPharmacyPlanFilter(
                      (e.target.value === 'all' ? 'all' : e.target.value) as 'all' | string
                    )
                  }
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="all">All plans</option>
                  <option value="Free Trial">Free Trial</option>
                  {planOptions.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600" htmlFor="pharmacy-sort">
                  Sort By
                </label>
                <select
                  id="pharmacy-sort"
                  value={pharmacySort}
                  onChange={(e) => setPharmacySort(e.target.value as 'joinDate' | 'totalSales' | 'daysRemaining')}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="joinDate">Newest first</option>
                  <option value="totalSales">Total sales</option>
                  <option value="daysRemaining">Days remaining</option>
                </select>
              </div>
            </div>
          </div>
 
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading pharmacies...</p>
          </div>
        ) : pharmacies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No pharmacies found</p>
          </div>
        ) : filteredPharmacies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No pharmacies match your search.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Pharmacy</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Owner</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Contact</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Plan</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Days Remaining</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Sales</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Transactions</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Debts</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Join Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPharmacies.map((pharmacy) => (
                    <tr key={pharmacy._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{pharmacy.pharmacyName}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{pharmacy.ownerName || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <p>{pharmacy.email}</p>
                          <p className="text-gray-600">{pharmacy.phone}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">{pharmacy.planName || 'Free Trial'}</td>
                      <td className="py-3 px-4">
                        {typeof pharmacy.daysRemaining === 'number'
                          ? `${pharmacy.daysRemaining} day${pharmacy.daysRemaining === 1 ? '' : 's'}`
                          : pharmacy.trial?.daysRemaining != null
                          ? `${pharmacy.trial.daysRemaining} day${pharmacy.trial.daysRemaining === 1 ? '' : 's'}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                        {formatCurrency(pharmacy.metrics?.totalSales || 0)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {pharmacy.metrics?.totalTransactions ?? 0}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatCurrency(pharmacy.metrics?.totalDebts || 0)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {pharmacy.joinDate ? new Date(pharmacy.joinDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            pharmacy.statusColor || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {pharmacy.statusLabel || (pharmacy.isActive ? 'Active' : 'Inactive')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewPharmacy(pharmacy)}
                            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(pharmacy._id)}
                            className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"
                            title="Reset Password"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleTogglePharmacyStatus(pharmacy)}
                            className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"
                            title={pharmacy.isActive ? 'Suspend Pharmacy' : 'Activate Pharmacy'}
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-4">
              {filteredPharmacies.map((pharmacy) => (
                <div key={pharmacy._id} className="rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{pharmacy.pharmacyName}</h3>
                      <p className="text-sm text-gray-500">{pharmacy.ownerName || 'Owner not set'}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pharmacy.statusColor || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {pharmacy.statusLabel || (pharmacy.isActive ? 'Active' : 'Inactive')}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <p className="font-semibold text-gray-700">Plan</p>
                      <p>{pharmacy.planName || 'Free Trial'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Days Left</p>
                      <p>
                        {typeof pharmacy.daysRemaining === 'number'
                          ? `${pharmacy.daysRemaining}d`
                          : pharmacy.trial?.daysRemaining != null
                          ? `${pharmacy.trial.daysRemaining}d`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Sales</p>
                      <p>{formatCurrency(pharmacy.metrics?.totalSales || 0)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Transactions</p>
                      <p>{pharmacy.metrics?.totalTransactions ?? 0}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Debts</p>
                      <p>{formatCurrency(pharmacy.metrics?.totalDebts || 0)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Joined</p>
                      <p>{pharmacy.joinDate ? new Date(pharmacy.joinDate).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <p className="font-semibold text-gray-700">Contact</p>
                    <p>{pharmacy.email || '—'}</p>
                    <p>{pharmacy.phone || '—'}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" className="flex-1" onClick={() => handleViewPharmacy(pharmacy)}>
                      <Eye className="w-4 h-4 mr-2" /> View
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleResetPassword(pharmacy._id)}>
                      <Lock className="w-4 h-4 mr-2" /> Reset
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleTogglePharmacyStatus(pharmacy)}
                    >
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      {pharmacy.isActive ? 'Suspend' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Revenue Analytics</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold mb-4">Monthly Revenue</h3>
              {monthlyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#0088FE" name="Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No revenue data available</p>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="text-lg font-semibold mb-4">Revenue by Plan</h3>
              {revenueByPlan.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueByPlan}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderRevenueByPlanLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {revenueByPlan.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No revenue data available</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Trials Tab */}
      {activeTab === 'trials' && (
        <div className="space-y-6">
          {trialLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">Loading trial data...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active Trials</p>
                      <p className="text-2xl font-bold text-purple-600">{trialSummary.activeTrials}</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expiring Soon</p>
                      <p className="text-2xl font-bold text-amber-600">{trialSummary.expiringSoon}</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expired Today</p>
                      <p className="text-2xl font-bold text-gray-700">{trialSummary.expiredToday}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <form onSubmit={handleTrialSettingsSubmit} className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Free Trial Controls</h3>
                      <p className="text-sm text-gray-500">Configure the global free trial experience for new pharmacies.</p>
                    </div>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={trialSettingsForm.enabled}
                        onChange={(e) => setTrialSettingsForm({ ...trialSettingsForm, enabled: e.target.checked })}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {trialSettingsForm.enabled ? 'Free Trial Enabled' : 'Free Trial Disabled'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Trial Duration (days)"
                      type="number"
                      min="1"
                      value={trialSettingsForm.durationDays}
                      onChange={(e) => setTrialSettingsForm({ ...trialSettingsForm, durationDays: e.target.value })}
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auto Lock Behaviour</label>
                      <select
                        value={trialSettingsForm.autoLockBehavior}
                        onChange={(e) =>
                          setTrialSettingsForm({
                            ...trialSettingsForm,
                            autoLockBehavior: e.target.value as 'lock' | 'notice',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                      >
                        <option value="lock">Lock access when trial ends</option>
                        <option value="notice">Show upgrade notice only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Trial Plan</label>
                      <select
                        value={trialSettingsForm.defaultPlanId}
                        onChange={(e) =>
                          setTrialSettingsForm({
                            ...trialSettingsForm,
                            defaultPlanId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                      >
                        <option value="">-- No Plan Selected --</option>
                        {plans
                          .filter((plan) => plan.planType === 'trial')
                          .map((plan) => (
                            <option key={plan._id} value={plan._id}>
                              {plan.name} — {plan.duration_days} days
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Invoice Limit (optional)"
                      type="number"
                      min="0"
                      value={trialSettingsForm.maxInvoices}
                      onChange={(e) => setTrialSettingsForm({ ...trialSettingsForm, maxInvoices: e.target.value })}
                      placeholder="Unlimited if blank"
                    />
                    <Input
                      label="Medicine Limit (optional)"
                      type="number"
                      min="0"
                      value={trialSettingsForm.maxMedicines}
                      onChange={(e) => setTrialSettingsForm({ ...trialSettingsForm, maxMedicines: e.target.value })}
                      placeholder="Unlimited if blank"
                    />
                    <Input
                      label="Lab Records Limit (optional)"
                      type="number"
                      min="0"
                      value={trialSettingsForm.maxLabRecords}
                      onChange={(e) => setTrialSettingsForm({ ...trialSettingsForm, maxLabRecords: e.target.value })}
                      placeholder="Unlimited if blank"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit">Save Settings</Button>
                  </div>
                </form>
              </Card>

              <Card>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Trial Pharmacies</h3>
                      <p className="text-sm text-gray-500">Monitor pharmacies on free trial and manage their access.</p>
                    </div>
                    <div className="flex gap-2">
                      {(['all', 'active', 'expiring', 'expired'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setTrialStatusFilter(status)}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            trialStatusFilter === status
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <input
                      value={trialSearch}
                      onChange={(e) => setTrialSearch(e.target.value)}
                      placeholder="Search pharmacy name, email, or phone"
                      className="w-full md:w-72 px-3 py-2 border border-gray-300 rounded-xl"
                    />
                    <div className="text-sm text-gray-500">
                      Showing {filteredTrials.length} of {trialPharmacies.length} pharmacies
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="hidden lg:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                            <th className="py-2 px-4">Pharmacy</th>
                            <th className="py-2 px-4">Contact</th>
                            <th className="py-2 px-4">Trial Ends</th>
                            <th className="py-2 px-4">Remaining</th>
                            <th className="py-2 px-4">Status</th>
                            <th className="py-2 px-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTrials.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-gray-500">
                                No pharmacies found for the selected filter.
                              </td>
                            </tr>
                          ) : (
                            filteredTrials.map((trial) => (
                              <tr key={trial.id} className="border-b border-gray-100 text-sm">
                                <td className="py-3 px-4">
                                  <p className="font-semibold text-gray-900">{trial.pharmacyName}</p>
                                </td>
                                <td className="py-3 px-4">
                                  <p className="text-gray-600">{trial.email}</p>
                                  <p className="text-gray-500">{trial.phone}</p>
                                </td>
                                <td className="py-3 px-4">
                                  {trial.trialEnd ? new Date(trial.trialEnd).toLocaleDateString() : '—'}
                                </td>
                                <td className="py-3 px-4">
                                  {typeof trial.daysRemaining === 'number'
                                    ? `${trial.daysRemaining} day${trial.daysRemaining === 1 ? '' : 's'}`
                                    : '—'}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      trial.trialStatus === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : trial.trialStatus === 'expiring'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-200 text-gray-700'
                                    }`}
                                  >
                                    {trial.trialStatus === 'unknown'
                                      ? 'Unknown'
                                      : trial.trialStatus.charAt(0).toUpperCase() + trial.trialStatus.slice(1)}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleExtendTrial(trial.id)}>
                                      Extend
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleResetTrial(trial.id)}>
                                      Reset
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleExpireTrial(trial.id)}
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                      End
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="lg:hidden space-y-4">
                      {filteredTrials.length === 0 ? (
                        <div className="py-6 text-center text-gray-500">No pharmacies found for the selected filter.</div>
                      ) : (
                        filteredTrials.map((trial) => (
                          <div key={trial.id} className="rounded-2xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="text-base font-semibold text-gray-900">{trial.pharmacyName}</h4>
                                <p className="text-sm text-gray-500">{trial.email || 'No email'}</p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  trial.trialStatus === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : trial.trialStatus === 'expiring'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {trial.trialStatus === 'unknown'
                                  ? 'Unknown'
                                  : trial.trialStatus.charAt(0).toUpperCase() + trial.trialStatus.slice(1)}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600">
                              <div>
                                <p className="font-semibold text-gray-700">Trial Ends</p>
                                <p>{trial.trialEnd ? new Date(trial.trialEnd).toLocaleDateString() : '—'}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700">Remaining</p>
                                <p>
                                  {typeof trial.daysRemaining === 'number'
                                    ? `${trial.daysRemaining} day${trial.daysRemaining === 1 ? '' : 's'}`
                                    : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700">Phone</p>
                                <p>{trial.phone || '—'}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700">Status</p>
                                <p>{trial.subscriptionStatus || '—'}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-col sm:flex-row gap-2">
                              <Button variant="outline" size="sm" className="w-full" onClick={() => handleExtendTrial(trial.id)}>
                                Extend Trial
                              </Button>
                              <Button variant="outline" size="sm" className="w-full" onClick={() => handleResetTrial(trial.id)}>
                                Reset Trial
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleExpireTrial(trial.id)}
                              >
                                End Trial
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingPlan ? 'Edit Plan' : 'Create Plan'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Define pricing, duration, and feature limits for this plan.</p>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="max-h-[calc(90vh-6rem)] overflow-y-auto px-6 py-5 space-y-8">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Plan Basics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Plan Name"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    required
                    placeholder="e.g., Professional, Premium"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                    <select
                      value={planForm.planType}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          planType: e.target.value as 'paid' | 'trial',
                          isDefaultTrial: e.target.value === 'trial' ? planForm.isDefaultTrial : false,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                    >
                      <option value="paid">Paid</option>
                      <option value="trial">Free Trial</option>
                    </select>
                  </div>
                  <Input
                    label="Duration (days)"
                    type="number"
                    min="1"
                    value={planForm.duration_days}
                    onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })}
                    required
                  />
                  <Input
                    label="Price ($)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Discount (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={planForm.discount}
                    onChange={(e) => setPlanForm({ ...planForm, discount: e.target.value })}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={planForm.status}
                      onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <Input
                  label="Description (Optional)"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Short summary shown to users"
                />
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Feature Highlights</h3>
                <textarea
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  placeholder="Comma separated list, e.g. Offline Sync, Advanced Analytics"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </section>

              {planForm.planType === 'trial' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Trial Controls</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auto Lock Behaviour</label>
                      <select
                        value={planForm.autoLockBehavior}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            autoLockBehavior: e.target.value as 'lock' | 'notice',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                      >
                        <option value="lock">Lock access when trial ends</option>
                        <option value="notice">Show notice but keep limited access</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={planForm.isDefaultTrial}
                        onChange={(e) => setPlanForm({ ...planForm, isDefaultTrial: e.target.checked })}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                      />
                      Set as default free trial plan
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Invoice Limit (optional)"
                      type="number"
                      min="0"
                      value={planForm.maxInvoices}
                      onChange={(e) => setPlanForm({ ...planForm, maxInvoices: e.target.value })}
                      placeholder="Unlimited if blank"
                    />
                    <Input
                      label="Medicine Limit (optional)"
                      type="number"
                      min="0"
                      value={planForm.maxMedicines}
                      onChange={(e) => setPlanForm({ ...planForm, maxMedicines: e.target.value })}
                      placeholder="Unlimited if blank"
                    />
                    <Input
                      label="Lab Records Limit (optional)"
                      type="number"
                      min="0"
                      value={planForm.maxLabRecords}
                      onChange={(e) => setPlanForm({ ...planForm, maxLabRecords: e.target.value })}
                      placeholder="Unlimited if blank"
                    />
                  </div>
                </section>
              )}

              <div className="border-t border-gray-200 pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPlanModal(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Pharmacy Profile Modal */}
      {showPharmacyModal && selectedPharmacy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-4xl w-full max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedPharmacy.pharmacyName}</h2>
                <p className="text-sm text-gray-500">
                  {selectedPharmacy.ownerName ? `Owner: ${selectedPharmacy.ownerName}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPharmacyModal(false)
                  setSelectedPharmacy(null)
                  setPharmacyProfile(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderPharmacyProfile()}
          </Card>
        </div>
      )}
    </div>
  )
}
