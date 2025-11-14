import { queueMutation } from '@/lib/offlineQueue'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';
const API_URL = API_BASE.replace(/\/+$/, '');

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async requestInternal<T = any>(
    endpoint: string,
    options: RequestInit = {},
    responseType: 'json' | 'blob' = 'json'
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const parseError = async () => {
          try {
            return await response.json();
          } catch {
            try {
              const text = await response.text();
              return { message: text };
            } catch {
              return { message: `Request failed with status ${response.status}` };
            }
          }
        };

        const error = await parseError();

        if (error.errors && Array.isArray(error.errors)) {
          const errorMessages = error.errors
            .map((e: any) => e.msg || e.message || JSON.stringify(e))
            .join(', ');
          throw new Error(errorMessages);
        }

        if (response.status === 404) {
          throw new Error(
            `Route not found: ${endpoint}. Please ensure the backend server is running and routes are properly configured.`
          );
        }

        throw new Error(error.message || `Request failed with status ${response.status}`);
      }

      if (responseType === 'blob') {
        return (await response.blob()) as T;
      }

      if (response.status === 204) {
        return null as T;
      }

      return (await response.json()) as T;
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(
          `Cannot connect to server. Please ensure the backend is running on ${API_URL.replace('/api', '')}`
        );
      }
      throw error;
    }
  }

  private request<T = any>(endpoint: string, options: RequestInit = {}) {
    return this.requestInternal<T>(endpoint, options, 'json');
  }

  private requestBlob(endpoint: string, options: RequestInit = {}) {
    return this.requestInternal<Blob>(endpoint, options, 'blob');
  }

  // Auth
  async register(data: any) {
    const response = await this.request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Save token after registration
    if (response.token) {
      localStorage.setItem('token', response.token);
    }
    return response;
  }

  async login(data: { email?: string; phone?: string; password: string }) {
    const response = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.token) {
      localStorage.setItem('token', response.token);
    }
    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  logout() {
    localStorage.removeItem('token');
  }

  // Settings
  async getPharmacySettings(pharmacyId?: string) {
    const query = pharmacyId ? `?pharmacyId=${encodeURIComponent(pharmacyId)}` : '';
    return this.request(`/settings${query}`);
  }

  async updatePharmacySettings(data: {
    name?: string;
    owner_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    about?: string;
    pharmacyId?: string;
  }) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadPharmacyLogo(payload: { file: string; fileName: string; pharmacyId?: string }) {
    return this.request('/settings/logo', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePharmacyPassword(data: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
    pharmacyId?: string;
  }) {
    return this.request('/settings/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Lab Patients
  async getPatients(search?: string) {
    const query = search ? `?q=${encodeURIComponent(search)}` : '';
    return this.request(`/lab/patients${query}`);
  }

  async createPatient(data: any) {
    return this.request('/lab/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Lab Tests
  async getTests(search?: string, category?: string) {
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (category) params.append('category', category);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/lab/tests${query}`);
  }

  async createTest(data: any) {
    return this.request('/lab/tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTest(id: string, data: any) {
    return this.request(`/lab/tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Lab Orders
  async createOrder(data: any) {
    return this.request('/lab/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrders(status?: string, search?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('q', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/lab/orders${query}`);
  }

  async getOrder(id: string) {
    return this.request(`/lab/orders/${id}`);
  }

  async updateOrderSample(id: string, data: any) {
    return this.request(`/lab/orders/${id}/sample`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request(`/lab/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Lab Results
  async saveResults(data: any) {
    return this.request('/lab/results', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getResults(orderId: string) {
    return this.request(`/lab/results/${orderId}`);
  }

  // Invoices
  async getInvoices(params?: { orderId?: string; type?: string; search?: string; status?: string; startDate?: string; endDate?: string; sort?: 'asc' | 'desc'; staffId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.orderId) searchParams.append('order_id', params.orderId);
    if (params?.type) searchParams.append('type', params.type);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await this.request<{ invoices: any[] }>(`/invoices${query}`);
    return response.invoices;
  }

  async getInvoice(id: string) {
    return this.request(`/invoices/${id}`);
  }

  async getInvoiceByNumber(invoiceNumber: string) {
    const encoded = encodeURIComponent(invoiceNumber);
    return this.request(`/invoices/lookup/${encoded}`);
  }

  async exportInvoicesPDF(filters?: { search?: string; type?: string; status?: string; startDate?: string; endDate?: string; sort?: 'asc' | 'desc'; staffId?: string }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.sort) params.append('sort', filters.sort);
    if (filters?.staffId) params.append('staffId', filters.staffId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestBlob(`/invoices/export/pdf${query}`);
  }

  async exportInvoicesExcel(filters?: { search?: string; type?: string; status?: string; startDate?: string; endDate?: string; sort?: 'asc' | 'desc'; staffId?: string }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.sort) params.append('sort', filters.sort);
    if (filters?.staffId) params.append('staffId', filters.staffId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestBlob(`/invoices/export/excel${query}`);
  }

  async exportReportsExcel(filters: { type: string; startDate?: string; endDate?: string; staffId?: string }) {
    const params = new URLSearchParams();
    params.append('type', filters.type);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.staffId) params.append('staffId', filters.staffId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.requestBlob(`/reports/export${query}`);
  }

  async exportInvoicePDF(id: string) {
    return this.requestBlob(`/invoices/${id}/export/pdf`);
  }

  async exportInvoiceExcel(id: string) {
    return this.requestBlob(`/invoices/${id}/export/excel`);
  }

  // Medicines
  async getMedicines(search?: string, category?: string, stock?: string) {
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (category) params.append('category', category);
    if (stock) params.append('stock', stock);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/medicines${query}`);
  }

  async createMedicine(data: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'inventory', endpoint: '/medicines', method: 'POST', payload: data })
      return { queued: true, local_id: localId }
    }
    return this.request('/medicines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMedicine(id: string, data: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'inventory', endpoint: `/medicines/${id}`, method: 'PUT', payload: data })
      return { queued: true, local_id: localId }
    }
    return this.request(`/medicines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMedicine(id: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'inventory', endpoint: `/medicines/${id}`, method: 'DELETE', payload: null })
      return { queued: true, local_id: localId }
    }
    return this.request(`/medicines/${id}`, {
      method: 'DELETE',
    });
  }

  async downloadMedicineTemplate() {
    return this.requestBlob('/medicines/template/download');
  }

  async exportMedicines() {
    return this.requestBlob('/medicines/export');
  }

  async importMedicines(formData: FormData) {
    return this.request('/medicines/import', {
      method: 'POST',
      body: formData,
    });
  }

  // Promotional Banners
  async getActiveBanners() {
    return this.request('/banners/active');
  }

  async dismissBanner(id: string) {
    return this.request(`/banners/${id}/dismiss`, {
      method: 'POST',
    });
  }

  async getAdminBanners() {
    return this.request('/admin/banners')
  }

  async uploadBannerImage(payload: { file: string; fileName: string; folder?: string }) {
    return this.request('/admin/banners/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createBanner(data: any) {
    return this.request('/admin/banners', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateBanner(id: string, data: any) {
    return this.request(`/admin/banners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteBanner(id: string) {
    return this.request(`/admin/banners/${id}`, {
      method: 'DELETE',
    })
  }

  async getBannerLogs(id: string) {
    return this.request(`/admin/banners/${id}/logs`)
  }

  async stopBannerForUser(bannerId: string, userId: string, forceHidden: boolean) {
    return this.request(`/admin/banners/${bannerId}/stop/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ forceHidden }),
    })
  }

  // Lab Cashier
  async getLabDiseases() {
    return this.request('/lab-cashier/diseases');
  }

  async getLabCashierRecords(params?: { status?: string; startDate?: string; endDate?: string; search?: string; staffId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/lab-cashier${query}`);
  }

  async createLabCashierRecord(payload: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'lab', endpoint: '/lab-cashier', method: 'POST', payload })
      return { queued: true, local_id: localId }
    }
    return this.request('/lab-cashier', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getLabCashierRecord(id: string) {
    return this.request(`/lab-cashier/${id}`);
  }

  async updateLabCashierRecord(id: string, payload: any) {
    return this.request(`/lab-cashier/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteLabCashierRecord(id: string) {
    return this.request(`/lab-cashier/${id}`, {
      method: 'DELETE',
    });
  }

  async getLabCashierAnalytics(params?: { days?: number; staffId?: string } | number) {
    const searchParams = new URLSearchParams();

    if (typeof params === 'number') {
      searchParams.append('days', params.toString());
    } else if (params) {
      if (typeof params.days === 'number') {
        searchParams.append('days', params.days.toString());
      }
      if (params.staffId) {
        searchParams.append('staffId', params.staffId);
      }
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/lab-cashier/analytics/summary${query}`);
  }

  // Transaction ledger
  async getTransactions(params?: {
    page?: number
    limit?: number
    sort?: 'asc' | 'desc'
    search?: string
    type?: string
    status?: string
    startDate?: string
    endDate?: string
    staffId?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.sort) searchParams.append('sort', params.sort)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.type) searchParams.append('type', params.type)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)
    if (params?.staffId) searchParams.append('staffId', params.staffId)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return this.request(`/transactions${query}`)
  }

  async getTransaction(id: string) {
    return this.request(`/transactions/${id}`)
  }

  async exportTransactionsExcel(filters?: {
    sort?: 'asc' | 'desc'
    search?: string
    type?: string
    status?: string
    startDate?: string
    endDate?: string
    staffId?: string
  }) {
    const searchParams = new URLSearchParams()
    if (filters?.sort) searchParams.append('sort', filters.sort)
    if (filters?.search) searchParams.append('search', filters.search)
    if (filters?.type) searchParams.append('type', filters.type)
    if (filters?.status) searchParams.append('status', filters.status)
    if (filters?.startDate) searchParams.append('startDate', filters.startDate)
    if (filters?.endDate) searchParams.append('endDate', filters.endDate)
    if (filters?.staffId) searchParams.append('staffId', filters.staffId)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return this.requestBlob(`/transactions/export/excel${query}`)
  }

  // Sales
  async createSale(data: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'sales', endpoint: '/sales', method: 'POST', payload: data })
      return { queued: true, local_id: localId }
    }
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getSales(params?: { date?: string; startDate?: string; endDate?: string; staffId?: string } | string) {
    if (typeof params === 'string') {
      return this.request(`/sales?date=${params}`);
    }

    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.append('date', params.date);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/sales${query}`);
  }

  // Debts
  async getDebts(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/debts${query}`);
  }

  async createDebt(data: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'debts', endpoint: '/debts', method: 'POST', payload: data })
      return { queued: true, local_id: localId }
    }
    return this.request('/debts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordPayment(id: string, amount: number) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({
        target: 'payments',
        endpoint: `/debts/${id}/payment`,
        method: 'PATCH',
        payload: { amount },
      })
      return { queued: true, local_id: localId }
    }
    return this.request(`/debts/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    });
  }

  async sendDebtReminder(id: string, payload: { method: 'whatsapp' | 'sms'; message: string; phone?: string }) {
    return this.request(`/debts/${id}/reminder`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // Notifications
  async getNotifications(params?: { status?: 'read' | 'unread'; type?: string; page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.type) searchParams.append('type', params.type)
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return this.request(`/notifications${query}`)
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
    })
  }

  async markAllNotificationsRead() {
    return this.request(`/notifications/mark-all/read`, {
      method: 'PATCH',
    })
  }

  async deleteNotification(id: string) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    })
  }

  // Expenses
  async getExpenses(category?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/expenses${query}`);
  }

  async createExpense(data: any) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localId = await queueMutation({ target: 'expenses', endpoint: '/expenses', method: 'POST', payload: data })
      return { queued: true, local_id: localId }
    }
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Subscription Plans (Public for Pharmacies)
  async getAvailablePlans() {
    return this.request('/plans');
  }

  async getCurrentSubscription() {
    return this.request('/plans/current');
  }

  async requestPlanChange(planId: string, paymentData: {
    method: string;
    sender_number?: string;
    amount: number;
    proof_url?: string;
  }) {
    return this.request('/subscriptions/request', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        ...paymentData,
      }),
    });
  }

  // Users (Admin Management)
  async getUsers() {
    return this.request('/users');
  }

  async getUser(id: string) {
    return this.request(`/users/${id}`);
  }

  async createUser(data: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Plans
  async getPlans() {
    return this.request('/admin/plans');
  }

  async createPlan(data: any) {
    return this.request('/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlan(id: string, data: any) {
    return this.request(`/admin/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updatePlanStatus(id: string, status: string) {
    return this.request(`/admin/plans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deletePlan(id: string) {
    return this.request(`/admin/plans/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Subscription Requests
  async getSubscriptionRequests(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/admin/subscriptions/requests${query}`);
  }

  async getActiveSubscriptions() {
    return this.request('/admin/subscriptions/active');
  }

  async approveSubscription(id: string) {
    return this.request(`/admin/subscriptions/${id}/approve`, {
      method: 'PATCH',
    });
  }

  async rejectSubscription(id: string, reason?: string) {
    return this.request(`/admin/subscriptions/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async extendSubscription(id: string, days: number) {
    return this.request(`/admin/subscriptions/${id}/extend`, {
      method: 'PATCH',
      body: JSON.stringify({ days }),
    });
  }

  // Admin - Revenue
  async getRevenueSummary() {
    return this.request('/admin/revenue/summary');
  }

  async getMonthlyRevenue() {
    return this.request('/admin/revenue/monthly');
  }

  async getRevenueByPlan() {
    return this.request('/admin/revenue/by-plan');
  }

  // Admin - Pharmacies
  async getAllPharmacies() {
    return this.request('/admin/pharmacies');
  }

  async getPharmacyProfile(id: string) {
    return this.request(`/admin/pharmacies/${id}/profile`);
  }

  async resetPharmacyPassword(id: string, newPassword: string) {
    return this.request(`/admin/pharmacies/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword })
    })
  }

  async extendPharmacySubscription(id: string, days: number) {
    return this.request(`/admin/pharmacies/${id}/extend-subscription`, {
      method: 'PATCH',
      body: JSON.stringify({ days }),
    });
  }

  async extendPharmacyTrial(id: string, days: number) {
    return this.request(`/admin/pharmacies/${id}/trial/extend`, {
      method: 'PATCH',
      body: JSON.stringify({ days }),
    });
  }

  async resetPharmacyTrial(id: string, days?: number) {
    return this.request(`/admin/pharmacies/${id}/trial/reset`, {
      method: 'PATCH',
      body: JSON.stringify(days ? { days } : {}),
    });
  }

  async expirePharmacyTrial(id: string) {
    return this.request(`/admin/pharmacies/${id}/trial/expire`, {
      method: 'PATCH',
    });
  }

  // Admin - Trial settings
  async getTrialOverview() {
    return this.request('/admin/trials/overview');
  }

  async getTrialSettings() {
    return this.request('/admin/trials/settings');
  }

  async updateTrialSettings(payload: {
    enabled?: boolean;
    durationDays?: number;
    autoLockBehavior?: 'lock' | 'notice';
    limitations?: {
      maxInvoices?: number | null;
      maxMedicines?: number | null;
      maxLabRecords?: number | null;
    };
    defaultPlanId?: string | null;
  }) {
    return this.request('/admin/trials/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getTrialPharmacies(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/admin/trials${query}`);
  }

  async updatePharmacyStatus(id: string, isActive: boolean) {
    return this.request(`/admin/pharmacies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  async broadcastNotification(payload: {
    targetPharmacyId?: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    expiresAt?: string;
  }) {
    return this.request('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Sync Logs
  async getSyncLogs(params?: {
    status?: string
    target?: string
    staffId?: string
    startDate?: string
    endDate?: string
    tenantId?: string
    limit?: number
    skip?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.target) searchParams.append('target', params.target)
    if (params?.staffId) searchParams.append('staffId', params.staffId)
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)
    if (params?.tenantId) searchParams.append('tenantId', params.tenantId)
    if (typeof params?.limit === 'number') searchParams.append('limit', params.limit.toString())
    if (typeof params?.skip === 'number') searchParams.append('skip', params.skip.toString())
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return this.request(`/sync/logs${query}`)
  }

  async appendSyncLogs(logs: Array<{
    target: string
    status: string
    message?: string
    localId?: string
    metadata?: Record<string, unknown>
    timestamp?: number
    tenant_id?: string
  }>) {
    return this.request('/sync/logs', {
      method: 'POST',
      body: JSON.stringify({ logs }),
    })
  }
}

export const api = new ApiClient();