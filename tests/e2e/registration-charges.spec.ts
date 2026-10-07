import { test, expect, Page } from '@playwright/test';

/**
 * Covers the Generate Quote "Registration Charges" override (Other Details).
 *
 * Runs against the real app with a real admin login (set E2E_ADMIN_EMAIL /
 * E2E_ADMIN_PASSWORD in the environment — never commit credentials). The one
 * network call this suite must never let through for real is the `quotes`
 * INSERT, so it's intercepted below and fulfilled with a fake response —
 * everything else (login, buildings, flats) hits the real backend, since the
 * feature under test is purely client-side calculation + display.
 *
 * If the environment's DNS can't resolve *.supabase.co, set
 * E2E_DNS_OVERRIDE="host:ip" (see playwright.config.ts).
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('Generate Quote — Registration Charges override', () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this suite'
  );

  test.beforeEach(async ({ page }) => {
    // Safety net: this suite must never create a real quote record.
    await page.route('**/rest/v1/quotes*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/auth/login');
    await page.locator('#email').fill(ADMIN_EMAIL!);
    await page.locator('#password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin/dashboard', { timeout: 20000 });

    await page.goto('/admin/generate-quote');
  });

  // Radix's role="combobox" trigger doesn't get an accessible *name* from its
  // own text content (combobox isn't in ARIA's name-from-content list), so
  // getByRole(..., { name }) can't find it. Locate structurally instead: each
  // field is a <Label>{text}</Label> followed by the Select trigger in the
  // same wrapper div.
  function fieldCombobox(page: Page, labelText: string) {
    return page.locator('label', { hasText: labelText }).locator('..').getByRole('combobox');
  }

  async function selectBuildingAndFlat(page: Page) {
    await fieldCombobox(page, 'Building').click();
    await page.getByRole('option').first().click();

    // Some buildings require a wing before a flat can be chosen.
    const wingLabel = page.locator('label', { hasText: 'Wing' });
    if (await wingLabel.isVisible().catch(() => false)) {
      await fieldCombobox(page, 'Wing').click();
      await page.getByRole('option').first().click();
    }

    await fieldCombobox(page, 'Flat').click();
    await page.getByRole('option').first().click();
  }

  async function fillRequiredCustomerFields(page: Page) {
    await fieldCombobox(page, 'Title').click();
    await page.getByRole('option', { name: 'Mr.' }).click();

    await fieldCombobox(page, 'Gender').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    await page.locator('#customerName').fill('E2E Test Customer');
    await page.locator('#customerPhone').fill('9999999999');
    await page.locator('#loanAmount').fill('100000');
  }

  async function generateAndReadRegistrationRow(page: Page) {
    await page.getByRole('button', { name: 'Generate Quote' }).click();
    await expect(page.getByText('Quote Preview')).toBeVisible();

    const agreementDt = page.locator('dt', { hasText: 'Agreement Amount:' });
    const agreementText = await agreementDt.locator('xpath=following-sibling::dd[1]').innerText();
    const agreementAmount = Number(agreementText.replace(/[^0-9.]/g, ''));

    const regRow = page.locator('table tr', { hasText: 'Registration' }).first();
    const regLabel = (await regRow.locator('td').first().innerText()).trim();
    const regAmountText = await regRow.locator('td').last().innerText();
    const regAmount = Number(regAmountText.replace(/[^0-9.]/g, ''));

    return { agreementAmount, regLabel, regAmount };
  }

  test('empty override: uses the exact existing Building-level Registration Charges', async ({ page }) => {
    await selectBuildingAndFlat(page);
    await fillRequiredCustomerFields(page);
    // Registration Charges left blank intentionally.

    const { agreementAmount, regLabel, regAmount } = await generateAndReadRegistrationRow(page);

    const pctMatch = regLabel.match(/Registration \(([\d.]+)%\)/);
    expect(pctMatch, `expected "Registration (X%)" label, got "${regLabel}"`).not.toBeNull();
    const buildingPct = Number(pctMatch![1]);

    const expected = Math.min(agreementAmount * (buildingPct / 100), 30000);
    expect(regAmount).toBeCloseTo(expected, 0);
  });

  test('percent override: recalculates from the entered % (and still caps at ₹30,000)', async ({ page }) => {
    await selectBuildingAndFlat(page);
    await fillRequiredCustomerFields(page);

    await page.locator('#registrationOverride').fill('8');
    // Type dropdown already defaults to "%".

    const { agreementAmount, regLabel, regAmount } = await generateAndReadRegistrationRow(page);

    expect(regLabel).toBe('Registration (8%)');
    const expected = Math.min(agreementAmount * 0.08, 30000);
    expect(regAmount).toBeCloseTo(expected, 0);
  });

  test('percent override above the cap threshold still clamps to ₹30,000', async ({ page }) => {
    await selectBuildingAndFlat(page);
    await fillRequiredCustomerFields(page);

    await page.locator('#registrationOverride').fill('90');

    const { agreementAmount, regLabel, regAmount } = await generateAndReadRegistrationRow(page);

    expect(regLabel).toBe('Registration (90%)');
    const expected = Math.min(agreementAmount * 0.9, 30000);
    expect(regAmount).toBeCloseTo(expected, 0);
    if (agreementAmount * 0.9 > 30000) {
      expect(regAmount).toBe(30000);
    }
  });

  test('fixed ₹ override: uses the exact amount, uncapped', async ({ page }) => {
    await selectBuildingAndFlat(page);
    await fillRequiredCustomerFields(page);

    await page.locator('#registrationOverride').fill('45000');

    const typeTrigger = page.locator('#registrationOverride').locator('..').getByRole('combobox');
    await typeTrigger.click();
    await page.getByRole('option', { name: '₹' }).click();

    const { regLabel, regAmount } = await generateAndReadRegistrationRow(page);

    expect(regLabel).toBe('Registration (Fixed)');
    expect(regAmount).toBe(45000);
  });

  test('changing type between % and ₹ recalculates correctly for the same flat', async ({ page }) => {
    await selectBuildingAndFlat(page);
    await fillRequiredCustomerFields(page);

    await page.locator('#registrationOverride').fill('5');
    const percentResult = await generateAndReadRegistrationRow(page);
    expect(percentResult.regLabel).toBe('Registration (5%)');
    expect(percentResult.regAmount).toBeCloseTo(
      Math.min(percentResult.agreementAmount * 0.05, 30000),
      0
    );

    const typeTrigger = page.locator('#registrationOverride').locator('..').getByRole('combobox');
    await typeTrigger.click();
    await page.getByRole('option', { name: '₹' }).click();
    await page.locator('#registrationOverride').fill('12345');

    const fixedResult = await generateAndReadRegistrationRow(page);
    expect(fixedResult.regLabel).toBe('Registration (Fixed)');
    expect(fixedResult.regAmount).toBe(12345);
  });
});
