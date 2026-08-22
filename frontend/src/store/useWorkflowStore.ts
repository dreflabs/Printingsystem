import { create } from 'zustand';

// ─── Status Types ─────────────────────────────────────────────────────────────
export type JobStatus = 
  | "WAITING_DESIGN" 
  | "DESIGN_REVIEW" 
  | "WAITING_PRINT" 
  | "PRINTING" 
  | "WAITING_QC" 
  | "QC_PASSED" 
  | "QC_FAILED" 
  | "WAITING_FINISHING" 
  | "FINISHING" 
  | "WAITING_WAREHOUSE" 
  | "STORED"
  | "PICKED_UP";

export type OrderStatus =
  | "DRAFT"
  | "DESIGNING"
  | "DESIGN_REVIEW"
  | "WAITING_PAYMENT"
  | "PRODUCTION_STARTED"
  | "PRODUCTION_DONE"
  | "QC_PASSED"
  | "QC_FAILED"
  | "FINISHING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "OVERDUE"
  | "CLOSED";

export type PaymentStatus = "UNPAID" | "DP_PAID" | "PAID";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: string; // 'Walk-in' | 'WhatsApp' | 'Makloon'
  productId: string;
  product: string;
  qty: number;
  material: string;
  finishing: string;
  notes: string;
  deadline: string;
  totalPrice: string;
  dpAmount: string;
  dpMethod: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  createdBy: string;
  overdue: boolean;
}

export interface Job {
  id: string;
  orderId: string;
  product: string;
  qty: number;
  material: string;
  finishing: string;
  width?: number;
  height?: number;
  status: JobStatus;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  unit: string;
}

export interface RetailProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  cogs: number;
  price: number;
  stock: number;
  minStock: number;
}

// ─── Store Interface ──────────────────────────────────────────────────────────
interface WorkflowState {
  orders: Order[];
  jobs: Job[];
  inventory: InventoryItem[];
  retailProducts: RetailProduct[];

  // Order actions
  addOrderAndJob: (order: Order, job: Job) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  processPayment: (orderId: string, amount: number, method: string) => void;

  // Job actions
  updateJobStatus: (jobId: string, newStatus: JobStatus) => void;

  // Inventory
  deductInventory: (material: string, usedAmount: number) => void;

  // Retail products
  addRetailProduct: (product: RetailProduct) => void;
  deductRetailStock: (productId: string, qty: number) => void;
}

// ─── Initial Data (Seed) ─────────────────────────────────────────────────────
const INITIAL_ORDERS: Order[] = [
  {
    id: "ORD-20260820-0024", customerName: "Dewi Kusuma", customerPhone: "081234567001",
    orderType: "Walk-in", productId: "banner-indoor", product: "Banner Indoor", qty: 2,
    material: "Flexi China", finishing: "Mata Ayam", notes: "Warna dominan merah",
    deadline: "2026-08-22", totalPrice: "750000", dpAmount: "0", dpMethod: "",
    status: "DESIGNING", paymentStatus: "UNPAID", createdAt: new Date().toISOString(), createdBy: "Admin Rere", overdue: false
  },
  {
    id: "ORD-20260820-0023", customerName: "Budi Santoso", customerPhone: "081234567002",
    orderType: "WhatsApp", productId: "brosur", product: "Brosur A5", qty: 1000,
    material: "ArtPaper 120g", finishing: "Lipat", notes: "",
    deadline: "2026-08-20", totalPrice: "450000", dpAmount: "450000", dpMethod: "Transfer",
    status: "READY_FOR_PICKUP", paymentStatus: "PAID", createdAt: new Date().toISOString(), createdBy: "Admin Rere", overdue: false
  },
  {
    id: "ORD-20260820-0021", customerName: "PT Abadi Makmur", customerPhone: "081234567003",
    orderType: "Makloon", productId: "spanduk", product: "Spanduk Kain", qty: 5,
    material: "Flexi Korea", finishing: "Jahit Tepi", notes: "Logo sudah di-ACC",
    deadline: "2026-08-19", totalPrice: "3500000", dpAmount: "1750000", dpMethod: "Transfer",
    status: "PRODUCTION_STARTED", paymentStatus: "DP_PAID", createdAt: new Date().toISOString(), createdBy: "Designer Ayu", overdue: true
  },
  {
    id: "ORD-20260820-0019", customerName: "CV Maju Jaya", customerPhone: "081234567004",
    orderType: "Walk-in", productId: "kartu-nama", product: "Kartu Nama", qty: 500,
    material: "ArtPaper 260g", finishing: "Laminasi Doff", notes: "",
    deadline: "2026-08-20", totalPrice: "1200000", dpAmount: "1200000", dpMethod: "Cash",
    status: "READY_FOR_PICKUP", paymentStatus: "PAID", createdAt: new Date().toISOString(), createdBy: "Admin Rere", overdue: false
  },
  {
    id: "ORD-20260819-0055", customerName: "Rizky Pratama", customerPhone: "081234567005",
    orderType: "WhatsApp", productId: "x-banner", product: "X-Banner", qty: 3,
    material: "Albatros", finishing: "Dengan Stand", notes: "",
    deadline: "2026-08-21", totalPrice: "620000", dpAmount: "0", dpMethod: "",
    status: "WAITING_PAYMENT", paymentStatus: "UNPAID", createdAt: new Date().toISOString(), createdBy: "Admin Rere", overdue: false
  },
  {
    id: "ORD-20260819-0051", customerName: "Toko Sari Rasa", customerPhone: "081234567006",
    orderType: "Walk-in", productId: "nota", product: "Nota / Invoice", qty: 10,
    material: "-", finishing: "Staples", notes: "",
    deadline: "2026-08-19", totalPrice: "280000", dpAmount: "280000", dpMethod: "Cash",
    status: "PICKED_UP", paymentStatus: "PAID", createdAt: new Date().toISOString(), createdBy: "Admin Rere", overdue: false
  },
];

const INITIAL_JOBS: Job[] = [
  { id: "JOB-001", orderId: "ORD-20260820-0024", product: "Banner Indoor", qty: 2, material: "Flexi China", finishing: "Mata Ayam", width: 200, height: 100, status: "WAITING_DESIGN", createdAt: new Date().toISOString() },
  { id: "JOB-002", orderId: "ORD-20260820-0021", product: "Spanduk Kain", qty: 5, material: "Flexi Korea", finishing: "Jahit Tepi", status: "PRINTING", createdAt: new Date().toISOString() },
  { id: "JOB-003", orderId: "ORD-20260820-0023", product: "Brosur A5", qty: 1000, material: "ArtPaper 120g", finishing: "Lipat", status: "STORED", createdAt: new Date().toISOString() },
  { id: "JOB-004", orderId: "ORD-20260820-0019", product: "Kartu Nama", qty: 500, material: "ArtPaper 260g", finishing: "Laminasi Doff", status: "STORED", createdAt: new Date().toISOString() },
];

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: "flexi-china", name: "Flexi China 280g", stock: 150, unit: "meter" },
  { id: "flexi-korea", name: "Flexi Korea 440g", stock: 80, unit: "meter" },
  { id: "vinyl", name: "Stiker Vinyl", stock: 50, unit: "meter" },
  { id: "artpaper-120", name: "ArtPaper 120g", stock: 5000, unit: "lembar" },
];

const INITIAL_RETAIL_PRODUCTS: RetailProduct[] = [
  { id: "P001", sku: "P-KRT-001", name: "Kertas HVS A4 80gr", category: "Kertas", cogs: 45000, price: 55000, stock: 120, minStock: 20 },
  { id: "P002", sku: "P-TNT-001", name: "Tinta Printer Epson T664 Black", category: "Tinta", cogs: 70000, price: 85000, stock: 45, minStock: 10 },
  { id: "P003", sku: "P-ALT-001", name: "Pulpen Kenko Gel", category: "Alat Tulis", cogs: 2000, price: 3000, stock: 300, minStock: 50 },
  { id: "P004", sku: "P-ALT-002", name: "Buku Tulis Sidu 58 Lembar", category: "Alat Tulis", cogs: 35000, price: 45000, stock: 0, minStock: 15 },
  { id: "P005", sku: "P-KRT-002", name: "Kertas Foto Glossy A4", category: "Kertas", cogs: 25000, price: 35000, stock: 25, minStock: 10 },
  { id: "P006", sku: "P-TNT-002", name: "Tinta Printer Epson T664 Cyan", category: "Tinta", cogs: 70000, price: 85000, stock: 12, minStock: 10 },
  { id: "P007", sku: "P-MRC-001", name: "Mug Polos Putih (Coating)", category: "Merchandise", cogs: 8000, price: 12000, stock: 150, minStock: 20 },
  { id: "P008", sku: "P-MRC-002", name: "Pin Gantungan Kunci 44mm", category: "Merchandise", cogs: 1500, price: 2500, stock: 500, minStock: 50 },
];

// ─── Store ────────────────────────────────────────────────────────────────────
export const useWorkflowStore = create<WorkflowState>((set) => ({
  orders: INITIAL_ORDERS,
  jobs: INITIAL_JOBS,
  inventory: INITIAL_INVENTORY,
  retailProducts: INITIAL_RETAIL_PRODUCTS,

  addOrderAndJob: (order, job) =>
    set((state) => ({
      orders: [order, ...state.orders],
      jobs: [job, ...state.jobs]
    })),

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map(o =>
        o.id === orderId ? { ...o, status, overdue: status === "OVERDUE" } : o
      )
    })),

  processPayment: (orderId, amount, _method) =>
    set((state) => ({
      orders: state.orders.map(o => {
        if (o.id !== orderId) return o;
        const totalNum = Number(o.totalPrice);
        const newDp = Math.min(Number(o.dpAmount) + amount, totalNum);
        const isLunas = newDp >= totalNum;
        return {
          ...o,
          dpAmount: newDp.toString(),
          paymentStatus: isLunas ? "PAID" : "DP_PAID",
          status: isLunas && o.status === "WAITING_PAYMENT" ? "DESIGNING" : o.status,
        };
      })
    })),

  updateJobStatus: (jobId, newStatus) =>
    set((state) => ({
      jobs: state.jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j)
    })),

  deductInventory: (material, usedAmount) =>
    set((state) => ({
      inventory: state.inventory.map(inv =>
        inv.name.toLowerCase().includes(material.toLowerCase()) || inv.id === material
          ? { ...inv, stock: Math.max(0, inv.stock - usedAmount) }
          : inv
      )
    })),

  addRetailProduct: (product) =>
    set((state) => ({
      retailProducts: [product, ...state.retailProducts]
    })),

  deductRetailStock: (productId, qty) =>
    set((state) => ({
      retailProducts: state.retailProducts.map(p =>
        p.id === productId ? { ...p, stock: Math.max(0, p.stock - qty) } : p
      )
    })),
}));
