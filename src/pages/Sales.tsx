import React, { useState, useEffect, useMemo } from 'react'
import { Search, ShoppingCart, X, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'

interface CartItem {
  medicine_id: string
  name: string
  quantity: number
  price: number
  buying_price: number
  profit: number
  allowLoss: boolean
  isLoss: boolean
  zeroProfitNotified?: boolean
  batch?: string
}

export const Sales: React.FC = () => {
  const { user } = useUser()
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [medicines, setMedicines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedCart = window.localStorage.getItem('sales_cart')
      const savedCustomer = window.localStorage.getItem('sales_customer_name')
      if (savedCart) {
        const parsed = JSON.parse(savedCart)
        if (Array.isArray(parsed)) {
          setCart(parsed)
        }
      }
      if (savedCustomer) {
        setCustomerName(savedCustomer)
      }
    } catch (error) {
      console.warn('Failed to load saved sales data:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('sales_cart', JSON.stringify(cart))
    } catch (error) {
      console.warn('Failed to persist cart:', error)
    }
  }, [cart])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (customerName) {
        window.localStorage.setItem('sales_customer_name', customerName)
      } else {
        window.localStorage.removeItem('sales_customer_name')
      }
    } catch (error) {
      console.warn('Failed to persist customer name:', error)
    }
  }, [customerName])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isCartOpen) {
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previous
      }
    }
  }, [isCartOpen])

  useEffect(() => {
    loadMedicines()
  }, [searchTerm])

  const loadMedicines = async () => {
    try {
      setLoading(true)
      const data = await api.getMedicines(searchTerm)
      const list = Array.isArray(data) ? data : data?.results ?? []
      setMedicines(list as any[])
    } catch (error: any) {
      console.error('Error loading medicines:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (medicine: any) => {
    if (medicine.quantity === 0) {
      alert('This medicine is out of stock')
      return
    }

    const existingItem = cart.find(item => item.medicine_id === medicine._id)
    if (existingItem) {
      if (existingItem.quantity >= medicine.quantity) {
        alert(`Only ${medicine.quantity} units available`)
        return
      }
      setCart(cart.map(item =>
        item.medicine_id === medicine._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      const profit = medicine.selling_price - medicine.buying_price
      const isLoss = medicine.selling_price < medicine.buying_price
      setCart([
        ...cart,
        {
          medicine_id: medicine._id,
          name: medicine.name,
          quantity: 1,
          price: medicine.selling_price,
          buying_price: medicine.buying_price,
          profit,
          allowLoss: false,
          isLoss,
          batch: medicine.batch,
        },
      ])
    }
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.medicine_id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }
    
    const medicine = medicines.find(m => m._id === id)
    if (medicine && quantity > medicine.quantity) {
      alert(`Only ${medicine.quantity} units available`)
      return
    }
    
    setCart(cart.map(item =>
      item.medicine_id === id ? { ...item, quantity } : item
    ))
  }

  const handlePriceChange = (id: string, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue)
    if (Number.isNaN(parsed)) {
      return
    }
    const sanitizedPrice = parsed < 0 ? 0 : parsed

    setCart((prev) =>
      prev.map((item) => {
        if (item.medicine_id !== id) return item

        const nextPrice = sanitizedPrice
        const nextProfitPerUnit = nextPrice - item.buying_price
        const isLoss = nextPrice < item.buying_price
        const isZeroProfit = nextPrice === item.buying_price
        let allowLoss = item.allowLoss
        let zeroProfitNotified = item.zeroProfitNotified

        if (isLoss && !allowLoss) {
          const confirmed = window.confirm(
            '⚠️ Warning: You are selling below the cost price. This will cause a loss. Do you still want to proceed?'
          )
          if (!confirmed) {
            return item
          }
          allowLoss = true
        }

        if (!isLoss && allowLoss) {
          allowLoss = false
        }

        if (isZeroProfit && !zeroProfitNotified) {
          window.alert('⚠️ Zero Profit: The selling price matches the cost price.')
          zeroProfitNotified = true
        }

        if (!isZeroProfit && zeroProfitNotified) {
          zeroProfitNotified = false
        }

        return {
          ...item,
          price: nextPrice,
          profit: nextProfitPerUnit,
          allowLoss,
          isLoss,
          zeroProfitNotified,
        }
      })
    )
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    const unresolvedLossItems = cart.filter(
      (item) => item.price < item.buying_price && !item.allowLoss
    )

    let cartForSubmission = cart

    if (unresolvedLossItems.length > 0) {
      const confirmed = window.confirm(
        '⚠️ Warning: Some items are being sold below cost price. This will cause a loss. Do you still want to continue with this sale?'
      )
      if (!confirmed) {
        return
      }
      cartForSubmission = cart.map((item) =>
        item.price < item.buying_price
          ? { ...item, allowLoss: true, isLoss: true }
          : item
      )
      setCart(cartForSubmission)
    }

    setProcessing(true)
    try {
      const items = cartForSubmission.map(item => ({
        medicine_id: item.medicine_id,
        name: item.name,
        quantity: item.quantity,
        selling_price: item.price,
        buying_price: item.buying_price,
        allow_loss: item.price < item.buying_price ? item.allowLoss : undefined,
      }))

      const totalSale = cartForSubmission.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const totalProfitCalculated = cartForSubmission.reduce(
        (sum, item) => sum + (item.price - item.buying_price) * item.quantity,
        0
      )

      const result: any = await api.createSale({
        customer_name: customerName || 'Walk-in Customer',
        items,
        total_sale: totalSale,
        profit: totalProfitCalculated,
        quantity: cartForSubmission.reduce((sum, item) => sum + item.quantity, 0),
      })

      if (result?.queued) {
        alert('You are offline. Sale saved locally and will sync once you reconnect.')
      } else {
        if (result?.lossItems?.length) {
          alert(`Sale completed with ${result.lossItems.length} loss item${result.lossItems.length > 1 ? 's' : ''}.`)
        } else {
          alert('Sale completed successfully!')
        }
      }

      setCart([])
      setCustomerName('')
      setIsCartOpen(false)
      loadMedicines() // Reload to update stock
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleClearCart = () => {
    if (cart.length === 0) return
    const confirmed = window.confirm('Clear all items from the cart?')
    if (!confirmed) return
    setCart([])
  }

  const canViewProfit = useMemo(() => {
    if (!user) return false
    if (user.role === 'super_admin' || user.role === 'pharmacy_owner') return true
    return Array.isArray(user.permissions) && user.permissions.includes('sales:profit_view')
  }, [user])

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalCost = cart.reduce((sum, item) => sum + item.buying_price * item.quantity, 0)
  const totalProfit = cart.reduce(
    (sum, item) => sum + (item.price - item.buying_price) * item.quantity,
    0
  )
  const lossCount = cart.filter((item) => item.isLoss).length
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  [])

  const renderCartContent = ({ variant = 'desktop', onClose }: { variant?: 'desktop' | 'mobile'; onClose?: () => void } = {}) => {
     const isMobile = variant === 'mobile'
     const listClassName = isMobile
      ? 'flex-1 min-h-0 space-y-3 overflow-y-auto pr-1'
      : 'flex-1 min-h-0 space-y-3 overflow-y-auto pr-2'
 
     return (
      <div className={`flex h-full min-h-0 flex-col gap-4 ${isMobile ? '' : 'bg-white'}`}>
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cart</h2>
            <p className="text-xs text-gray-500 mt-1">
              {totalItems} item{totalItems === 1 ? '' : 's'} • ${total.toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <ShoppingCart className="w-4 h-4" />
              ${total.toFixed(2)}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
                aria-label="Close cart"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
 
        <div>
          <Input
            label="Customer Name (Optional)"
            placeholder="Walk-in Customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div className={listClassName}>
          {cart.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Cart is empty</p>
          ) : (
            cart.map((item) => (
              <div key={item.medicine_id} className="p-3 bg-gray-50 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                    {item.batch && <p className="text-xs text-gray-500">Batch: {item.batch}</p>}
                    {canViewProfit && (
                      <p className="text-xs text-gray-500">Cost: ${item.buying_price.toFixed(2)}</p>
                    )}
                    {item.isLoss && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        <AlertTriangle className="w-3 h-3" /> Loss Sale
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromCart(item.medicine_id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-all duration-200 hover:scale-110 active:scale-95"
                    title="Remove from cart"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Selling Price</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number.isNaN(item.price) ? '' : item.price.toString()}
                      onChange={(e) => handlePriceChange(item.medicine_id, e.target.value)}
                    />
                  </div>
                  {canViewProfit && (
                    <div className="rounded-lg border border-dashed border-primary-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-500 tracking-wide">Profit / unit</p>
                      <p
                        className={`text-sm font-semibold ${
                          item.isLoss
                            ? 'text-red-600'
                            : item.price === item.buying_price
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        ${(item.price - item.buying_price).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.medicine_id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center border-2 border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 hover:border-primary-600 transition-all duration-200 font-semibold shadow-sm hover:shadow-md active:scale-95"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-semibold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.medicine_id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center border-2 border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 hover:border-primary-600 transition-all duration-200 font-semibold shadow-sm hover:shadow-md active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-primary-600">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${total.toFixed(2)}</span>
              </div>
              {canViewProfit && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Cost:</span>
                    <span className="font-medium text-gray-700">${totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Profit:</span>
                    <span
                      className={`font-medium ${
                        totalProfit < 0
                          ? 'text-red-600'
                          : totalProfit === 0
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      ${totalProfit.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span className="text-primary-600">${total.toFixed(2)}</span>
              </div>
            </div>

            {!canViewProfit && lossCount > 0 && (
              <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ This sale includes {lossCount} item{lossCount > 1 ? 's' : ''} below cost price. An admin may review this transaction.
              </div>
            )}

            {canViewProfit && (
              <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Profit Snapshot</span>
                  <span className="font-semibold">
                    Net Profit:{' '}
                    <span
                      className={
                        totalProfit < 0
                          ? 'text-red-600'
                          : totalProfit === 0
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }
                    >
                      ${totalProfit.toFixed(2)}
                    </span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-primary-700">
                  <span>Total Sales: ${total.toFixed(2)}</span>
                  <span>Total Cost: ${totalCost.toFixed(2)}</span>
                  {lossCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-600 font-semibold">
                      <AlertTriangle className="w-3 h-3" /> Loss Items: {lossCount}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClearCart}
                disabled={processing}
              >
                Clear Cart
              </Button>
              <Button
                className="w-full"
                onClick={handleCompleteSale}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Complete Sale'}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">Today • {todayLabel}</p>
        </div>
        <div className="w-full md:max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search medicine by name or batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6 items-start lg:h-[calc(100vh-8rem)] lg:min-h-0">
        {/* Medicine Search */}
        <div className="space-y-4 lg:h-full lg:min-h-0">
          <Card className="lg:flex lg:flex-col lg:h-full lg:min-h-0">
            <div className="flex flex-col gap-2 border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Available Medicines</h2>
              <p className="text-xs text-gray-500">{medicines.length} item{medicines.length === 1 ? '' : 's'} found</p>
            </div>
            {loading ? (
              <div className="py-8 text-center text-gray-600 lg:flex-1 lg:flex lg:items-center lg:justify-center">
                <p className="text-gray-600">Loading medicines...</p>
              </div>
            ) : medicines.length === 0 ? (
              <div className="py-8 text-center text-gray-600 lg:flex-1 lg:flex lg:items-center lg:justify-center">
                <p className="text-gray-600">No medicines found</p>
              </div>
            ) : (
              <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
                  {medicines.map((medicine) => {
                    const inCart = cart.find(item => item.medicine_id === medicine._id)
                    const isExpired = new Date(medicine.expiry_date) < new Date()
                    const stockStatus = isExpired
                      ? 'Expired'
                      : medicine.quantity === 0
                      ? 'Out of Stock'
                      : medicine.quantity < 10
                      ? 'Low Stock'
                      : 'In Stock'
                    
                    return (
                      <div
                        key={medicine._id}
                        className={`p-4 border rounded-xl transition-all ${
                          medicine.quantity === 0 || isExpired
                            ? 'border-gray-200 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-primary-500 hover:shadow-md cursor-pointer'
                        }`}
                        onClick={() => medicine.quantity > 0 && !isExpired && addToCart(medicine)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{medicine.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">Batch: {medicine.batch}</p>
                            <p className="text-xs text-gray-500 mt-1">Qty: {medicine.quantity}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            stockStatus === 'In Stock'
                              ? 'bg-green-100 text-green-700'
                              : stockStatus === 'Low Stock'
                              ? 'bg-yellow-100 text-yellow-700'
                              : stockStatus === 'Expired'
                              ? 'bg-gray-200 text-gray-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stockStatus}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-lg font-bold text-primary-600">
                            ${medicine.selling_price.toFixed(2)}
                          </span>
                          {inCart ? (
                            <span className="text-sm text-green-600 font-medium">
                              {inCart.quantity} in cart
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              disabled={medicine.quantity === 0 || isExpired}
                              variant="outline"
                              className="font-semibold"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Cart */}
         <div className="hidden lg:block">
          <Card className="sticky top-20 flex h-[78vh] max-h-[78vh] min-h-[70vh] flex-col overflow-hidden shadow-xl border border-primary-100">
            {renderCartContent({ variant: 'desktop' })}
          </Card>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className={`lg:hidden fixed bottom-20 right-5 z-40 flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-white shadow-xl transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-primary-200 transform ${
          isCartOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <ShoppingCart className="w-5 h-5" />
        <span className="text-sm font-semibold">
          {totalItems} item{totalItems === 1 ? '' : 's'} • ${total.toFixed(2)}
        </span>
      </button>

      {/* Mobile Cart Drawer */}
      {isCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/50" onClick={() => setIsCartOpen(false)} />
          <div className="bg-white rounded-t-3xl shadow-2xl p-5 pb-8 max-h-[85vh] min-h-[65vh] flex flex-col">
            {renderCartContent({ variant: 'mobile', onClose: () => setIsCartOpen(false) })}
          </div>
        </div>
      )}
    </div>
  )
}
