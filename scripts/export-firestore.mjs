// Fase 3 — export de solo lectura de Firestore de producción a JSON.
// No escribe nada en Firestore. Salida en migration-data/ (gitignored).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs/promises'
import path from 'path'

const COLLECTIONS = [
  'leagues',
  'league_events',
  'league_cars',
  'circuits',
  'league_registrations',
  'league_team_registrations',
  'league_team_registration_drivers',
  'league_event_confirmations',
  'league_results',
  'league_result_imports',
  'league_team_points',
  'league_members',
  'driver_number_preferences',
  'teams',
  'team_members',
  'team_invites',
  'users',
  'steam_accounts',
  'steam_id_index',
  'profiles',
  'platform_roles',
  'admin_grants',
  'market_listings',
  'market_applications',
  'market_invites',
  'user_notifications',
  'settings',
  'skin_files',
]

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local')
  }
  privateKey = privateKey.trim()
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1)
  }
  privateKey = privateKey.replace(/\\n/g, '\n')

  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  }
  return getFirestore()
}

async function main() {
  const db = initAdmin()
  const outDir = path.join(process.cwd(), 'migration-data')
  await fs.mkdir(outDir, { recursive: true })

  const summary = {}
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get()
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    await fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2), 'utf8')
    summary[name] = docs.length
    console.log(`${name}: ${docs.length} docs`)
  }

  await fs.writeFile(path.join(outDir, '_summary.json'), JSON.stringify(summary, null, 2), 'utf8')
  console.log('\nDone. Summary written to migration-data/_summary.json')
}

main().catch((err) => {
  console.error('Export failed:', err)
  process.exit(1)
})
