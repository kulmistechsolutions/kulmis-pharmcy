import React from 'react'
import { Crown, Calendar, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

interface SubscriptionCardProps {
  plan?: string
  daysRemaining?: number
  endDate?: string
  status?: string
  planName?: string
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  plan,
  daysRemaining = 0,
  endDate,
  status = 'active',
  planName,
}) => {
  const navigate = useNavigate()
  const isExpired = status === 'expired' || daysRemaining <= 0
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isExpired) {
    return (
      <Card className="bg-red-50 border-2 border-red-200">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">
                ❌ Subscription Expired
              </h3>
              <p className="text-red-700 mb-4">
                Your subscription has expired. Please upgrade to continue using the pharmacy management system.
              </p>
              <Button
                variant="primary"
                onClick={() => navigate('/dashboard/subscription')}
                className="bg-red-600 hover:bg-red-700"
              >
                Upgrade Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`${isExpiringSoon ? 'bg-orange-50 border-2 border-orange-200' : 'bg-gradient-to-r from-primary-50 to-blue-50 border-2 border-primary-200'}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-primary-500 rounded-xl">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                💎 Current Plan: {planName || plan || 'Free Trial'}
              </h3>
              {isExpiringSoon && (
                <p className="text-sm text-orange-700 font-medium mt-1">
                  ⚠️ Expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                </p>
              )}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
            status === 'active' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {status === 'active' ? 'Active' : status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Days Remaining</p>
              <p className="text-lg font-bold text-gray-900">{daysRemaining} days</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Ends On</p>
              <p className="text-lg font-bold text-gray-900">{formatDate(endDate)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard/subscription')}
          >
            🔁 Renew / Upgrade
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </Card>
  )
}






