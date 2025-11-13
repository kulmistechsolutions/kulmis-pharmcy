import React, { useState, useEffect, useMemo } from 'react'
import { Plus, CheckCircle, Clock, AlertCircle, X, DollarSign, AlertTriangle, MessageCircle, Send, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { getQueuedRecords } from '@/lib/offlineQueue'
import type { OfflineRecord } from '@/lib/indexedDb'

export const Debts: React.FC = () => {
  const [debts, setDebts] = useState<any[]>([])
  const [pendingDebts, setPendingDebts] = useState<OfflineRecord[]>([])
  const [pendingPayments, setPendingPayments] = useState<OfflineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<any>(null)
  const [reminderDebt, setReminderDebt] = useState<any | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [pharmacySettings, setPharmacySettings] = useState<any | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    balance: '',
    due_date: '',
    description: '',
  })

  useEffect(() => {
    loadDebts()
  }, [])

  const loadDebts = async () => {
    try {
      setLoading(true)
      const data = await api.getDebts()
      const list = Array.isArray(data) ? data : data?.results ?? []
      setDebts(list as any[])
      const queuedDebts = await getQueuedRecords('debts')
      setPendingDebts(queuedDebts)
      const queuedPayments = await getQueuedRecords('payments')
      setPendingPayments(queuedPayments)
    } catch (error: any) {
      console.error('Error loading debts:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.customer_name.trim()) {
      alert('Customer name is required')
      return
    }
    if (!formData.phone.trim()) {
      alert('Phone number is required')
      return
    }
    if (!formData.balance || parseFloat(formData.balance) <= 0) {
      alert('Balance must be greater than 0')
      return
    }
    if (!formData.due_date) {
      alert('Due date is required')
      return
    }
    
    try {
      const response: any = await api.createDebt({
        debtor_name: formData.customer_name,
        phone: formData.phone,
        balance: parseFloat(formData.balance),
        due_date: formData.due_date,
        description: formData.description || undefined,
      })
      if (response?.queued) {
        alert('You are offline. Debt saved locally and will sync when you reconnect.')
      }
      setShowAddModal(false)
      setFormData({ customer_name: '', phone: '', balance: '', due_date: '', description: '' })
      await loadDebts()
    } catch (error: any) {
      console.error('Debt creation error:', error)
      let errorMessage = 'Failed to create debt'
      if (error.message) {
        errorMessage = error.message
      } else if (error.errors && Array.isArray(error.errors)) {
        errorMessage = error.errors.map((e: any) => e.msg || e.message).join(', ')
      }
      alert(`Error: ${errorMessage}`)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDebt) return
    
    try {
      const response: any = await api.recordPayment(selectedDebt._id, parseFloat(paymentAmount))
      if (response?.queued) {
        alert('You are offline. Payment recorded locally and will sync on reconnect.')
      }
      setShowPaymentModal(false)
      setPaymentAmount('')
      setSelectedDebt(null)
      await loadDebts()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const getStatus = (debt: any) => {
    const balance = debt.balance - debt.paid
    if (balance <= 0) return 'Paid'
    const dueDate = new Date(debt.due_date)
    const now = new Date()
    if (dueDate < now) return 'Overdue'
    if (debt.paid > 0) return 'Partial'
    return 'Pending'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'Partial': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'Overdue': return <AlertCircle className="w-4 h-4 text-red-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700'
      case 'Partial': return 'bg-yellow-100 text-yellow-700'
      case 'Overdue': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const calculateBalance = (debt: any) => {
    const balance = Number(debt.balance || 0) - Number(debt.paid || 0)
    return Number.isFinite(balance) ? Math.max(balance, 0) : 0
  }

  const formatDateForDisplay = (value: string) => {
    try {
      return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return value
    }
  }

  const normalizePhoneForWhatsApp = (value: string) => {
    if (!value) return ''
    return value.replace(/\D/g, '')
  }

  const ensurePharmacySettings = async () => {
    if (pharmacySettings) return pharmacySettings
    try {
      const settings = await api.getPharmacySettings()
      setPharmacySettings(settings)
      return settings
    } catch (error) {
      console.error('Failed to load pharmacy settings for reminders', error)
      return null
    }
  }

  const buildReminderMessage = (debt: any, settings: any, channel: 'whatsapp' | 'sms') => {
    const pharmacyName = settings?.name || 'Kulmis Pharmacy'
    const paymentNumber = settings?.phone || debt.phone || ''
    const amountDue = `$${calculateBalance(debt).toFixed(2)}`
    const dueDate = formatDateForDisplay(debt.due_date)
    const customerName = debt.debtor_name || 'Valued Customer'

    if (channel === 'sms') {
      return `${pharmacyName}: You have ${amountDue} due on ${dueDate}. Pay to ${paymentNumber}. Thank you.`
    }

    return `Hello ${customerName} 👋,\n\nThis is ${pharmacyName} 🏥.\n\nWe’re reminding you about your pending balance of ${amountDue}, due on ${dueDate}.\n\nPlease make your payment to:\n📞 ${paymentNumber}\n\nThank you for your cooperation 💚.`
  }

  const markReminder = async (method: 'whatsapp' | 'sms', message: string, phoneOverride?: string) => {
    if (!reminderDebt) return null
    const payload: { method: 'whatsapp' | 'sms'; message: string; phone?: string } = {
      method,
      message,
    }
    if (method === 'sms' && phoneOverride) {
      payload.phone = phoneOverride
    }
    const updatedDebt = (await api.sendDebtReminder(reminderDebt._id, payload)) as any
    setDebts((prev) =>
      prev.map((debt) => (debt._id === updatedDebt._id ? updatedDebt : debt))
    )
    setReminderDebt(updatedDebt)
    return updatedDebt
  }

  const handleOpenReminderModal = async (debt: any) => {
    setReminderDebt(debt)
    setShowReminderModal(true)
    if (!pharmacySettings) {
      await ensurePharmacySettings()
    }
  }

  const handleCloseReminderModal = () => {
    setReminderDebt(null)
    setShowReminderModal(false)
    setSendingReminder(false)
  }

  const handleSendWhatsApp = async () => {
    if (!reminderDebt) return
    const settings = await ensurePharmacySettings()
    const phone = normalizePhoneForWhatsApp(reminderDebt.phone)
    if (!phone) {
      alert('Customer phone number is missing or invalid for WhatsApp.')
      return
    }
    const message = buildReminderMessage(reminderDebt, settings, 'whatsapp')
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    try {
      await markReminder('whatsapp', message)
    } catch (error: any) {
      console.error('Failed to record WhatsApp reminder:', error)
    }
    handleCloseReminderModal()
  }

  const handleSendSMS = async () => {
    if (!reminderDebt) return
    const settings = await ensurePharmacySettings()
    const message = buildReminderMessage(reminderDebt, settings, 'sms')
    try {
      setSendingReminder(true)
      await markReminder('sms', message, reminderDebt.phone)
      alert('SMS reminder sent successfully.')
      handleCloseReminderModal()
    } catch (error: any) {
      console.error('Failed to send SMS reminder:', error)
      alert(error.message || 'Failed to send SMS reminder.')
    } finally {
      setSendingReminder(false)
    }
  }

  const reminderWhatsAppPreview = reminderDebt
    ? buildReminderMessage(reminderDebt, pharmacySettings, 'whatsapp')
    : ''
  const reminderSMSPreview = reminderDebt
    ? buildReminderMessage(reminderDebt, pharmacySettings, 'sms')
    : ''

  const totalOutstanding = debts.reduce((sum, d) => sum + calculateBalance(d), 0)
  const pending = debts.filter(d => getStatus(d) === 'Pending').reduce((sum, d) => sum + calculateBalance(d), 0)
  const partial = debts.filter(d => getStatus(d) === 'Partial').reduce((sum, d) => sum + calculateBalance(d), 0)
  const overdue = debts.filter(d => getStatus(d) === 'Overdue').reduce((sum, d) => sum + calculateBalance(d), 0)

  const pendingDebtRows = pendingDebts
    .filter((debt) => debt.method === 'POST')
    .map((debt) => {
      const payload = debt.payload || {}
      return {
        _id: debt.local_id,
        debtor_name: payload.debtor_name || payload.customer_name || 'Pending Customer',
        phone: payload.phone || '',
        balance: payload.balance || 0,
        paid: 0,
        due_date: payload.due_date || new Date(debt.created_at).toISOString(),
        description: payload.description,
        pending: true,
      }
    })

  const combinedDebts = useMemo(() => [...pendingDebtRows, ...debts], [pendingDebtRows, debts])

  const filteredDebts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return combinedDebts

    const digits = term.replace(/[^0-9]/g, '')

    return combinedDebts.filter((debt) => {
      const name = (debt.debtor_name || debt.customer_name || '').toLowerCase()
      const phone = (debt.phone || '').toLowerCase()
      const cleanPhone = (debt.phone || '').replace(/[^0-9]/g, '')
      const balanceStr = `${debt.balance || ''}`
      const idMatch = `${debt._id || debt.local_id || ''}`.toLowerCase()

      return (
        name.includes(term) ||
        phone.includes(term) ||
        (!!digits && cleanPhone.includes(digits)) ||
        balanceStr.includes(term) ||
        idMatch.includes(term)
      )
    })
  }, [combinedDebts, searchTerm])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Debts Management</h1>
          <p className="text-gray-600 mt-2">Track and manage customer debts</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Debt
        </Button>
      </div>

      {(pendingDebts.length > 0 || pendingPayments.length > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-700 mt-1" />
            <div className="space-y-1">
              {pendingDebts.length > 0 && (
                <p className="text-sm text-yellow-800 font-semibold">
                  {pendingDebts.length} debt action{pendingDebts.length === 1 ? '' : 's'} pending sync
                </p>
              )}
              {pendingPayments.length > 0 && (
                <p className="text-sm text-yellow-800 font-semibold">
                  {pendingPayments.length} payment{pendingPayments.length === 1 ? '' : 's'} will sync automatically when online
                </p>
              )}
              <p className="text-xs text-yellow-700">You can continue working; these changes will push once the connection returns.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm text-gray-600 mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-gray-900">${totalOutstanding.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-orange-600">${pending.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 mb-1">Partial</p>
          <p className="text-2xl font-bold text-yellow-600">${partial.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600">${overdue.toFixed(2)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer or phone number"
              className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="self-start text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Clear search
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading debts...</p>
          </div>
        ) : combinedDebts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No debts found</p>
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No debts match your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full align-middle px-5 sm:px-6 lg:px-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Paid</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Balance</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebts.map((debt: any) => {
                    const balance = calculateBalance(debt)
                    const status = debt.pending ? 'Pending Sync' : getStatus(debt)
                    return (
                      <tr key={debt._id || debt.local_id} className={`border-b border-gray-100 hover:bg-gray-50 ${debt.pending ? 'bg-yellow-50' : ''}`}>
                        <td className="py-3 px-4 font-medium">
                          {debt.debtor_name || debt.customer_name}
                          {debt.pending && <span className="ml-2 text-xs text-yellow-700 font-semibold">Pending Sync</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{debt.phone || 'N/A'}</td>
                        <td className="py-3 px-4">${Number(debt.balance || 0).toFixed(2)}</td>
                        <td className="py-3 px-4">${Number(debt.paid || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 font-medium">{balance > 0 ? `$${balance.toFixed(2)}` : '$0.00'}</td>
                        <td className="py-3 px-4 text-gray-600">{formatDateForDisplay(debt.due_date)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${debt.pending ? 'bg-yellow-200 text-yellow-800' : getStatusColor(status)}`}>
                            {debt.pending ? <Clock className="w-3 h-3" /> : getStatusIcon(status)}
                            {status}
                          </span>
                          {!debt.pending && debt.reminder_sent && (
                            <span className="mt-1 block text-[11px] text-blue-600 font-medium">
                              Reminder via {debt.last_reminder_method || 'Message'}
                              {debt.last_reminder_date ? ` · ${formatDateForDisplay(debt.last_reminder_date)}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {!debt.pending && status !== 'Paid' && balance > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedDebt(debt)
                                setPaymentAmount('')
                                setShowPaymentModal(true)
                              }}>
                                <DollarSign className="w-4 h-4 mr-1" />
                                Record Payment
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReminderModal(debt)}
                              >
                                <MessageCircle className="w-4 h-4 mr-1 text-green-600" />
                                Send Message
                              </Button>
                            </div>
                          )}
                          {!debt.pending && (status === 'Paid' || balance <= 0) && (
                            <span className="text-xs text-green-600 font-semibold">Payment complete</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Add Debt Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false)
            }
          }}
        >
          <Card 
            className="w-full max-w-md bg-white relative z-[10000]"
            style={{ position: 'relative', zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Debt</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-4">
              <Input
                label="Customer Name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
              <Input
                label="Amount ($)"
                type="number"
                step="0.01"
                min="0"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                required
              />
              <Input
                label="Due Date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
              <Input
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">Add Debt</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedDebt && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPaymentModal(false)
            }
          }}
        >
          <Card 
            className="w-full max-w-md bg-white relative z-[10000]"
            style={{ position: 'relative', zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600">Customer: {selectedDebt.customer_name}</p>
              <p className="text-sm text-gray-600">Total: ${selectedDebt.balance.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Paid: ${selectedDebt.paid.toFixed(2)}</p>
              <p className="text-sm font-medium text-gray-900">Balance: ${(selectedDebt.balance - selectedDebt.paid).toFixed(2)}</p>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <Input
                label="Payment Amount ($)"
                type="number"
                step="0.01"
                min="0"
                max={selectedDebt.balance - selectedDebt.paid}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">Record Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && reminderDebt && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-[9999] px-3 sm:px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseReminderModal()
            }
          }}
        >
          <Card
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseReminderModal}
              className="absolute right-4 top-4 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 w-9 h-9 flex items-center justify-center shadow-sm"
              aria-label="Close reminder modal"
            >
              ✕
            </button>
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Send Payment Reminder</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Remind {reminderDebt.debtor_name || reminderDebt.customer_name} about their pending balance.
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-2 text-sm text-gray-700">
                <p><span className="font-semibold text-gray-600">Customer:</span> {reminderDebt.debtor_name || reminderDebt.customer_name}</p>
                <p><span className="font-semibold text-gray-600">Amount Due:</span> ${calculateBalance(reminderDebt).toFixed(2)}</p>
                <p><span className="font-semibold text-gray-600">Due Date:</span> {formatDateForDisplay(reminderDebt.due_date)}</p>
                <p><span className="font-semibold text-gray-600">Phone:</span> {reminderDebt.phone || 'N/A'}</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> WhatsApp Message Preview
                  </p>
                  <p className="whitespace-pre-line text-emerald-900 text-xs leading-5">{reminderWhatsAppPreview}</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    <Send className="w-4 h-4" /> SMS Preview
                  </p>
                  <p className="text-xs leading-5">{reminderSMSPreview}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 bg-[#25D366] hover:bg-[#21bf5b] text-white"
                  onClick={handleSendWhatsApp}
                  disabled={sendingReminder}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handleSendSMS}
                  disabled={sendingReminder}
                >
                  {sendingReminder ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      SMS
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
