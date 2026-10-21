import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfileData: (data: Partial<UserProfile>) => Promise<void>;
  switchActiveWorkspace: (workspaceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const withTimeout = <T,>(promise: Promise<T>, ms: number = 4000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de sincronização')), ms)
      ),
    ]);
  };

  const syncUserProfile = async (user: User, isBrandNewAccount: boolean = false): Promise<UserProfile> => {
    const userRef = doc(db, 'users', user.uid);
    let snap;
    try {
      snap = await withTimeout(getDoc(userRef), 3500);
    } catch (err) {
      console.warn('Aviso ao consultar Firestore:', err);
      snap = null;
    }

    if (snap && snap.exists()) {
      const data = snap.data() as UserProfile;
      const merged: UserProfile = {
        ...data,
        onboardingDone: true,
      };

      localStorage.setItem('meu_bolso_onboarding_completed', 'true');
      localStorage.setItem(`meu_bolso_onboarding_done_${user.uid}`, 'true');

      if (!data.onboardingDone) {
        setDoc(userRef, { onboardingDone: true }, { merge: true }).catch(() => {});
      }

      setUserProfile(merged);
      return merged;
    } else {
      if (isBrandNewAccount) {
        sessionStorage.setItem('meu_bolso_just_registered', 'true');
      } else {
        localStorage.setItem('meu_bolso_onboarding_completed', 'true');
      }

      const initialWorkspaceId = `ws_${Math.random().toString(36).substring(2, 9)}`;

      const fallbackProfile: UserProfile = {
        uid: user.uid,
        name: user.displayName || 'Usuário',
        email: user.email || '',
        photoURL: user.photoURL || null,
        currency: 'BRL',
        theme: 'dark',
        workspaceIds: [initialWorkspaceId],
        activeWorkspaceId: initialWorkspaceId,
        onboardingDone: !isBrandNewAccount,
        consentAcceptedAt: new Date().toISOString(),
        notificationSettings: {
          daysBefore: 3,
          browserNotifications: true,
          dailyReminder: false,
          dailyReminderTime: '20:00',
        },
        security: {
          pinEnabled: false,
          autoLockMinutes: 5,
        },
      };

      try {
        await Promise.allSettled([
          setDoc(doc(db, 'workspaces', initialWorkspaceId), {
            id: initialWorkspaceId,
            name: 'Principal',
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
            budgetMode: 'categoria',
          }),
          setDoc(doc(db, 'workspaces', initialWorkspaceId, 'members', user.uid), {
            uid: user.uid,
            role: 'owner',
            name: user.displayName || 'Usuário',
            email: user.email || '',
            joinedAt: new Date().toISOString(),
          }),
          setDoc(userRef, fallbackProfile),
        ]);
      } catch (e) {
        console.warn('Gravação do perfil em segundo plano:', e);
      }

      setUserProfile(fallbackProfile);
      return fallbackProfile;
    }
  };

  useEffect(() => {
    const safetyTimer = setTimeout(() => setLoading(false), 5000);

    const unsubscribe = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (user) {
        try {
          await syncUserProfile(user, false);
        } catch (err) {
          console.error('Erro na sincronização:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
      clearTimeout(safetyTimer);
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const signInWithGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) {
      const isNew = getAdditionalUserInfo(res)?.isNewUser ?? false;
      await syncUserProfile(res.user, isNew);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      await syncUserProfile(res.user, false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      await syncUserProfile(res.user, true);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Erro ao desconectar do Firebase:', err);
    } finally {
      // Força a limpeza imediata do estado local
      setCurrentUser(null);
      setUserProfile(null);
      sessionStorage.clear();
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfileData = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, data, { merge: true });
    setUserProfile(prev => (prev ? { ...prev, ...data } : null));
    if (data.onboardingDone) {
      localStorage.setItem('meu_bolso_onboarding_completed', 'true');
      localStorage.setItem(`meu_bolso_onboarding_done_${currentUser.uid}`, 'true');
    }
  };

  const switchActiveWorkspace = async (workspaceId: string) => {
    if (!currentUser) return;
    await updateUserProfileData({ activeWorkspaceId: workspaceId });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        resetPassword,
        updateUserProfileData,
        switchActiveWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};