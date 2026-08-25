import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  orderType: string; // 'Walk-in' | 'Online' | 'Makloon'
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

export interface ProductVariant {
  name: string;
  price: number;
}

export interface ProductFinishing {
  name: string;
  price: number;
  type: 'per_m2' | 'per_pcs' | 'flat';
}

export interface PrintingProduct {
  id: string;
  label: string;
  value: string;
  basePrice: number;
  unit: string;
  variants: ProductVariant[];
  finishings: ProductFinishing[];
}

export type LogType = "MATERIAL_CUT" | "PRODUCTION_WASTE" | "GENERAL";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: "Umum" | "Makloon" | "B2B";
  defaultDiscountRp: number;
  joinDate: string;
}

export interface ActivityLog {
  id: string;
  type: LogType;
  title: string;
  description: string;
  operator: string;
  createdAt: string;
}

// ─── Store Interface ──────────────────────────────────────────────────────────
interface WorkflowState {
  orders: Order[];
  jobs: Job[];
  inventory: InventoryItem[];
  retailProducts: RetailProduct[];
  printingProducts: PrintingProduct[];
  customers: Customer[];

  // Customer actions
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Order actions
  addOrderAndJob: (order: Order, job: Job) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  processPayment: (orderId: string, amount: number, method: string) => void;

  // Job actions
  updateJobStatus: (jobId: string, newStatus: JobStatus) => void;

  // Inventory
  deductInventory: (material: string, usedAmount: number) => void;
  splitRollMaterial: (sourceMaterialId: string, targetMaterialId: string, sourceQty: number, yieldQty: number) => void;

  // Retail products
  addRetailProduct: (product: RetailProduct) => void;
  deductRetailStock: (productId: string, qty: number) => void;

  // Printing products
  addPrintingProduct: (product: PrintingProduct) => void;
  updatePrintingProduct: (id: string, updates: Partial<PrintingProduct>) => void;

  // Logs
  logs: ActivityLog[];
  addLog: (log: Omit<ActivityLog, "id" | "createdAt">) => void;
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
    orderType: "Online", productId: "brosur", product: "Brosur A5", qty: 1000,
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
    orderType: "Online", productId: "x-banner", product: "X-Banner", qty: 3,
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
  { id: "flexi-china-3m", name: "Flexi China 3m", stock: 5, unit: "roll" },
  { id: "flexi-china-150", name: "Flexi China 1.5m", stock: 2, unit: "roll" },
  { id: "flexi-korea-3m", name: "Flexi Korea 3m", stock: 3, unit: "roll" },
  { id: "flexi-korea-150", name: "Flexi Korea 1.5m", stock: 0, unit: "roll" },
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

const INITIAL_CUSTOMERS: Customer[] = [
  { id: "CUST-001", name: "Budi (Makloon A)", phone: "08123456789", type: "Makloon", defaultDiscountRp: 50000, joinDate: "2026-08-20" },
  { id: "CUST-002", name: "PT. Maju Jaya", phone: "08987654321", type: "B2B", defaultDiscountRp: 100000, joinDate: "2026-08-21" },
];

const INITIAL_PRINTING_PRODUCTS: PrintingProduct[] = [
  { 
    id: "PR-1", label: "Banner Indoor", value: "banner-indoor", basePrice: 25000, unit: "m2",
    variants: [
      { name: "Albatros", price: 25000 },
      { name: "Luster", price: 30000 },
    ],
    finishings: [
      { name: "Mata Ayam", price: 0, type: "per_pcs" },
      { name: "Laminasi Glossy", price: 5000, type: "per_m2" },
      { name: "Laminasi Matte", price: 5000, type: "per_m2" }
    ]
  },
  { 
    id: "PR-2", label: "Banner Outdoor", value: "banner-outdoor", basePrice: 15000, unit: "m2",
    variants: [
      { name: "Flexi China 280gr", price: 15000 },
      { name: "Flexi Korea 440gr", price: 25000 },
    ],
    finishings: [
      { name: "Mata Ayam", price: 0, type: "per_pcs" },
      { name: "Lipat Lem", price: 0, type: "flat" },
      { name: "Selongsong", price: 0, type: "flat" }
    ]
  },
  { 
    id: "PR-3", label: "Stiker Cutting", value: "stiker-cutting", basePrice: 65000, unit: "m2",
    variants: [{ name: "Vinyl Oracal", price: 65000 }],
    finishings: [{ name: "Cutting Kontur", price: 0, type: "flat" }]
  },
  { 
    id: "PR-4", label: "Stiker Printing", value: "stiker-print", basePrice: 70000, unit: "m2",
    variants: [
      { name: "Vinyl Glossy", price: 70000 },
      { name: "Vinyl Matte", price: 70000 }
    ],
    finishings: [
      { name: "Laminasi Glossy", price: 10000, type: "per_m2" },
      { name: "Cutting Kontur", price: 15000, type: "per_m2" }
    ]
  },
  { 
    id: "PR-5", label: "Kartu Nama", value: "kartu-nama", basePrice: 25000, unit: "box",
    variants: [{ name: "ArtCarton 260gr", price: 25000 }],
    finishings: [
      { name: "Laminasi Doff 2 Sisi", price: 10000, type: "per_pcs" },
      { name: "Laminasi Glossy 2 Sisi", price: 10000, type: "per_pcs" },
      { name: "Tanpa Laminasi", price: 0, type: "flat" }
    ]
  },
  { 
    id: "PR-6", label: "Brosur / Flyer", value: "brosur", basePrice: 250000, unit: "rim",
    variants: [{ name: "ArtPaper 120gr", price: 250000 }, { name: "ArtPaper 150gr", price: 300000 }],
    finishings: [{ name: "Lipat 3", price: 50000, type: "flat" }]
  },
  { id: "PR-7", label: "Spanduk Kain", value: "spanduk", basePrice: 30000, unit: "m2", variants: [{ name: "TC Import", price: 30000 }], finishings: [{name: "Jahit Tepi", price: 0, type: "flat"}] },
  { id: "PR-8", label: "X-Banner", value: "x-banner", basePrice: 65000, unit: "pcs", variants: [{ name: "Albatros", price: 65000 }, { name: "Flexi China", price: 50000 }], finishings: [{name: "Include Stand", price: 0, type: "flat"}] },
  { id: "PR-9", label: "Roll Banner", value: "roll-banner", basePrice: 150000, unit: "pcs", variants: [{ name: "Albatros", price: 150000 }], finishings: [{name: "Include Stand", price: 0, type: "flat"}] },
  { id: "PR-10", label: "Nota / Invoice", value: "nota", basePrice: 120000, unit: "rim", variants: [{ name: "NCR 2 Ply", price: 120000 }, { name: "NCR 3 Ply", price: 180000 }], finishings: [{name: "Numerator & Porporasi", price: 25000, type: "flat"}] },
];

// ─── Store ────────────────────────────────────────────────────────────────────
export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      orders: INITIAL_ORDERS,
      jobs: INITIAL_JOBS,
      inventory: INITIAL_INVENTORY,
      retailProducts: INITIAL_RETAIL_PRODUCTS,
      printingProducts: INITIAL_PRINTING_PRODUCTS,
      customers: INITIAL_CUSTOMERS,
      logs: [],

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

  splitRollMaterial: (sourceMaterialId, targetMaterialId, sourceQty, yieldQty) =>
    set((state) => {
      const newInventory = [...state.inventory];
      
      const sourceIndex = newInventory.findIndex(i => i.id === sourceMaterialId);
      const targetIndex = newInventory.findIndex(i => i.id === targetMaterialId);
      
      if (sourceIndex >= 0) {
        newInventory[sourceIndex] = { ...newInventory[sourceIndex], stock: Math.max(0, newInventory[sourceIndex].stock - sourceQty) };
      }
      
      if (targetIndex >= 0) {
        newInventory[targetIndex] = { ...newInventory[targetIndex], stock: newInventory[targetIndex].stock + yieldQty };
      }
      
      return { inventory: newInventory };
    }),

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

  updatePrintingProduct: (id, updates) =>
    set((state) => ({
      printingProducts: state.printingProducts.map(p =>
        p.id === id ? { ...p, ...updates } : p
      )
    })),

  addPrintingProduct: (product) =>
    set((state) => ({
      printingProducts: [...state.printingProducts, product]
    })),

  addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
  
  updateCustomer: (id, updates) => set((state) => ({
    customers: state.customers.map((c) => c.id === id ? { ...c, ...updates } : c)
  })),
  
  deleteCustomer: (id) => set((state) => ({
    customers: state.customers.filter((c) => c.id !== id)
  })),

  addLog: (logData) => 
    set((state) => ({
      logs: [
        {
          ...logData,
          id: `LOG-${Date.now()}`,
          createdAt: new Date().toISOString()
        },
        ...state.logs
      ]
    }))
  }),
  {
    name: 'printpilot-workflow-storage', // name of item in the storage (must be unique)
  }
));
