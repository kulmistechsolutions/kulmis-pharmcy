import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import type { LabCashierRecord, LabInvoice, LabStatus, SampleType, LabAnalyticsSummary } from '@/types/labCashier'
import { Download, FileText, Loader2, Plus, Trash2, RefreshCw } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = (value: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const SAMPLE_TYPES: SampleType[] = ['Blood', 'Urine', 'Stool', 'Swab', 'Other']
const STATUS_OPTIONS: LabStatus[] = ['process', 'pending', 'complete']

const statusLabels: Record<LabStatus, string> = {
  process: 'Process',
  pending: 'Pending',
  complete: 'Complete',
}

const statusStyles: Record<LabStatus, string> = {
  process: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-gray-100 text-gray-700',
  complete: 'bg-green-100 text-green-700',
}

interface FormState {
  patient_name: string
  phone: string
  age: string
  diseases: string[]
  sample_type: SampleType
  sample_notes: string
  price: string
  status: LabStatus
}

const defaultForm: FormState = {
  patient_name: '',
  phone: '',
  age: '',
  diseases: [],
  sample_type: 'Blood',
  sample_notes: '',
  price: '',
  status: 'process',
}

export const LabCashier: React.FC = () => {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<LabCashierRecord[]>([])
  const [diseaseOptions, setDiseaseOptions] = useState<string[]>([])
  const [diseaseQuery, setDiseaseQuery] = useState('')
  const [analytics, setAnalytics] = useState<LabAnalyticsSummary | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<LabInvoice | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [trendDays, setTrendDays] = useState(7)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LabStatus>('all')
  const [isInvoiceLoading, setIsInvoiceLoading] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement | null>(null)

  const handleInvoiceDownload = () => {
    window.print()
  }

  useEffect(() => {
    loadDiseases()
    loadRecords()
    loadAnalytics()
  }, [])

  const loadDiseases = async () => {
    try {
      const results = await api.getLabDiseases()
      setDiseaseOptions(Array.isArray(results) ? results : [])
    } catch (error: any) {
      console.error('Failed to load diseases', error)
    }
  }

  const loadRecords = async () => {
    try {
      setRecordsLoading(true)
      const data = await api.getLabCashierRecords()
      const list = Array.isArray(data) ? data : data?.results ?? []
      setRecords(list as LabCashierRecord[])
    } catch (error: any) {
      console.error('Failed to load lab records', error)
      alert(error.message || 'Failed to load lab cashier records')
    } finally {
      setRecordsLoading(false)
    }
  }

  const loadAnalytics = async (days = trendDays) => {
    try {
      setAnalyticsLoading(true)
      const summary = (await api.getLabCashierAnalytics(days)) as LabAnalyticsSummary
      setAnalytics(summary)
      setTrendDays(days)
    } catch (error: any) {
      console.error('Failed to load lab analytics', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleAddDisease = (disease: string) => {
    const trimmed = disease.trim()
    if (!trimmed) return
    if (form.diseases.includes(trimmed)) return
    setForm((prev) => ({ ...prev, diseases: [...prev.diseases, trimmed] }))
    setDiseaseQuery('')
  }

  const handleRemoveDisease = (disease: string) => {
    setForm((prev) => ({
      ...prev,
      diseases: prev.diseases.filter((item) => item !== disease),
    }))
  }

  const filteredDiseaseOptions = useMemo(() => {
    const query = diseaseQuery.trim().toLowerCase()
    return diseaseOptions
      .filter((disease) =>
        !form.diseases.includes(disease) &&
        (!query || disease.toLowerCase().includes(query))
      )
      .slice(0, 8)
  }, [diseaseOptions, diseaseQuery, form.diseases])

  const resetForm = () => {
    setForm(defaultForm)
    setDiseaseQuery('')
  }

  const submitRecord = async (status: LabStatus) => {
    if (!form.patient_name.trim()) {
      alert('Patient name is required')
      return
    }
    if (!form.diseases.length) {
      alert('Select at least one disease')
      return
    }
    if (!form.price || Number.parseFloat(form.price) < 0) {
      alert('Enter a valid price')
      return
    }

    const payload = {
      patient_name: form.patient_name.trim(),
      phone: form.phone.trim() || undefined,
      age: form.age ? Number.parseInt(form.age, 10) : undefined,
      diseases: form.diseases,
      sample_type: form.sample_type,
      sample_notes: form.sample_notes.trim() || undefined,
      price: Number.parseFloat(form.price),
      status,
    }

    try {
      setLoading(true)
      const response: any = await api.createLabCashierRecord(payload)
      if (response?.queued) {
        alert('You are offline. Lab record saved locally and will sync once you reconnect.')
      } else {
        const { record, invoice } = response
        if (record) {
          setRecords((prev) => [record, ...prev])
        }
        if (invoice) {
          setSelectedInvoice(invoice)
        }
      }
      resetForm()
      loadAnalytics()
    } catch (error: any) {
      console.error('Failed to save record', error)
      alert(error.message || 'Failed to save record')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (record: LabCashierRecord, status: LabStatus) => {
    try {
      const response: any = await api.updateLabCashierRecord(record._id, { status })
      const updated: LabCashierRecord = response.record
      setRecords((prev) => prev.map((item) => (item._id === updated._id ? { ...item, ...updated, invoice: response.invoice } : item)))
      loadAnalytics()
    } catch (error: any) {
      console.error('Failed to update status', error)
      alert(error.message || 'Failed to update record status')
    }
  }

  const handleDelete = async (record: LabCashierRecord) => {
    if (!confirm('Delete this record?')) return
    try {
      await api.deleteLabCashierRecord(record._id)
      setRecords((prev) => prev.filter((item) => item._id !== record._id))
      loadAnalytics()
    } catch (error: any) {
      console.error('Failed to delete record', error)
      alert(error.message || 'Failed to delete record')
    }
  }

  const handleInvoiceView = async (record: LabCashierRecord) => {
    if (record.invoice) {
      setSelectedInvoice(record.invoice)
      return
    }

    try {
      setIsInvoiceLoading(true)
      const detail = await api.getLabCashierRecord(record._id)
      if (detail?.invoice) {
        setSelectedInvoice(detail.invoice)
      } else {
        alert('Invoice not available for this record yet.')
      }
    } catch (error: any) {
      console.error('Failed to load invoice', error)
      alert(error.message || 'Failed to load invoice')
    } finally {
      setIsInvoiceLoading(false)
    }
  }

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false
      }
      if (!searchTerm.trim()) {
        return true
      }
      const query = searchTerm.toLowerCase()
      return (
        record.patient_name.toLowerCase().includes(query) ||
        (record.phone && record.phone.toLowerCase().includes(query)) ||
        record.diseases.some((d) => d.toLowerCase().includes(query))
      )
    })
  }, [records, searchTerm, statusFilter])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Lab Cashier</h1>
        <p className="text-gray-600">Record payments for laboratory services and issue invoices instantly.</p>
      </div>

      <Card>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
            <Button variant="outline" onClick={resetForm} type="button">
              <Plus className="w-4 h-4 mr-2" />
              New Entry
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Patient Name"
              value={form.patient_name}
              onChange={(e) => setForm((prev) => ({ ...prev, patient_name: e.target.value }))}
              required
            />
            <Input
              label="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              type="tel"
              placeholder="e.g., +2526..."
            />
            <Input
              label="Age (optional)"
              value={form.age}
              onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
              type="number"
              min={0}
            />
            <Input
              label="Test Price ($)"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              type="number"
              min={0}
              step="0.01"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Diseases / Symptoms *</label>
            <div className="rounded-xl border border-gray-300 p-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {form.diseases.map((disease) => (
                  <span
                    key={disease}
                    className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-600"
                  >
                    {disease}
                    <button
                      type="button"
                      className="ml-2 text-primary-500 hover:text-primary-700"
                      onClick={() => handleRemoveDisease(disease)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={diseaseQuery}
                  onChange={(e) => setDiseaseQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddDisease(diseaseQuery || '')
                    }
                  }}
                  placeholder="Type to search disease..."
                  className="flex-1 min-w-[140px] border-none focus:ring-0 text-sm text-gray-700"
                />
              </div>
              {diseaseQuery && filteredDiseaseOptions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-sm"
                >
                  {filteredDiseaseOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAddDisease(option)}
                      className="w-full rounded-md px-3 py-2 text-left text-gray-700 hover:bg-primary-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
              {!diseaseQuery && (
                <p className="text-xs text-gray-500">
                  Suggested: {diseaseOptions.slice(0, 6).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sample Type *</label>
              <select
                value={form.sample_type}
                onChange={(e) => setForm((prev) => ({ ...prev, sample_type: e.target.value as SampleType }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                {SAMPLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Sample Notes (optional)"
              value={form.sample_notes}
              onChange={(e) => setForm((prev) => ({ ...prev, sample_notes: e.target.value }))}
              placeholder="e.g., collected at 10:30 AM"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                type="button"
                onClick={() => submitRecord(status)}
                disabled={loading}
                className={status === 'complete' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {loading && form.status === status ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {statusLabels[status]}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Recent Payments</h2>
              <p className="text-sm text-gray-500">Track all recorded laboratory payments</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative">
                <Input
                  placeholder="Search patient, phone, disease"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | LabStatus)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {recordsLoading ? (
              <div className="py-12 text-center text-gray-600">Loading records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-gray-600">No records found.</div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-600">
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Diseases</th>
                    <th className="px-4 py-3">Sample</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700">
                  {filteredRecords.map((record) => (
                    <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{record.patient_name}</div>
                        {record.phone && <div className="text-xs text-gray-500">{record.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {record.diseases.map((disease) => (
                            <span key={disease} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs text-primary-600">
                              {disease}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{record.sample_type}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(record.price)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(record.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[record.status]}`}>
                          {statusLabels[record.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {record.status !== 'complete' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusUpdate(record, 'complete')}
                            >
                              Mark Complete
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInvoiceView(record)}
                              disabled={isInvoiceLoading}
                            >
                              <FileText className="mr-2 h-4 w-4" /> Invoice
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Quick Stats</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAnalytics(trendDays)}
              disabled={analyticsLoading}
            >
              {analyticsLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          {analyticsLoading ? (
            <div className="py-12 text-center text-gray-500">Loading summary...</div>
          ) : !analytics ? (
            <div className="py-12 text-center text-gray-500">No summary available.</div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="rounded-xl bg-primary-50 p-4">
                <p className="text-sm text-primary-600">Today&apos;s Cash</p>
                <p className="text-2xl font-bold text-primary-700">{formatCurrency(analytics.totalCashToday)}</p>
              </div>
              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-sm text-green-700">Patients Served</p>
                <p className="text-2xl font-bold text-green-700">{analytics.patientsToday}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Top Diseases</h3>
                <div className="mt-3 space-y-2">
                  {analytics.topDiseases.length === 0 ? (
                    <p className="text-sm text-gray-500">No data yet.</p>
                  ) : (
                    analytics.topDiseases.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span>{item.name}</span>
                        <span className="font-semibold text-gray-900">{item.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Income Trend</h2>
            <p className="text-sm text-gray-500">Track cash collected over time</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Range</span>
            <select
              value={trendDays}
              onChange={(e) => loadAnalytics(Number.parseInt(e.target.value, 10))}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
        </div>

        <div className="mt-6 h-72">
          {analyticsLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Loading trend...
            </div>
          ) : analytics && analytics.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="total" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Not enough data yet.
            </div>
          )}
        </div>
      </Card>

      {selectedInvoice && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedInvoice(null)
            }
          }}
        >
          <Card className="w-full max-w-lg">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Lab Invoice</h3>
                <p className="text-sm text-gray-500">Invoice #{selectedInvoice.invoice_number}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Patient</span>
                <span className="text-gray-900">{selectedInvoice.patient_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Diseases</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedInvoice.diseases.map((disease) => (
                    <span key={disease} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs text-primary-600">
                      {disease}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Sample Type</span>
                <span className="text-gray-900">{selectedInvoice.sample_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Amount</span>
                <span className="text-gray-900">{formatCurrency(selectedInvoice.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Status</span>
                <span className="text-green-600 font-semibold">Paid</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Date</span>
                <span className="text-gray-900">{formatDate(selectedInvoice.created_at)}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <span className="text-xs text-gray-500">Kulmis Pharmacy & Lab Cashier</span>
              <Button variant="outline" size="sm" onClick={handleInvoiceDownload}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
