import React, { useState, useEffect, useRef } from 'react'
import { Search, Plus, Edit, Trash2, X, Upload, Download, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { getQueuedRecords } from '@/lib/offlineQueue'
import type { OfflineRecord } from '@/lib/indexedDb'

interface MedicineFormData {
  name: string
  batch: string
  expiry_date: string
  quantity: string
  buying_price: string
  selling_price: string
  category: string
}

export const Medicines: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([])
  const [pendingInventory, setPendingInventory] = useState<OfflineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState<any>(null)
  const [formData, setFormData] = useState<MedicineFormData>({
    name: '',
    batch: '',
    expiry_date: '',
    quantity: '',
    buying_price: '',
    selling_price: '',
    category: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [importSummary, setImportSummary] = useState<{ inserted: number; errors: { line: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadMedicines()
  }, [searchTerm, categoryFilter, stockFilter])

  const loadMedicines = async () => {
    try {
      setLoading(true)
      const data = await api.getMedicines(searchTerm, categoryFilter || undefined, stockFilter || undefined)
      const list = Array.isArray(data) ? data : data?.results ?? []
      setMedicines(list as any[])
      const pending = await getQueuedRecords('inventory')
      setPendingInventory(pending)
    } catch (error: any) {
      console.error('Error loading medicines:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    console.log('Add button clicked')
    setFormData({
      name: '',
      batch: '',
      expiry_date: '',
      quantity: '',
      buying_price: '',
      selling_price: '',
      category: '',
    })
    setErrors({})
    setShowAddModal(true)
    console.log('ShowAddModal set to true')
  }

  const handleEdit = (medicine: any) => {
    setEditingMedicine(medicine)
    setFormData({
      name: medicine.name,
      batch: medicine.batch,
      expiry_date: new Date(medicine.expiry_date).toISOString().split('T')[0],
      quantity: medicine.quantity.toString(),
      buying_price: medicine.buying_price.toString(),
      selling_price: medicine.selling_price.toString(),
      category: medicine.category || '',
    })
    setErrors({})
    setShowEditModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medicine?')) return
    
    try {
      const response: any = await api.deleteMedicine(id)
      if (response?.queued) {
        alert('You are offline. The delete request will sync once you reconnect.')
      }
      await loadMedicines()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleDownloadTemplate = async () => {
    try {
      setTemplateLoading(true)
      const blob = await api.downloadMedicineTemplate()
      downloadFile(blob, 'medicines_template.xlsx')
    } catch (error: any) {
      alert(`Error downloading template: ${error.message}`)
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleExportMedicines = async () => {
    try {
      setExporting(true)
      const blob = await api.exportMedicines()
      downloadFile(blob, `medicines_export_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error: any) {
      alert(`Error exporting medicines: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  const resetImportState = () => {
    setImportFile(null)
    setImportSummary(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImportMedicines = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!importFile) {
      alert('Please select an Excel file to import.')
      return
    }

    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', importFile)

      const response: any = await api.importMedicines(formData)
      setImportSummary(response?.summary || null)
      await loadMedicines()
    } catch (error: any) {
      alert(`Error importing medicines: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.expiry_date) newErrors.expiry_date = 'Expiry date is required'
    if (!formData.quantity || parseInt(formData.quantity) < 0) newErrors.quantity = 'Valid quantity is required'
    if (!formData.buying_price || parseFloat(formData.buying_price) < 0) newErrors.buying_price = 'Valid buying price is required'
    if (!formData.selling_price || parseFloat(formData.selling_price) < 0) newErrors.selling_price = 'Valid selling price is required'
    
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    try {
      const medicineData = {
        name: formData.name,
        batch: formData.batch.trim() || undefined,
        expiry_date: formData.expiry_date,
        quantity: parseInt(formData.quantity),
        buying_price: parseFloat(formData.buying_price),
        selling_price: parseFloat(formData.selling_price),
        category: formData.category || undefined,
      }

      if (showEditModal && editingMedicine) {
        const response: any = await api.updateMedicine(editingMedicine._id, medicineData)
        if (response?.queued) {
          alert('You are offline. Updates will sync automatically when you reconnect.')
        }
      } else {
        const response: any = await api.createMedicine(medicineData)
        if (response?.queued) {
          alert('You are offline. Medicine saved locally and will sync when online.')
        }
      }
      
      setShowAddModal(false)
      setShowEditModal(false)
      setEditingMedicine(null)
      await loadMedicines()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const getStockStatus = (medicine: any) => {
    if (new Date(medicine.expiry_date) < new Date()) return 'Expired'
    if (medicine.quantity === 0) return 'Out of Stock'
    if (medicine.quantity < 10) return 'Low Stock'
    return 'In Stock'
  }

  const getStockColor = (status: string) => {
    if (status === 'In Stock') return 'bg-green-100 text-green-700'
    if (status === 'Low Stock') return 'bg-yellow-100 text-yellow-700'
    if (status === 'Expired') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-700'
  }

  const pendingAddedMedicines = pendingInventory
    .filter((record) => record.method === 'POST')
    .map((record) => {
      const payload = record.payload || {}
      return {
        _id: record.local_id,
        name: payload.name || 'Pending Item',
        batch: payload.batch || 'Pending',
        expiry_date: payload.expiry_date || new Date(record.created_at).toISOString(),
        quantity: payload.quantity || 0,
        buying_price: payload.buying_price || 0,
        selling_price: payload.selling_price || 0,
        category: payload.category,
        pending: true,
      }
    })

  const pendingUpdateCount = pendingInventory.filter((record) => record.method === 'PUT').length
  const pendingDeleteCount = pendingInventory.filter((record) => record.method === 'DELETE').length
  const combinedMedicines = [...pendingAddedMedicines, ...medicines]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Medicines</h1>
          <p className="text-gray-600 mt-2">Manage your medicine inventory</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={templateLoading}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {templateLoading ? 'Preparing...' : 'Template'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetImportState()
              setShowImportModal(true)
            }}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportMedicines}
            disabled={exporting || medicines.length === 0}
            className="flex items-center gap-2"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Medicine
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by name or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="Antibiotics">Antibiotics</option>
            <option value="Pain Relief">Pain Relief</option>
            <option value="Vitamins">Vitamins</option>
            <option value="Other">Other</option>
          </select>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </Card>

      {pendingInventory.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-700 mt-1" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-yellow-800">
                {pendingInventory.length} inventory change{pendingInventory.length === 1 ? '' : 's'} pending sync
              </p>
              {pendingUpdateCount > 0 && (
                <p className="text-xs text-yellow-700">{pendingUpdateCount} update action{pendingUpdateCount === 1 ? '' : 's'} will apply after syncing.</p>
              )}
              {pendingDeleteCount > 0 && (
                <p className="text-xs text-yellow-700">{pendingDeleteCount} delete request{pendingDeleteCount === 1 ? '' : 's'} queued.</p>
              )}
              <p className="text-xs text-yellow-600">Keep working — everything will push as soon as the connection returns.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Medicines Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading medicines...</p>
          </div>
        ) : combinedMedicines.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No medicines found</p>
            <Button className="mt-4" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Medicine
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full align-middle px-5 sm:px-6 lg:px-8">
              <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Medicine</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Batch</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Expiry</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Quantity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Buying Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Selling Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedMedicines.map((medicine) => {
                  const isPending = Boolean(medicine.pending)
                  const status = isPending ? 'Pending Sync' : getStockStatus(medicine)
                  const statusColor = isPending ? 'bg-yellow-200 text-yellow-800' : getStockColor(status)
                  return (
                    <tr key={medicine._id} className={`border-b border-gray-100 hover:bg-gray-50 ${isPending ? 'bg-yellow-50' : ''}`}>
                      <td className="py-3 px-4 font-medium">
                        {medicine.name}
                        {isPending && <span className="ml-2 text-xs text-yellow-700 font-semibold">Pending Sync</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{medicine.batch || '-'}</td>
                      <td className="py-3 px-4">{new Date(medicine.expiry_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{medicine.quantity}</td>
                      <td className="py-3 px-4">${Number(medicine.buying_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 font-medium text-primary-600">${Number(medicine.selling_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            className={`p-2.5 rounded-xl transition-all duration-200 ${isPending ? 'cursor-not-allowed text-gray-400 bg-gray-100' : 'hover:bg-blue-50 text-blue-600 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'}`}
                            onClick={() => !isPending && handleEdit(medicine)}
                            title={isPending ? 'Awaiting sync' : 'Edit medicine'}
                            disabled={isPending}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            className={`p-2.5 rounded-xl transition-all duration-200 ${isPending ? 'cursor-not-allowed text-gray-400 bg-gray-100' : 'hover:bg-red-50 text-red-600 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'}`}
                            onClick={() => !isPending && handleDelete(medicine._id)}
                            title={isPending ? 'Awaiting sync' : 'Delete medicine'}
                            disabled={isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false)
              setShowEditModal(false)
              setEditingMedicine(null)
            }
          }}
        >
          <Card 
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white relative z-[10000]"
            style={{ position: 'relative', zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {showEditModal ? 'Edit Medicine' : 'Add New Medicine'}
              </h2>
              <button 
                onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingMedicine(null) }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Medicine Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={errors.name}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Batch Number (Optional)"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    error={errors.batch}
                    placeholder="Enter batch number if available"
                  />
                </div>
                <div>
                  <Input
                    label="Expiry Date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    error={errors.expiry_date}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    error={errors.quantity}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Buying Price ($)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.buying_price}
                    onChange={(e) => setFormData({ ...formData, buying_price: e.target.value })}
                    error={errors.buying_price}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Selling Price ($)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    error={errors.selling_price}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Category (Optional)"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Antibiotics, Pain Relief"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">
                  {showEditModal ? 'Update Medicine' : 'Add Medicine'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingMedicine(null) }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImportModal(false)
              resetImportState()
            }
          }}
        >
          <Card
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Import Medicines</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload an Excel file (.xlsx) using the template format. Existing rows will be added as new medicines.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  resetImportState()
                }}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportMedicines} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Excel File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setImportFile(file)
                    setImportSummary(null)
                  }}
                  className="w-full cursor-pointer rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <p className="text-xs text-gray-500">
                  Required columns: Name, Expiry Date (YYYY-MM-DD), Quantity, Buying Price, Selling Price. Optional: Batch Number, Category.
                </p>
              </div>

              {importSummary && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  <p className="font-semibold">Import Summary</p>
                  <p className="mt-1">Inserted medicines: {importSummary.inserted}</p>
                  {importSummary.errors?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium text-yellow-700">Rows skipped:</p>
                      <ul className="list-disc pl-5 text-yellow-700">
                        {importSummary.errors.slice(0, 5).map((err, idx) => (
                          <li key={`${err.line}-${idx}`}>
                            Row {err.line}: {err.message}
                          </li>
                        ))}
                        {importSummary.errors.length > 5 && (
                          <li>+ {importSummary.errors.length - 5} more...</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowImportModal(false)
                    resetImportState()
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={importing || !importFile}
                >
                  {importing ? 'Importing...' : 'Import Medicines'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

