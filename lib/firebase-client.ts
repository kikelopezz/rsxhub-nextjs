import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-id',
}

const hasClientFirebase = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY
)

let clientDb: any = null

if (hasClientFirebase) {
  try {
    const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    clientDb = getFirestore(clientApp)
  } catch (error) {
    console.error('Failed to initialize Firebase Client SDK:', error)
  }
}

export function getFirebaseClientDb() {
  return clientDb
}
