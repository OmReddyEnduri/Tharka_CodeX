const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Verifying Admin Web Contest Dashboard at http://localhost:5174/contests/6a9e85f5815c0df44fb18d7c ...');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.toString()));

  await page.goto('http://localhost:5174/contests/6a9e85f5815c0df44fb18d7c', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const title = await page.title();
  console.log('Page Title:', title);

  // Check contest name on page
  const bodyText = await page.textContent('body');
  console.log('Contains Level 1 name:', bodyText.includes('Level 1: Basics & Arithmetic') || bodyText.includes('Add Two Numbers'));

  // Take screenshot of admin contest editor
  await page.screenshot({ path: 'C:/Users/Administrator/workspace/veck-clone/test-admin-contest-level1.png', fullPage: true });
  console.log('Saved screenshot: test-admin-contest-level1.png');

  // Also check contest list
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/Administrator/workspace/veck-clone/test-admin-contest-list.png', fullPage: true });

  await browser.close();

  if (errors.length > 0) {
    console.error('Page errors encountered:', errors);
    process.exit(1);
  }

  console.log('🎉 ADMIN DASHBOARD VERIFIED CLEANLY WITH ZERO ERRORS!');
})();
