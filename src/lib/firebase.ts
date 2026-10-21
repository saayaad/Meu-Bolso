import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import rawConfig from '../../firebase-applet-config.json';

const isValidEnv = (val: string | undefined, placeholder: string) =>
  Boolean(val && val.trim() !== '' && val !== placeholder);

const apiKey = isValidEnv(import.meta.env.VITE_FIREBASE_API_KEY, 'sua_api_key_aqui')
  ? import.meta.env.VITE_FIREBASE_API_KEY
  : rawConfig.apiKey;

const authDomain = isValidEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 'seu-projeto.firebaseapp.com')
  ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  : rawConfig.authDomain;

const projectId = isValidEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID, 'seu-projeto-id')
  ? import.meta.env.VITE_FIREBASE_PROJECT_ID
  : rawConfig.projectId;

const storageBucket = isValidEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, 'seu-projeto.appspot.com')
  ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
  : rawConfig.storageBucket;

const messagingSenderId = isValidEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, 'seu_messaging_sender_id')
  ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  : rawConfig.messagingSenderId;

const appId = isValidEnv(import.meta.env.VITE_FIREBASE_APP_ID, 'seu_app_id')
  ? import.meta.env.VITE_FIREBASE_APP_ID
  : rawConfig.appId;

const rawDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || rawConfig.firestoreDatabaseId;
const firestoreDatabaseId = rawDbId === '(default)' || !rawDbId ? undefined : rawDbId;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  firestoreDatabaseId,
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  try {
    const settings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    };
    return firebaseConfig.firestoreDatabaseId
      ? initializeFirestore(app, settings, firebaseConfig.firestoreDatabaseId)
      : initializeFirestore(app, settings);
  } catch {
    return firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}