import { expect, test } from '@playwright/test'

test('kupující zaplatí kartou, Děkujeme ukáže zaplacené shrnutí a košík je prázdný', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Do košíku' }).first().click()

  await page.goto('/kosik')
  await page.getByLabel('Doručení na adresu').check()
  await page.getByLabel('Jméno').fill('Jan Novák')
  await page.getByLabel('E-mail').fill('delivered@resend.dev')
  await page.getByRole('button', { name: 'Zaplatit' }).click()

  // Stripe hosted Checkout
  await page.waitForURL(/checkout\.stripe\.com/)
  await page.getByLabel(/^full name$/i).first().fill('Jan Novák')
  const manual = page.getByRole('button', { name: /enter address manually/i })
  if (await manual.isVisible()) await manual.click()
  await page.getByLabel(/address line 1/i).first().fill('Václavské náměstí 1')
  await page.getByLabel(/postal code|zip/i).first().fill('110 00')
  await page.getByLabel(/city/i).first().fill('Praha')

  // Card is a collapsed accordion next to Klarna/Link
  await page.getByText('Card', { exact: true }).click({ force: true }) // an overlay button takes the click
  await page.getByPlaceholder('1234 1234 1234 1234').fill('4242 4242 4242 4242')
  await page.getByPlaceholder('MM / YY').fill('12 / 34')
  await page.getByPlaceholder('CVC').fill('123')

  await page.getByRole('button', { name: 'Pay', exact: true }).click()

  await page.waitForURL(/\/dekujeme\?session_id=/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Děkujeme za objednávku!' })).toBeVisible()
  await expect(page.getByText('Doručení na adresu')).toBeVisible()
  await expect(page.getByText('Celkem')).toBeVisible()

  await page.goto('/kosik')
  await expect(page.getByText('Košík je prázdný.')).toBeVisible()
})
