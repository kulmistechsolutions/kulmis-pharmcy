export interface Banner {
  _id: string;
  title: string;
  message: string;
  image_url: string;
  target_users: string[];
  status: 'active' | 'inactive';
  expiry_date?: string | null;
  created_at?: string;
  updated_at?: string;
  stats?: {
    views: number;
    dismissed: number;
    forceHidden: number;
  };
}

export interface BannerLog {
  _id: string
  user_id: {
    _id: string
    pharmacyName: string
    email: string
    phone: string
    role: string
  }
  dismissed: boolean
  dismissed_at?: string | null
  force_hidden: boolean
  created_at?: string
  updated_at?: string
}
