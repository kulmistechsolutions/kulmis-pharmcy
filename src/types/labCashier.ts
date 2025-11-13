export type LabStatus = 'process' | 'pending' | 'complete'
export type SampleType = 'Blood' | 'Urine' | 'Stool' | 'Swab' | 'Other'

export interface LabCashierRecord {
  _id: string
  user_id: string
  patient_name: string
  phone?: string
  age?: number
  diseases: string[]
  sample_type: SampleType
  sample_notes?: string
  price: number
  date: string
  status: LabStatus
  cashier_name?: string
  createdAt?: string
  updatedAt?: string
  invoice?: LabInvoice
}

export interface LabInvoice {
  _id: string
  record_id: string
  invoice_number: string
  user_id: string
  patient_name: string
  diseases: string[]
  sample_type: SampleType
  price: number
  status: 'paid' | 'void'
  created_at: string
  updated_at?: string
}

export interface LabAnalyticsSummary {
  totalCashToday: number
  patientsToday: number
  topDiseases: { name: string; count: number }[]
  trend: { date: string; total: number }[]
}





