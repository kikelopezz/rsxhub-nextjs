import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app'
import { getFirestore as getClientFirestore } from 'firebase/firestore'
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

const hasAdminCredentials = typeof window === 'undefined'
  ? Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  : true

export const hasFirebase = Boolean(
  (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  hasAdminCredentials
)

// Client SDK initialization
let clientApp;
let clientDb: any = null;

if (hasFirebase && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  try {
    clientApp = getClientApps().length === 0 ? initializeClientApp(firebaseConfig) : getClientApp()
    clientDb = getClientFirestore(clientApp)
  } catch (error) {
    console.error('Failed to initialize Firebase Client SDK:', error)
  }
}

// Server SDK initialization (using Firebase Admin)
let adminDb: any = null

if (typeof window === 'undefined') {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (privateKey) {
    privateKey = privateKey.trim()
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1)
    }
    privateKey = privateKey.trim()
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  if (projectId && clientEmail && privateKey) {
    try {
      if (getAdminApps().length === 0) {
        initializeAdminApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        })
      }
      adminDb = getAdminFirestore()
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK with cert:', error)
    }
  } else {
    // If Admin credentials are not provided (e.g. local dev without .env secrets),
    // we keep adminDb as null. The app will gracefully fall back to mock data
    // instead of throwing "Could not load default credentials" warnings.
    adminDb = null
  }
}

export function getFirebaseClientDb() {
  return clientDb
}

export function getFirebaseAdminDb() {
  return adminDb
}
export function getFirestoreDb() {
  return adminDb
}

export async function runWithTimeout(promise: Promise<any>, ms: number = 4000): Promise<any> {
  let timeoutId: any
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Firebase operation timed out'))
    }, ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}
