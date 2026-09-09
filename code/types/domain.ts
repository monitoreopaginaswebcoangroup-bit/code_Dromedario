export type UserRole = "admin" | "comercial" | "facturacion" | "despacho";

export type OrderStatus =
  | "registered"
  | "pending_approval"
  | "rejected"
  | "pending_invoicing"
  | "invoiced"
  | "remitted_pending_invoice"
  | "pending_dispatch"
  | "dispatched"
  | "delivered"
  | "novelty"
  | "cancelled";

export type SalesChannel = "whatsapp" | "phone" | "email" | "in_person" | "other";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  legal_name: string;
  nit: string | null;
  billing_email: string | null;
  main_address: string | null;
  dispatch_address: string | null;
  assigned_salesperson_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  position: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_price: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProductPrice {
  id: string;
  customer_id: string;
  product_id: string;
  price: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customer_id: string;
  contact_id: string | null;
  channel: SalesChannel;
  assigned_salesperson_id: string | null;
  created_by: string;
  delivery_address: string | null;
  requested_delivery_date: string | null;
  source_message: string | null;
  notes: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  rejection_reason: string | null;
  invoice_number: string | null;
  invoice_file_path: string | null;
  invoiced_at: string | null;
  remission_number: string | null;
  remitted_at: string | null;
  dispatch_guide: string | null;
  dispatch_file_path: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  novelty_reason: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  action: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface AppData {
  profiles: Profile[];
  customers: Customer[];
  contacts: Contact[];
  products: Product[];
  customerProductPrices: CustomerProductPrice[];
  orders: Order[];
  orderItems: OrderItem[];
  events: OrderEvent[];
}
