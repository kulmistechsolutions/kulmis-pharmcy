import React, { useState, useEffect } from 'react'
import { Plus, Filter, X, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { getQueuedRecords } from '@/lib/offlineQueue'
import type { OfflineRecord } from '@/lib/indexedDb'

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([])
  const [pendingExpenses, setPendingExpenses] = useState<OfflineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [formData, setFormData] = useState({
    category: 'Rent',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  })
  const [customCategory, setCustomCategory] = useState('')

  useEffect(() => {
    loadExpenses()
  }, [categoryFilter, startDate, endDate])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      const data = await api.getExpenses(
        categoryFilter || undefined,
        startDate || undefined,
        endDate || undefined
      )
      const list = Array.isArray(data) ? data : data?.results ?? []
      setExpenses(list as any[])
      const pending = await getQueuedRecords('expenses')
      setPendingExpenses(pending)
    } catch (error: any) {
      console.error('Error loading expenses:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Valid amount is required')
      return
    }

    const finalCategory = formData.category === 'Other' ? customCategory : formData.category
    if (!finalCategory || !finalCategory.trim()) {
      alert('Category is required')
      return
    }

    try {
      const response: any = await api.createExpense({
        category: finalCategory.trim(),
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description,
      })
      if (response?.queued) {
        alert('You are offline. Expense saved locally and will sync when you reconnect.')
      }
      setShowAddModal(false)
      setFormData({ category: 'Rent', amount: '', date: new Date().toISOString().split('T')[0], description: '' })
      setCustomCategory('')
      await loadExpenses()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const byCategory = expenses.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0)
    return acc
  }, {})

  const pendingExpenseRows = pendingExpenses
    .filter((expense) => expense.method === 'POST')
    .map((expense) => {
      const payload = expense.payload || {}
      return {
        _id: expense.local_id,
        category: payload.category || 'Pending Category',
        description: payload.description || 'Pending description',
        date: payload.date || new Date(expense.created_at).toISOString(),
        amount: payload.amount || 0,
        pending: true,
      }
    })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-2">Track your business expenses</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {pendingExpenses.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-700 mt-1" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                {pendingExpenses.length} expense change{pendingExpenses.length === 1 ? '' : 's'} waiting to sync
              </p>
              <p className="text-xs text-yellow-700">They will sync automatically when you are back online.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm text-gray-600 mb-1">Total This Month</p>
          <p className="text-2xl font-bold text-gray-900">${totalExpenses.toFixed(2)}</p>
        </Card>
        {Object.entries(byCategory).slice(0, 3).map(([category, amount]: [string, any]) => (
          <Card key={category}>
            <p className="text-sm text-gray-600 mb-1">{category}</p>
            <p className="text-2xl font-bold text-primary-600">${amount.toFixed(2)}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <select
            className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="Rent">Rent</option>
            <option value="Utilities">Utilities</option>
            <option value="Salary">Salary</option>
            <option value="Supplies">Supplies</option>
            <option value="Other">Other</option>
          </select>
          <Input
            type="date"
            placeholder="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            placeholder="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Button variant="outline" onClick={() => { setCategoryFilter(''); setStartDate(''); setEndDate('') }}>
            <Filter className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading expenses...</p>
          </div>
        ) : expenses.length === 0 && pendingExpenseRows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No expenses found</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full align-middle px-5 sm:px-6 lg:px-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pendingExpenseRows, ...expenses].map((expense: any) => (
                    <tr
                      key={expense._id || expense.local_id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${expense.pending ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${expense.pending ? 'bg-yellow-200 text-yellow-800' : 'bg-primary-100 text-primary-700'}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {expense.description || 'N/A'}
                        {expense.pending && (
                          <span className="ml-2 text-xs text-yellow-700 font-medium">Pending Sync</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(expense.date).toLocaleDateString()}
                      </td>
                      <td className={`py-3 px-4 font-bold ${expense.pending ? 'text-yellow-700' : 'text-red-600'}`}>
                        ${Number(expense.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false)
              setCustomCategory('')
            }
          }}
        >
          <Card 
            className="w-full max-w-md bg-white relative z-[10000]"
            style={{ position: 'relative', zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Expense</h2>
              <button 
                onClick={() => {
                  setShowAddModal(false)
                  setCustomCategory('')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    setFormData({ ...formData, category: e.target.value })
                    if (e.target.value !== 'Other') {
                      setCustomCategory('')
                    }
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="Rent">Rent</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Salary">Salary</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Other">Other (Custom)</option>
                </select>
                {formData.category === 'Other' && (
                  <Input
                    label="Custom Category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category"
                    className="mt-2"
                    required={formData.category === 'Other'}
                  />
                )}
              </div>
              <Input
                label="Amount ($)"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
              <Input
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
              <Input
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">Add Expense</Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddModal(false)
                    setCustomCategory('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
