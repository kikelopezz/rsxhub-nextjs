require('dotenv').config({ path: '.env.local' })
const { chromium } = require('C:/Users/kike/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright')
const { SignJWT } = require('jose')

async function main() {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET)
  const token = await new SignJWT({
    userId: 'preview_driver_12',
    steamId: '76561199000000012',
    steamDisplayName: 'Marc Osuna',
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(secret)

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await context.addCookies([{ name: 'simleague_session', value: token, domain: 'localhost', path: '/', httpOnly: true }])
  const page = await context.newPage()
  await page.goto('http://localhost:3000/equipos/cmtkqkhns0023uqvsvgrdatga', { waitUntil: 'networkidle', timeout: 20000 })
  await page.getByText('Gestionar vehículos', { exact: false }).first().click()
  await page.waitForTimeout(400)

  await page.getByText('PREVIEW — ERC GT3 Sprint', { exact: false }).first().click()
  await page.waitForTimeout(300)
  const addButtons1 = await page.locator('button', { hasText: 'Añadir vehículo' }).allTextContents()
  console.log('ERC tab add-vehicle buttons:', addButtons1)

  await page.getByText('PREVIEW — ERC NEXT GEN Endurance', { exact: false }).first().click()
  await page.waitForTimeout(300)
  const addButtons2 = await page.locator('button', { hasText: 'Añadir vehículo' }).allTextContents()
  console.log('ERC NEXT GEN tab add-vehicle buttons:', addButtons2)

  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
