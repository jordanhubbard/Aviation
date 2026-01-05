import { expect, test } from '@playwright/test'

test('plan a route and a local flight', async ({ page }) => {
  test.setTimeout(120_000)

  await page.route(/\/api\/weather\/.+/, async (route) => {
    const url = route.request().url()
    if (url.includes('/forecast') || url.includes('/recommendations')) return route.fallback()

    const code = url.split('/weather/')[1]?.split(/[/?#]/)[0] || 'TEST'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        airport: code.toUpperCase(),
        conditions: 'Clear',
        temperature: 70,
        wind_speed: 5,
        wind_direction: 270,
        visibility: 10,
        ceiling: 10000,
        metar: '',
        flight_category: 'VFR',
        recommendation: 'VFR conditions.',
        warnings: [],
      }),
    })
  })

  await page.route('**/api/weather/**/forecast*', async (route) => {
    const airport = route.request().url().split('/weather/')[1]?.split('/')[0] || 'TEST'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        airport: airport.toUpperCase(),
        days: 3,
        daily: [
          {
            date: '2025-01-01',
            temp_max_f: 70,
            temp_min_f: 55,
            precipitation_mm: 0,
            wind_speed_max_kt: 10,
          },
          {
            date: '2025-01-02',
            temp_max_f: 68,
            temp_min_f: 54,
            precipitation_mm: 0,
            wind_speed_max_kt: 12,
          },
          {
            date: '2025-01-03',
            temp_max_f: 65,
            temp_min_f: 52,
            precipitation_mm: 0,
            wind_speed_max_kt: 15,
          },
        ],
      }),
    })
  })

  await page.route('**/api/terrain/profile*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        points: [
          { distance_nm: 0, elevation_ft: 0 },
          { distance_nm: 10, elevation_ft: 100 },
        ],
        max_elevation_ft: 100,
      }),
    })
  })

  await page.goto('/')

  const routePlanResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/plan') && resp.request().method() === 'POST',
    { timeout: 60_000 },
  )

  await page.getByLabel('Origin').fill('KSFO')
  await page.getByLabel('Destination').fill('KOAK')
  await page.getByRole('button', { name: 'Plan Route' }).click()

  const routePlanResponse = await routePlanResponsePromise
  const routePlanRequestBody = routePlanResponse.request().postDataJSON() as {
    mode?: string
  } | null
  expect(routePlanRequestBody?.mode).toBe('route')
  expect(routePlanResponse.status()).toBe(200)

  await expect(page.getByRole('heading', { name: 'Route Results' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Route:\s+KSFO/)).toBeVisible()

  await page.getByRole('button', { name: 'Local Flight' }).click()
  await page.getByRole('combobox', { name: 'Airport' }).fill('KSFO')
  await page.getByLabel('Radius (NM)').fill('25')

  const localPlanResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/plan') && resp.request().method() === 'POST',
    { timeout: 60_000 },
  )

  await page.getByRole('button', { name: 'Plan Local Flight' }).click()

  const localPlanResponse = await localPlanResponsePromise
  const localPlanRequestBody = localPlanResponse.request().postDataJSON() as {
    mode?: string
  } | null
  expect(localPlanRequestBody?.mode).toBe('local')
  expect(localPlanResponse.status()).toBe(200)

  await expect(page.getByRole('heading', { name: 'Local Results' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Center:\s+KSFO/)).toBeVisible()
})
