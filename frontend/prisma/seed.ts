import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error(
      'seed.ts menghapus SELURUH data dan membuat kredensial default — tidak boleh dijalankan di production. ' +
      'Set ALLOW_PROD_SEED=true secara eksplisit jika ini benar-benar disengaja.'
    )
  }

  console.log('Seeding SaaS database...')

  // 1. Bersihkan database
  await prisma.auditItem.deleteMany()
  await prisma.audit.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.correction.deleteMany()
  await prisma.deadlineAlert.deleteMany()
  await prisma.notificationEvent.deleteMany()
  await prisma.pickupRecord.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.storageItem.deleteMany()
  await prisma.storageLocation.deleteMany()
  await prisma.finishingJob.deleteMany()
  await prisma.qcRecord.deleteMany()
  await prisma.designVersion.deleteMany()
  await prisma.designJob.deleteMany()
  await prisma.retailStockMovement.deleteMany()
  await prisma.retailProduct.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.materialMovement.deleteMany()
  await prisma.machineMaterial.deleteMany()
  await prisma.material.deleteMany()
  await prisma.machine.deleteMany()
  await prisma.product.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.attendanceRecord.deleteMany()
  await prisma.attendanceImport.deleteMany()
  
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()
  
  await prisma.onboardingStep.deleteMany()
  await prisma.tenantAuditLog.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.tenantSubscription.deleteMany()
  await prisma.subscriptionPlan.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.superAdmin.deleteMany()

  // 2. Buat Super Admin
  // Kata sandi default hanya untuk dev/staging lokal — override via env di lingkungan lain.
  const seedAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || 'superadmin123'
  const hashedAdminPassword = await bcrypt.hash(seedAdminPassword, 10)
  const superAdmin = await prisma.superAdmin.create({
    data: {
      name: 'Super Admin',
      email: process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@printpilot.id',
      password_hash: hashedAdminPassword,
      role: 'SUPER_ADMIN'
    }
  })

  // 3. Buat Subscription Plans
  const planStarter = await prisma.subscriptionPlan.create({
    data: {
      name: 'Starter',
      slug: 'starter',
      price_monthly: 299000,
      max_users: 5,
      max_orders_per_month: 200,
      features_json: JSON.stringify(['dashboard', 'kanban', 'qc'])
    }
  })

  // 4. Buat Tenant Pertama (Dummy)
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Maju Jaya Print',
      slug: 'majujayaprint',
      plan: 'STARTER',
      status: 'ACTIVE',
      owner_name: 'Hendra',
      owner_phone: '081234567890'
    }
  })

  // Langganan Tenant
  await prisma.tenantSubscription.create({
    data: {
      tenant_id: tenant1.id,
      plan_id: planStarter.id,
      status: 'ACTIVE',
      started_at: new Date()
    }
  })

  // 5. Buat Roles (Default)
  const roleNames = ['owner', 'admin', 'designer_sales', 'operator', 'gudang']
  const roles = await Promise.all(
    roleNames.map(name => prisma.role.create({ data: { name } }))
  )
  
  const getRoleId = (name: string) => roles.find(r => r.name === name)!.id

  // 6. Buat Users untuk Tenant 1
  const defaultPassword = await bcrypt.hash('password123', 10)
  
  const usersToCreate = [
    { username: 'hendra_owner', email: 'owner@majujaya.com', name: 'Hendra', role: 'owner' },
    { username: 'gunawan_admin', email: 'gunawan@majujaya.com', name: 'Gunawan', role: 'admin' },
    { username: 'rere_admin', email: 'admin@majujaya.com', name: 'Rere', role: 'admin' },
    { username: 'ayu_desain', email: 'desain@majujaya.com', name: 'Ayu', role: 'designer_sales' },
    { username: 'budi_print', email: 'print@majujaya.com', name: 'Budi', role: 'operator' },
    { username: 'fajar_gudang', email: 'gudang@majujaya.com', name: 'Fajar', role: 'gudang' }
  ]

  for (const u of usersToCreate) {
    await prisma.user.create({
      data: {
        tenant_id: tenant1.id,
        username: u.username,
        email: u.email,
        name: u.name,
        password_hash: defaultPassword,
        role_id: getRoleId(u.role)
      }
    })
  }

  // 7. Buat Produk Cetak (Printing)
  const products = [
    { name: 'Kartu Nama 2 Sisi', category: 'KERTAS' },
    { name: 'Brosur A4 Lipat 3', category: 'KERTAS' },
    { name: 'Spanduk Outdoor', category: 'OUTDOOR' },
    { name: 'Stiker Vinyl A3', category: 'INDOOR' },
    { name: 'Lanyard Custom', category: 'MERCHANDISE' },
  ]

  for (const p of products) {
    await prisma.product.create({
      data: {
        tenant_id: tenant1.id,
        name: p.name,
        category: p.category,
        active: true
      }
    })
  }

  // 8. Buat Produk Retail (Eceran)
  const retailProducts = [
    { name: 'Lakban Bening', sku: 'RET-001', category: 'STATIONERY', price: 15000, stock: 50 },
    { name: 'Double Tape 3M', sku: 'RET-002', category: 'STATIONERY', price: 25000, stock: 30 },
    { name: 'Tinta Printer A', sku: 'RET-003', category: 'CONSUMABLES', price: 75000, stock: 20 },
  ]

  for (const rp of retailProducts) {
    await prisma.retailProduct.create({
      data: {
        tenant_id: tenant1.id,
        name: rp.name,
        sku: rp.sku,
        category: rp.category,
        price: rp.price,
        stock_quantity: rp.stock,
        min_stock: 5,
        active: true
      }
    })
  }

  // 9. Buat Lokasi Rak Gudang (LT3 + Counter LT1) — layout standar 09-STORAGE.md
  const storageLayout = [
    { zone: 'A', floor: 3, racks: 3, slots: 4, capacityMax: 3 },       // banner/spanduk
    { zone: 'B', floor: 3, racks: 2, slots: 4, capacityMax: 6 },       // stiker/kartu
    { zone: 'C', floor: 3, racks: 1, slots: 4, capacityMax: 2 },       // packaging
    { zone: 'D', floor: 3, racks: 1, slots: 2, capacityMax: 20 },      // holding
    { zone: 'COUNTER', floor: 1, racks: 1, slots: 3, capacityMax: 10 },// counter LT1
  ]
  const storageRows: any[] = []
  for (const g of storageLayout) {
    for (let r = 1; r <= g.racks; r++) {
      for (let s = 1; s <= g.slots; s++) {
        const rack = g.zone === 'COUNTER' ? null : String(r).padStart(2, '0')
        const slot = String(s).padStart(2, '0')
        const code = ['LT' + g.floor, g.zone, rack, slot].filter(Boolean).join('-')
        storageRows.push({
          tenant_id: tenant1.id,
          location_code: code,
          name: `Lantai ${g.floor} Zona ${g.zone}${rack ? ' Rak ' + rack : ''} Slot ${slot}`,
          floor: g.floor,
          zone: g.zone,
          rack,
          slot,
          capacity_max: g.capacityMax,
          qr_code_value: 'LOC:' + code,
        })
      }
    }
  }
  await prisma.storageLocation.createMany({ data: storageRows })
  console.log(`✅ ${storageRows.length} lokasi rak dibuat`)

  console.log('✅ Seeding completed! Created tenant: majujayaprint.printpilot.id')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
