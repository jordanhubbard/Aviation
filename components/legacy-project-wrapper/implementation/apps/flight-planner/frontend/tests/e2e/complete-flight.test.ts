import { test, expect } from '@playwright/test';

test.describe('Complete Flight Scenarios', () => {
  test('Complete flight from startup to shutdown', async ({ page }) => {
    await page.goto('/');
    // Simulate startup sequence
    await page.getByRole('button', { name: 'Start Simulator' }).click();
    await expect(page.getByText('Simulator Running')).toBeVisible();

    // Simulate shutdown sequence
    await page.getByRole('button', { name: 'Shutdown Simulator' }).click();
    await expect(page.getByText('Simulator Shutdown')).toBeVisible();
  });

  test('Flight plan creation and activation', async ({ page }) => {
    await page.goto('/flight-planner');
    await page.getByLabel('Origin').fill('KSFO');
    await page.getByLabel('Destination').fill('KLAX');
    await page.getByRole('button', { name: 'Plan Route' }).click();
    await expect(page.getByRole('heading', { name: 'Flight Plan Details' })).toBeVisible();
    await page.getByRole('button', { name: 'Load Flight Plan' }).click();
    await expect(page.getByText('Flight Plan Activated')).toBeVisible();
  });

  test('Autopilot mode transitions', async ({ page }) => {
    await page.goto('/simulator');
    await page.getByRole('button', { name: 'Enable Autopilot' }).click();
    await expect(page.getByText('Autopilot Enabled')).toBeVisible();
    await page.getByRole('button', { name: 'Disable Autopilot' }).click();
    await expect(page.getByText('Autopilot Disabled')).toBeVisible();
  });

  test('Emergency procedures', async ({ page }) => {
    await page.goto('/simulator');
    await page.getByRole('button', { name: 'Initiate Emergency' }).click();
    await expect(page.getByText('Emergency Procedures Initiated')).toBeVisible();
    await page.getByRole('button', { name: 'Resolve Emergency' }).click();
    await expect(page.getByText('Emergency Resolved')).toBeVisible();
  });
});