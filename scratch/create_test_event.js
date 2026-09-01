const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function run() {
  // Read .env.local manually
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found at:', envPath);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  });

  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  let privateKey = env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Credentials in .env.local');
    process.exit(1);
  }

  // Initialize Firebase Admin
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });

  const db = getFirestore();

  // 1. Get or create a test league
  const leaguesSnap = await db.collection('leagues').limit(1).get();
  let leagueId = '';
  let leagueSlug = '';
  let leagueTitle = '';

  if (leaguesSnap.empty) {
    console.log('No leagues found. Creating a test league first...');
    const leaguePayload = {
      title: 'ALR Endurance GT3',
      slug: 'alr-gt3-test',
      short_description: 'Test league for verifying calendar and direct connections.',
      full_description: 'This is a test league created automatically by the assistant.',
      simulator: 'ac',
      format: 'endurance',
      status: 'open',
      banner_url: '/circuits/daytona.jpg',
      is_featured: true,
      registration_open: true,
      registration_mode: 'individual',
      max_drivers: 40,
      class_tags: ['GT3'],
      created_at: new Date()
    };
    const newLeagueRef = await db.collection('leagues').add(leaguePayload);
    leagueId = newLeagueRef.id;
    leagueSlug = leaguePayload.slug;
    leagueTitle = leaguePayload.title;
    console.log(`Created test league with ID: ${leagueId}`);
  } else {
    const firstLeague = leaguesSnap.docs[0];
    leagueId = firstLeague.id;
    leagueSlug = firstLeague.data().slug || 'test-league';
    leagueTitle = firstLeague.data().title || 'Test League';
    console.log(`Using existing league: ${leagueTitle} (${leagueId})`);
  }

  // 2. Create calendar event for TODAY
  const today = new Date();
  
  // Set start time to 20:00 UTC today
  const startsAt = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    20, 0, 0
  ));

  // Set ends time to 22:00 UTC today
  const endsAt = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    22, 0, 0
  ));

  const eventPayload = {
    id: `event_test_${Date.now()}`,
    league_id: leagueId,
    title: 'Round 1 - Season Opener (Test Event)',
    circuit_name: 'Daytona International Speedway',
    circuit_image_url: '/circuits/daytona.jpg',
    server_link: 'steam://connect/12.34.56.78:27015',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: 'scheduled'
  };

  await db.collection('league_events').doc(eventPayload.id).set(eventPayload);
  console.log(`Created calendar event for TODAY: ${eventPayload.title} on ${eventPayload.circuit_name}`);
  console.log(`Starts At: ${eventPayload.starts_at}`);
  console.log(`Ends At: ${eventPayload.ends_at}`);
  console.log(`Server Link: ${eventPayload.server_link}`);
  console.log('Done!');
}

run().catch(console.error);
