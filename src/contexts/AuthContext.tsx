import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { UserProfile, Workspace } from '../types';
import { DEFAULT_CATEGORIES } from '../lib/constants';
import { setDefaultCurrency } from '../lib/money';
import { saveUserProfileOffline, getUserProfileOffline, OFFLINE_CACHE_NAME } from '../lib/offlineStorage';

auth.languageCode = 'pt-BR';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string, consentAcceptedAt: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateUserProfileData: (data: Partial<UserProfile>) => Promise<void>;
  switchActiveWorkspace: (workspaceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function buildFallbackProfile(
  user: FirebaseUser,
  customName?: string,
  consentAcceptedAt?: string
): UserProfile {
  const defaultWsId = `ws_${user.uid.substring(0, 12)}`;
  const resolvedName =
    customName ||
    user.displayName ||
    (user.email ? user.email.split('@')[0] : 'Usuário');

  return {
    uid: user.uid,
    name: resolvedName,
    email: user.email || '',
    photoURL: user.photoURL || null,
    currency: 'BRL',
    theme: 'dark',
    workspaceIds: [defaultWsId],
    activeWorkspaceId: defaultWsId,
    onboardingDone: false,
    consentAcceptedAt: consentAcceptedAt || new Date().toISOString(),
    notificationSettings: {
      daysBefore: 3,
      browserNotifications: false,
      dailyReminder: false,
      dailyReminderTime: '20:00',
    },
    security: {
      pinEnabled: false,
      autoLockMinutes: 5,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.currency) {
      setDefaultCurrency(userProfile.currency);
    }
  }, [userProfile?.currency]);

  const bootstrapUser = async (
    user: FirebaseUser,
    customName?: string,
    consentAcceptedAt?: string
  ): Promise<UserProfile> => {
    const userRef = doc(db, 'users', user.uid);
    let existingProfile: UserProfile | null = null;

    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        existingProfile = userSnap.data() as UserProfile;
      }
    } catch (err) {
      console.warn('Aviso ao ler perfil no Firestore:', err);
    }

    if (existingProfile) {
      const fallback = buildFallbackProfile(user, customName, consentAcceptedAt);
      const fullProfile: UserProfile = {
        ...fallback,
        ...existingProfile,
        uid: user.uid,
        name:
          existingProfile.name && existingProfile.name !== 'Usuário'
            ? existingProfile.name
            : fallback.name,
        email: existingProfile.email || user.email || '',
        photoURL: existingProfile.photoURL ?? user.photoURL ?? null,
        notificationSettings: {
          ...fallback.notificationSettings,
          ...(existingProfile.notificationSettings || {}),
        },
        security: {
          ...fallback.security,
          ...(existingProfile.security || {}),
        },
      };
      setDefaultCurrency(fullProfile.currency);
      await saveUserProfileOffline(fullProfile);
      return fullProfile;
    }

    const workspaceId = `ws_${user.uid.substring(0, 12)}_${Date.now()}`;
    const workspaceRef = doc(db, 'workspaces', workspaceId);
    const resolvedName =
      customName ||
      user.displayName ||
      (user.email ? user.email.split('@')[0] : 'Usuário');

    const newWorkspace: Workspace = {
      id: workspaceId,
      name: 'Meu Bolso Pessoal',
      ownerId: user.uid,
      createdAt: new Date().toISOString(),
      budgetMode: 'categoria',
    };

    const newUserProfile: UserProfile = {
      ...buildFallbackProfile(user, resolvedName, consentAcceptedAt),
      workspaceIds: [workspaceId],
      activeWorkspaceId: workspaceId,
    };

    try {
      await setDoc(workspaceRef, newWorkspace);

      const memberRef = doc(db, `workspaces/${workspaceId}/members`, user.uid);
      await setDoc(memberRef, {
        uid: user.uid,
        role: 'owner',
        name: resolvedName,
        email: user.email || '',
        joinedAt: new Date().toISOString(),
      });

      const batch = writeBatch(db);
      const accRef = doc(collection(db, `workspaces/${workspaceId}/accounts`));
      batch.set(accRef, {
        name: 'Carteira',
        type: 'carteira',
        initialBalanceCents: 0,
        color: '#4ADE80',
        icon: 'Wallet',
        archived: false,
      });

      for (const cat of DEFAULT_CATEGORIES) {
        const catRef = doc(collection(db, `workspaces/${workspaceId}/categories`));
        batch.set(catRef, cat);
      }

      batch.set(userRef, newUserProfile, { merge: true });
      localStorage.setItem(`meu_bolso_seeded_cats_v4_${workspaceId}`, 'true');
      await batch.commit();
    } catch (err) {
      console.warn('Aviso ao criar estrutura inicial no Firestore:', err);
    }

    setDefaultCurrency(newUserProfile.currency);
    await saveUserProfileOffline(newUserProfile);
    return newUserProfile;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const cachedUser = await getUserProfileOffline();
        if (cachedUser && cachedUser.uid === user.uid) {
          setUserProfile(cachedUser);
          setDefaultCurrency(cachedUser.currency);
        } else {
          setUserProfile(buildFallbackProfile(user));
        }
        setLoading(false);

        try {
          const profile = await bootstrapUser(user);
          setUserProfile(profile);
          await saveUserProfileOffline(profile);
        } catch (error) {
          console.warn('Usando perfil de fallback local:', error);
        }
      } else {
        const cachedProfile = await getUserProfileOffline();
        if (!navigator.onLine && cachedProfile) {
          setUserProfile(cachedProfile);
          setDefaultCurrency(cachedProfile.currency);
          setCurrentUser({
            uid: cachedProfile.uid,
            displayName: cachedProfile.name,
            email: cachedProfile.email,
            emailVerified: true,
            isAnonymous: false,
            photoURL: cachedProfile.photoURL,
          } as FirebaseUser);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const profile = await bootstrapUser(result.user);
      setUserProfile(profile);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      const profile = await bootstrapUser(result.user);
      setUserProfile(profile);
    }
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    pass: string,
    consentAcceptedAt: string
  ) => {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      await updateProfile(result.user, { displayName: name });
      try {
        await sendEmailVerification(result.user);
      } catch (e) {
        console.warn('Não foi possível enviar e-mail de verificação:', e);
      }
      const profile = await bootstrapUser(result.user, name, consentAcceptedAt);
      setUserProfile(profile);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('meu_bolso_offline_user_profile');
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheStorage = await window.caches.open(OFFLINE_CACHE_NAME);
        await cacheStorage.delete(new Request('/offline-cache/user-profile'));
      }
    } catch {}
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (currentUser) {
      await sendEmailVerification(currentUser);
    }
  };

  const updateUserProfileData = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;

    const baseProfile = userProfile || buildFallbackProfile(currentUser);
    const updatedProfile: UserProfile = {
      ...baseProfile,
      ...data,
    };

    if (updatedProfile.currency) {
      setDefaultCurrency(updatedProfile.currency);
    }

    setUserProfile(updatedProfile);
    await saveUserProfileOffline(updatedProfile);

    if (data.name && data.name !== currentUser.displayName) {
      try {
        await updateProfile(currentUser, { displayName: data.name });
      } catch (e) {
        console.warn('Aviso ao atualizar displayName no Auth:', e);
      }
    }

    const userRef = doc(db, 'users', currentUser.uid);
    setDoc(userRef, updatedProfile, { merge: true }).catch(() => {});
  };

  const switchActiveWorkspace = async (workspaceId: string) => {
    await updateUserProfileData({ activeWorkspaceId: workspaceId });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        resetPassword,
        resendVerificationEmail,
        updateUserProfileData,
        switchActiveWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}