import { chromium } from '@playwright/test';

// 可重複的本機行動端量測；時間結果不作為 CI 硬門檻。
// Repeatable local mobile measurement; timings are not hard CI thresholds.
const baseUrl = process.argv[2] ?? process.env.SITE_URL ?? 'http://127.0.0.1:4173/';
const profile = {
  name: 'local-fast-3g',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  latencyMs: 150,
  downloadMbps: 1.6,
  uploadKbps: 750,
  cpuThrottle: 4,
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latencyMs,
    downloadThroughput: (profile.downloadMbps * 1024 * 1024) / 8,
    uploadThroughput: (profile.uploadKbps * 1024) / 8,
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
  await page.addInitScript(() => {
    globalThis.__lcp = 0;
    new globalThis.PerformanceObserver((list) => {
      for (const entry of list.getEntries()) globalThis.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const metrics = await page.evaluate(() => {
    const navigation = globalThis.performance.getEntriesByType('navigation')[0];
    const scripts = globalThis.performance
      .getEntriesByType('resource')
      .filter((entry) => entry.initiatorType === 'script')
      .map((entry) => ({
        url: new URL(entry.name).pathname,
        decodedBytes: entry.decodedBodySize,
        encodedBytes: entry.encodedBodySize,
      }));
    return {
      lcpMs: Math.round(globalThis.__lcp * 100) / 100,
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd * 100) / 100,
      loadMs: Math.round(navigation.loadEventEnd * 100) / 100,
      scripts,
      scriptDecodedBytes: scripts.reduce((total, script) => total + script.decodedBytes, 0),
    };
  });
  console.log(
    JSON.stringify(
      { baseUrl, profile, chromium: browser.version(), ...metrics, errors },
      null,
      2,
    ),
  );
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
