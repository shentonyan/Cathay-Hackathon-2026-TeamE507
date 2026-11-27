import { expect, test } from '@playwright/test';
import {
  DEFERRED_GROUPS,
  MAX_INITIAL_JS_BYTES,
} from '../../scripts/site/check-site-js.mjs';

const lazyFiles = Object.values(DEFERRED_GROUPS).flat();
const charts = DEFERRED_GROUPS.charts;
const twin = DEFERRED_GROUPS.twin;
const formulas = DEFERRED_GROUPS.model[0];
const views = [
  ['overview', '#ovHead h1'],
  ['plan', '#gantt .gr'],
  ['twin', '#twCanvas canvas'],
  ['line', '#lineSum .ls'],
  ['carbon', '#cbHead h1'],
  ['model', '#mdJoint .eqr'],
];

function watch(page, baseURL) {
  const observation = {
    requests: [],
    external: [],
    errors: [],
    badResponses: [],
  };
  const origin = new URL(baseURL).origin;
  page.on('request', (request) => {
    observation.requests.push(request.url());
    if (new URL(request.url()).origin !== origin) {
      observation.external.push(request.url());
    }
  });
  page.on('pageerror', (error) => observation.errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') observation.errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      observation.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return observation;
}

function requestCount(observation, file) {
  return observation.requests.filter((url) =>
    new URL(url).pathname.endsWith(file),
  ).length;
}

function expectLazyAbsent(observation, files = lazyFiles) {
  for (const file of files)
    expect(requestCount(observation, file), file).toBe(0);
}

function expectLoadedOnce(observation) {
  for (const file of lazyFiles) {
    expect(requestCount(observation, file), file).toBe(1);
  }
}

function expectClean(observation) {
  expect(observation.errors).toEqual([]);
  expect(observation.external).toEqual([]);
  expect(observation.badResponses).toEqual([]);
}

async function openSignedOut(page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#gate')).toHaveClass(/on/);
  await expect(page.locator('.nav[data-v]')).toHaveCount(6);
}

async function loginPlanner(page) {
  await page.locator('#gUser').fill('demo2');
  await page.locator('#gPass').fill('demo');
  await page.locator('#gLogin').click();
  await expect(page.locator('#gate')).not.toHaveClass(/on/);
}

async function expectFitsViewport(page) {
  const fits = await page.evaluate(
    () =>
      globalThis.document.documentElement.scrollWidth <=
      globalThis.innerWidth + 1,
  );
  expect(fits).toBe(true);
}

async function visit(page, id, content) {
  await page.locator(`.nav[data-v="${id}"]`).click();
  await expect(page.locator(`#v-${id}`)).toHaveClass(/on/);
  await expect(page.locator(content).first()).toBeVisible();
  await expectFitsViewport(page);
}

test('首載與六個頁面按需載入 / initial shell and all six lazy sections', async ({
  page,
  baseURL,
}) => {
  const observation = watch(page, baseURL);
  await openSignedOut(page);
  expectLazyAbsent(observation);
  await expectFitsViewport(page);
  expect(
    await page.evaluate(() =>
      ['Highcharts', 'THREE', 'MODEL9', 'TWX_make'].map(
        (name) => typeof globalThis[name],
      ),
    ),
  ).toEqual(['undefined', 'undefined', 'undefined', 'undefined']);
  const initialBytes = await page.evaluate(() =>
    globalThis.performance
      .getEntriesByType('resource')
      .filter((entry) => entry.initiatorType === 'script')
      .reduce((total, entry) => total + entry.decodedBodySize, 0),
  );
  expect(initialBytes).toBeLessThanOrEqual(MAX_INITIAL_JS_BYTES);

  await loginPlanner(page);
  await expect(page.locator('#ovHead h1')).toBeVisible();
  await expect(page.locator('#ovCost svg').first()).toBeVisible();
  for (const file of charts) expect(requestCount(observation, file)).toBe(1);
  expectLazyAbsent(observation, [...twin, formulas]);
  await expectFitsViewport(page);

  await visit(page, 'plan', '#gantt .gr');
  await expect(page.locator('#rlChart svg').first()).toBeVisible();
  await page.locator('#gantt .gr').first().click();
  await expect(page.locator('#dTitle')).not.toBeEmpty();

  await visit(page, 'line', '#lineSum .ls');
  await page.locator('#lineCard [data-a="accept"]').click();
  await page.locator('#lineCard [data-a="start"]').click();
  const checks = page.locator('#lineCard .chk input');
  for (let index = 0; index < (await checks.count()); index++) {
    await checks.nth(index).check();
  }
  await page.locator('#lineCard [data-a="done"]').click();
  await page.locator('#lineSeg [data-f="done"]').click();
  await expect(page.locator('#lineCard .ok-badge')).toBeVisible();

  await visit(page, 'carbon', '#cbHead h1');
  await expect(page.locator('#cbChart svg').first()).toBeVisible();
  await page.locator('#cbRealization').selectOption('0.75');
  await expect(page.locator('#cbRealization')).toHaveValue('0.75');

  await visit(page, 'model', '#mdJoint .eqr');
  await expect(page.locator('#mdScatter svg').first()).toBeVisible();
  expect(requestCount(observation, formulas)).toBe(1);
  expectLazyAbsent(observation, twin);

  await visit(page, 'twin', '#twCanvas canvas');
  expect(requestCount(observation, twin[0])).toBe(1);
  expect(requestCount(observation, twin[1])).toBe(1);
  const distance = await page.evaluate(() => globalThis.__app.TWR.cam.tDist);
  await page.locator('#twZoomIn').click();
  expect(
    await page.evaluate(() => globalThis.__app.TWR.cam.tDist),
  ).toBeLessThan(distance);
  await page.locator('#twReset').click();

  for (const [id, content] of views) await visit(page, id, content);
  expectLoadedOnce(observation);
  const firstChart = observation.requests.findIndex((url) =>
    url.endsWith(charts[0]),
  );
  const secondChart = observation.requests.findIndex((url) =>
    url.endsWith(charts[1]),
  );
  const firstTwin = observation.requests.findIndex((url) =>
    url.endsWith(twin[0]),
  );
  const secondTwin = observation.requests.findIndex((url) =>
    url.endsWith(twin[1]),
  );
  expect(firstChart).toBeGreaterThanOrEqual(0);
  expect(firstChart).toBeLessThan(secondChart);
  expect(firstTwin).toBeGreaterThanOrEqual(0);
  expect(firstTwin).toBeLessThan(secondTwin);
  expectClean(observation);
});

test('並行與重複啟用不重複下載 / concurrent activation deduplicates', async ({
  page,
  baseURL,
}) => {
  const observation = watch(page, baseURL);
  await openSignedOut(page);
  expectLazyAbsent(observation);
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(`**/${charts[1]}`, async (route) => {
    await blocked;
    await route.continue();
  });
  const secondChartRequest = page.waitForRequest((request) =>
    request.url().endsWith(charts[1]),
  );
  await loginPlanner(page);
  await secondChartRequest;
  try {
    const activations = page.evaluate(() =>
      Promise.all([
        globalThis.__app.showView('plan'),
        globalThis.__app.showView('carbon'),
        globalThis.__app.showView('overview'),
      ]),
    );
    await expect.poll(() => requestCount(observation, charts[0])).toBe(1);
    await expect.poll(() => requestCount(observation, charts[1])).toBe(1);
    release();
    await activations;
  } finally {
    release();
  }
  await expect(page.locator('#ovHead h1')).toBeVisible();
  await visit(page, 'plan', '#gantt .gr');
  await visit(page, 'carbon', '#cbHead h1');
  await visit(page, 'overview', '#ovHead h1');
  for (const file of charts) expect(requestCount(observation, file)).toBe(1);
  expectLazyAbsent(observation, [...twin, formulas]);
  expectClean(observation);
});

test('載入失敗有可見提示並可重試 / lazy-load failure is visible and retryable', async ({
  page,
  baseURL,
}) => {
  const observation = watch(page, baseURL);
  await openSignedOut(page);
  let fail = true;
  await page.route(`**/${charts[0]}`, async (route) => {
    if (fail) await route.abort('failed');
    else await route.continue();
  });
  await loginPlanner(page);
  await expect(page.locator('#viewLoad')).toHaveClass(/failed/);
  await expect(page.locator('#viewLoadText')).toContainText('資源載入失敗');
  await expect(page.locator('#viewLoadRetry')).toBeVisible();
  await expect.poll(() => observation.errors.length).toBeGreaterThan(0);
  const expectedErrors = [...observation.errors];
  expect(expectedErrors.join('\n')).toMatch(/載入失敗|Failed to load resource/);
  observation.errors.length = 0;

  fail = false;
  await page.locator('#viewLoadRetry').click();
  await expect(page.locator('#viewLoad')).toBeHidden();
  await expect(page.locator('#ovHead h1')).toBeVisible();
  expect(requestCount(observation, charts[0])).toBe(2);
  expect(requestCount(observation, charts[1])).toBe(1);
  await visit(page, 'plan', '#gantt .gr');
  await visit(page, 'overview', '#ovHead h1');
  expect(requestCount(observation, charts[0])).toBe(2);
  expect(requestCount(observation, charts[1])).toBe(1);
  expectClean(observation);
});
