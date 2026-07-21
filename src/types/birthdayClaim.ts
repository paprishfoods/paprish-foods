export interface BirthdayClaimItem {
  id: string;
  name: string;
  quantity: number;
  price: string;
}

export interface BirthdayClaim {
  id: string;
  name: string;
  phone: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  alternate_mobile: string | null;
  date_of_birth: string; // YYYY-MM-DD
  items: BirthdayClaimItem[];
  total: number;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
}

export type BirthdayClaimFormData = Omit<BirthdayClaim, "id" | "created_at">;