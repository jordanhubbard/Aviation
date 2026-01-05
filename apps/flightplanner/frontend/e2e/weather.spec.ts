import { expect, test } from '@playwright/test'

test('view weather and recommendations', async ({ page }) => {
  await page.route('**/api/weather/KSFO/recommendations*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        airport: 'KSFO',
        current_category: 'VFR',
        recommendation: 'VFR conditions. Routine VFR flight should be feasible.',
        warnings: [],
        best_departure_windows: [
          {
            start_time: '2025-01-01T00:00',
            end_time: '2025-01-01T02:00',
            score: 400,
            flight_category: 'VFR',
          },
        ],
      }),
    })
  })

  await page.route('**/api/weather/KSFO', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        airport: 'KSFO',
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

  await page.goto('/weather')

  await page.getByLabel('Airport Code').fill('KSFO')
  await page.getByRole('button', { name: 'Get Weather' }).click()

  await expect(page.getByRole('heading', { name: /Current Weather - KSFO/i })).toBeVisible()
  await expect(page.getByText(/Flight category: VFR/i)).toBeVisible()
  await expect(page.getByText(/Suggested departure windows/i)).toBeVisible()
})
