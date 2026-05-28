import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId to bind the specific database instance correctly
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google Auth triggers
googleProvider.setCustomParameters({
  prompt: "select_account",
});

/**
 * Retrieves the Gemini API Key from:
 * 1. LoacalStorage (cached/previous)
 * 2. Build-time environment variable VITE_GEMINI_API_KEY (useful for Vercel/CDN)
 * 3. Firestore "settings/config" central document (so anyone on Vercel can automatically use it!)
 */
export async function getStoredGeminiApiKey(): Promise<string> {
  // 1. Check local storage
  const localKey = localStorage.getItem("USER_GEMINI_API_KEY");
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }

  // 2. Check build-time environment variable (from Vercel or local dot-env during build)
  const envKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  // 3. Fallback: Fetch directly from central Firestore database
  try {
    const docRef = doc(db, "settings", "config");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.geminiApiKey && data.geminiApiKey.trim()) {
        const cloudKey = data.geminiApiKey.trim();
        // Cache to local storage to avoid repeated Firestore reads
        localStorage.setItem("USER_GEMINI_API_KEY", cloudKey);
        return cloudKey;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch Gemini API Key from Firestore client-side:", err);
  }

  return "";
}

