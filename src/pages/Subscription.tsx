import React, { useState, useEffect } from 'react'
import { Check, Crown, Zap, Building2, AlertCircle, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'

interface Plan {
  _id: string
  id: string
  name: string
  duration_days: number
  duration: string
  price: number
  discount: number
  finalPrice: number
  description: string
  features: string[]
}

interface CurrentSubscription {
  hasSubscription: boolean
  plan?: {
    plan: string
    startDate?: string
    endDate?: string
    status: string
  }
  planDetails?: Plan
  daysRemaining?: number
  status?: string
  isTrial?: boolean
  isExpired?: boolean
  trial?: {
    start?: string
    end?: string
    daysRemaining?: number
    isExpired?: boolean
  }
}

const getPlanIcon = (planName: string) => {
  const name = planName.toLowerCase()
  if (name.includes('lifetime')) return Crown
  if (name.includes('yearly') || name.includes('annual')) return Crown
  if (name.includes('6-month') || name.includes('semiannual')) return Crown
  if (name.includes('3-month') || name.includes('quarterly')) return Building2
  return Zap
}

export const Subscription: React.FC = () => {
  const { user } = useUser()
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paymentData, setPaymentData] = useState({
    method: 'EVC Plus',
    sender_number: '',
    amount: 0,
    proof_url: '',
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  
  // Payment method details
  const paymentMethods = {
    'EVC Plus': {
      number: '+252613606978',
      label: 'EVC Plus',
    },
    'EDAHAB': {
      number: '+252623609678',
      label: 'EDAHAB',
    },
    'Other': {
      number: '',
      label: 'Other (Contact Support)',
    },
  }

  const supportContact = {
    whatsapp: '252613609678',
    phone: '+252613609678',
  }

  // Fetch plans and current subscription
  const loadData = async () => {
    try {
      setLoading(true)
      
      // Fetch plans separately with better error handling
      let plansData: Plan[] = []
      try {
        plansData = (await api.getAvailablePlans()) as Plan[]
        console.log('📦 Plans fetched:', plansData)
      } catch (planError: any) {
        console.error('❌ Error fetching plans:', planError)
        // Don't show alert for 404, just log it
        if (!planError.message?.includes('404') && !planError.message?.includes('Route not found')) {
          console.warn('Failed to load plans:', planError.message)
        }
      }
      
      // Fetch subscription data
      let subscriptionData: CurrentSubscription = { hasSubscription: false }
      try {
        subscriptionData = (await api.getCurrentSubscription()) as CurrentSubscription
      } catch (subError: any) {
        console.log('No subscription found (this is normal for new users)')
      }
      
      // Add icons to plans
      const plansWithIcons = plansData.map((plan: Plan) => ({
        ...plan,
        icon: getPlanIcon(plan.name),
      }))
      
      console.log('✅ Setting plans:', plansWithIcons.length, 'plans')
      setPlans(plansWithIcons)
      setCurrentSubscription(subscriptionData as CurrentSubscription)
    } catch (error: any) {
      console.error('❌ Error loading subscription data:', error)
      // Only show alert for unexpected errors
      if (!error.message?.includes('404')) {
        console.error('Error details:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    
    // Refresh plans every 30 seconds to get new plans created by admin
    const interval = setInterval(() => {
      loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleSelectPlan = (planId: string) => {
    const plan = plans.find(p => p._id === planId || p.id === planId)
    if (plan) {
      setSelectedPlan(planId)
      setShowPaymentModal(true)
      setPaymentData(prev => ({
        ...prev,
        amount: plan.finalPrice,
        sender_number: '', // Reset sender number
      }))
      setSubmissionSuccess(false)
    }
  }

  const handleRequestPlan = async () => {
    if (!selectedPlan) return

    const plan = plans.find(p => p._id === selectedPlan || p.id === selectedPlan)
    if (!plan) return

    if (!paymentData.method || !paymentData.amount) {
      alert('Please fill in payment method and amount')
      return
    }

    try {
      setSubmitting(true)
      await api.requestPlanChange(selectedPlan, {
        method: paymentData.method,
        sender_number: paymentData.sender_number,
        amount: paymentData.amount,
        proof_url: paymentData.proof_url,
      })
      
      setSubmissionSuccess(true)
      // Refresh subscription data after a delay
      setTimeout(() => {
        loadData()
      }, 2000)
    } catch (error: any) {
      console.error('Error requesting plan:', error)
      alert(`Error: ${error.message || 'Failed to submit request'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Show loading only on initial load
  if (loading && plans.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscription & Plans</h1>
          <p className="text-gray-600 mt-2">Manage your subscription and view available plans</p>
        </div>
        <Card>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading subscription information...</p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const isTrial = currentSubscription?.isTrial ?? false
  const trialDaysRemaining = currentSubscription?.trial?.daysRemaining ?? 0
  const effectiveDaysRemaining = isTrial ? trialDaysRemaining : currentSubscription?.daysRemaining ?? 0
  const isExpiringSoon = effectiveDaysRemaining > 0 && effectiveDaysRemaining <= 3
  const isExpired = currentSubscription?.isExpired || effectiveDaysRemaining <= 0
  const currentPlanId = isTrial ? 'trial' : currentSubscription?.planDetails?._id || currentSubscription?.plan?.plan
  const trialInfo = currentSubscription?.trial
  const planInfo = currentSubscription?.plan

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Subscription & Plans</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and view available plans</p>
      </div>

      {/* Expiry Reminder Banner */}
      {isExpired && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">
                ❌ {isTrial ? 'Your free trial has expired. Please upgrade to continue.' : 'Your plan has expired. Please renew to continue.'}
              </h3>
              <p className="text-red-700 mb-4">
                Your access has been limited. Select a plan below to restore full access to the pharmacy dashboard.
              </p>
              <Button variant="primary" onClick={() => window.scrollTo({ top: document.getElementById('plans-section')?.offsetTop || 0, behavior: 'smooth' })}>
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {isExpiringSoon && !isExpired && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900 mb-2">
                ⚠️ Your free trial expires in {currentSubscription?.daysRemaining} {currentSubscription?.daysRemaining === 1 ? 'day' : 'days'}.
              </h3>
              <p className="text-orange-700 mb-4">
                Upgrade now to continue using all features without interruption.
              </p>
              <Button variant="primary" onClick={() => window.scrollTo({ top: document.getElementById('plans-section')?.offsetTop || 0, behavior: 'smooth' })}>
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan */}
      {isTrial ? (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Free Trial</h2>
            <span
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                isExpired ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {isExpired ? 'Expired' : `Active (${effectiveDaysRemaining} days left)`}
            </span>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
            <p className="text-base text-yellow-800 mb-2">
              Every new pharmacy receives 30 days of full access. Upgrade any time to keep your data safe and features unlocked.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-yellow-700 mb-1">Trial Start</p>
                <p className="font-medium text-gray-900">
                  {trialInfo?.start
                    ? formatDate(trialInfo.start)
                    : 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-sm text-yellow-700 mb-1">Trial End</p>
                <p className="font-medium text-gray-900">
                  {trialInfo?.end
                    ? formatDate(trialInfo.end)
                    : 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-sm text-yellow-700 mb-1">Days Remaining</p>
                <div className="flex items-center space-x-2">
                  <p className="font-medium text-gray-900">
                    {effectiveDaysRemaining} day{effectiveDaysRemaining === 1 ? '' : 's'}
                  </p>
                  {isExpiringSoon && (
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : currentSubscription?.hasSubscription && currentSubscription.plan ? (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Current Subscription</h2>
            <span
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                currentSubscription.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {currentSubscription.status || 'Active'}
            </span>
          </div>

          {currentSubscription.planDetails && (
            <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl p-6 border-2 border-primary-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary-500 rounded-xl">
                    {React.createElement(getPlanIcon(currentSubscription.planDetails.name), {
                      className: 'w-6 h-6 text-white',
                    })}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{currentSubscription.planDetails.name}</h3>
                    <p className="text-gray-600">
                      ${currentSubscription.planDetails.finalPrice} / {currentSubscription.planDetails.duration}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Start Date</p>
                  <p className="font-medium text-gray-900">
                    {planInfo?.startDate ? formatDate(planInfo.startDate) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">End Date</p>
                  <p className="font-medium text-gray-900">
                    {planInfo?.endDate ? formatDate(planInfo.endDate) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Days Remaining</p>
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-gray-900">
                      {currentSubscription.daysRemaining || 0} days
                    </p>
                    {(currentSubscription.daysRemaining || 0) <= 7 && (
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Subscription</h3>
            <p className="text-gray-600">Select a plan below to get started</p>
          </div>
        </Card>
      )}

      {/* Available Plans */}
      <Card id="plans-section">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Available Plans</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              loadData()
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Refreshing...
              </>
            ) : (
              '🔄 Refresh Plans'
            )}
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading available plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
            <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-yellow-900 mb-2">No Plans Available</h3>
            <p className="text-yellow-700 mb-4">
              There are currently no active subscription plans available.
            </p>
            <p className="text-sm text-yellow-600">
              Please contact the administrator or check back later.
            </p>
          </div>
        ) : (
                      <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {plans.length} available {plans.length === 1 ? 'plan' : 'plans'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan) => {
                const Icon = getPlanIcon(plan.name)
                const isCurrentPlan = plan._id === currentPlanId
                const isSelected = selectedPlan === plan._id

                return (
                  <div
                    key={plan._id}
                    className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                      isCurrentPlan
                        ? 'border-primary-500 bg-primary-50'
                        : isSelected
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300 hover:shadow-lg'
                    }`}
                    onClick={() => handleSelectPlan(plan._id)}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Current
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div
                          className={`p-2 rounded-xl ${
                            isCurrentPlan ? 'bg-primary-500' : 'bg-primary-100'
                          }`}
                        >
                          <Icon
                            className={`w-6 h-6 ${
                              isCurrentPlan ? 'text-white' : 'text-primary-600'
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                          <p className="text-sm text-gray-600">{plan.duration}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        {plan.discount > 0 && (
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg text-gray-500 line-through">
                              ${plan.price.toFixed(2)}
                            </span>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                              {plan.discount}% OFF
                            </span>
                          </div>
                        )}
                        <span className="text-3xl font-bold text-gray-900">
                          ${plan.finalPrice.toFixed(2)}
                        </span>
                        {plan.duration !== 'Lifetime' && (
                          <span className="text-gray-600"> / {plan.duration}</span>
                        )}
                      </div>
                    </div>

                    {plan.description && (
                      <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                    )}

                    <ul className="space-y-2 mb-6">
                      {plan.features?.map((feature, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={isCurrentPlan ? 'secondary' : isSelected ? 'primary' : 'outline'}
                      className="w-full"
                      disabled={isCurrentPlan}
                    >
                      {isCurrentPlan ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Payment Request Modal */}
            {showPaymentModal && selectedPlan && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                        💳
                      </span>
                      Payment Request
                    </h3>
                    <button
                      onClick={() => {
                        setShowPaymentModal(false)
                        setSelectedPlan(null)
                        setSubmissionSuccess(false)
                      }}
                      className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                      aria-label="Close payment modal"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="overflow-y-auto px-6 py-6 space-y-6">
                    {!submissionSuccess ? (
                      <>
                        {/* Plan summary */}
                        <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 space-y-4">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-gray-500">Selected Plan</p>
                              <p className="text-xl font-semibold text-gray-900">
                                {plans.find((p) => p._id === selectedPlan)?.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {plans.find((p) => p._id === selectedPlan)?.duration}
                              </p>
                            </div>
                            <div className="flex items-end gap-2">
                              <span className="text-3xl font-bold text-gray-900">
                                ${plans.find((p) => p._id === selectedPlan)?.finalPrice.toFixed(2)}
                              </span>
                              <span className="text-sm text-gray-500 mb-1">Total</span>
                            </div>
                          </div>

                          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Pharmacy Details</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Pharmacy Name</p>
                                <p className="text-sm font-medium text-gray-900">{user?.pharmacyName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                                <p className="text-sm font-medium text-gray-900">{user?.phone || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-5">
                          {/* Payment Method */}
                          <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              Payment Method <span className="text-red-500">*</span>
                            </label>
                            <select
                              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-400 transition"
                              value={paymentData.method}
                              onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                            >
                              <option value="EVC Plus">EVC Plus</option>
                              <option value="EDAHAB">EDAHAB</option>
                              <option value="Mobile Money">Mobile Money</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cash">Cash</option>
                              <option value="Other">Other</option>
                            </select>

                            {paymentData.method !== 'Other' && paymentMethods[paymentData.method as keyof typeof paymentMethods] && (
                              <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700 shadow-sm">
                                <p className="font-semibold flex items-center gap-2">
                                  📞 Send payment to:
                                  <span className="font-bold text-primary-800">
                                    {paymentMethods[paymentData.method as keyof typeof paymentMethods].number}
                                  </span>
                                </p>
                                <p className="text-xs text-primary-600 mt-1">
                                  Please send exactly ${plans.find((p) => p._id === selectedPlan)?.finalPrice.toFixed(2)} to this number.
                                </p>
                              </div>
                            )}

                            {paymentData.method === 'Other' && (
                              <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 shadow-sm">
                                For other payment methods, please contact support via WhatsApp or phone after submitting this request.
                              </div>
                            )}
                          </div>

                          {/* Additional Details */}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Your Sender Number <span className="text-gray-400 text-xs">(Optional)</span>
                              </label>
                              <Input
                                type="text"
                                placeholder="e.g. +252612345678"
                                value={paymentData.sender_number}
                                onChange={(e) => setPaymentData({ ...paymentData, sender_number: e.target.value })}
                              />
                              <p className="text-xs text-gray-500">Number you used to send payment</p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Amount ($) <span className="text-red-500">*</span>
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={paymentData.amount || ''}
                                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                              />
                              <p className="text-xs text-gray-500">
                                Expected: ${plans.find((p) => p._id === selectedPlan)?.finalPrice.toFixed(2) || '0.00'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              Payment Proof URL <span className="text-gray-400 text-xs">(Optional)</span>
                            </label>
                            <Input
                              type="url"
                              placeholder="https://your-uploaded-receipt.com"
                              value={paymentData.proof_url}
                              onChange={(e) => setPaymentData({ ...paymentData, proof_url: e.target.value })}
                            />
                            <p className="text-xs text-gray-500">
                              Upload payment receipt to cloud storage and paste the link here (Google Drive, Dropbox, etc.)
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5 border-t border-gray-100">
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-xs font-semibold">
                              i
                            </span>
                            Your request will be reviewed by admin before activation.
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              variant="outline"
                              className="rounded-xl px-6 py-2.5"
                              onClick={() => {
                                setShowPaymentModal(false)
                                setSelectedPlan(null)
                                setPaymentData({
                                  method: 'EVC Plus',
                                  sender_number: '',
                                  amount: 0,
                                  proof_url: '',
                                })
                                setSubmissionSuccess(false)
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              className="rounded-xl px-6 py-2.5"
                              onClick={handleRequestPlan}
                              disabled={submitting || !paymentData.method || !paymentData.amount}
                            >
                              {submitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Submitting...
                                </>
                              ) : (
                                'Submit Payment Request'
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 space-y-6 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold text-gray-900">Payment Request Submitted</h3>
                          <p className="text-gray-600 max-w-lg mx-auto">
                            Your payment request has been submitted successfully. Please wait for admin approval. We'll notify you once it's reviewed.
                          </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 space-y-4 max-w-xl mx-auto">
                          <p className="text-sm font-medium text-blue-900">Need help? Contact us directly:</p>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <a
                              href={`https://wa.me/${supportContact.whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-600 transition"
                            >
                              WhatsApp
                            </a>
                            <a
                              href={`tel:${supportContact.phone}`}
                              className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-600 transition"
                            >
                              Call
                            </a>
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          className="rounded-xl px-6 py-2.5"
                          onClick={() => {
                            setShowPaymentModal(false)
                            setSelectedPlan(null)
                            setSubmissionSuccess(false)
                            setPaymentData({
                              method: 'EVC Plus',
                              sender_number: '',
                              amount: 0,
                              proof_url: '',
                            })
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

