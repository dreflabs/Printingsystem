const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport to 1080p desktop
  await page.setViewport({ width: 1920, height: 1080 });

  const routes = [
    { name: '01-Login', url: 'http://localhost:3000/login' },
    { name: '02-Admin-Dashboard', url: 'http://localhost:3000/admin' },
    { name: '03-Admin-Reports', url: 'http://localhost:3000/admin/reports' },
    { name: '04-POS-Kasir', url: 'http://localhost:3000/pos' },
    { name: '05-Desain', url: 'http://localhost:3000/designer' },
    { name: '06-Operator', url: 'http://localhost:3000/operator' },
    { name: '07-QC', url: 'http://localhost:3000/qc' },
    { name: '08-Warehouse', url: 'http://localhost:3000/warehouse' },
    { name: '09-Scan', url: 'http://localhost:3000/scan' }
  ];

  console.log('Mulai mengambil screenshot...');

  for (const route of routes) {
    console.log(`Mengambil screenshot untuk: ${route.name}`);
    try {
      await page.goto(route.url, { waitUntil: 'networkidle0', timeout: 15000 });
      // Wait an extra second for animations to settle
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(screenshotDir, `${route.name}.png`), fullPage: true });
      console.log(`✅ Berhasil: ${route.name}.png`);
    } catch (e) {
      console.log(`❌ Gagal untuk ${route.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Selesai! Semua screenshot tersimpan di folder "screenshots"');
}

captureScreenshots();
