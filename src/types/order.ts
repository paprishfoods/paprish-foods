export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: string;
}

export interface Order {
  id: string;
  name: string;
  phone: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  alternate_mobile: string | null;
  shipping_region: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  created_at?: string;
}
