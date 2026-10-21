import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
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

  // Sincroniza o perfil garantindo que o onboarding concluído nunca seja resetado
  const syncUserProfile = async (user: User): Promise<UserProfile> => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const localDone = localStorage.getItem(`meu_bolso_onboarding_done_${user.uid}`) === 'true';

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const isDone = data.onboardingDone === true || localDone;

      const merged: UserProfile = {
        ...data,
        onboardingDone: isDone,
      };

      if (isDone) {
        localStorage.setItem(`meu_bolso_onboarding_done_${user.uid}`, 'true');
      }

      setUserProfile(merged);
      return merged;
    } else {
      const initialWorkspaceId = `ws_${Math.random().toString(36).substring(2, 9)}`;

      const newProfile: UserProfile = {
        uid: user.uid,
        name: user.displayName || 'Usuário',
        email: user.email || '',
        photoURL: user.photoURL || null,
        currency: 'BRL',
        theme: 'dark',
        workspaceIds: [initialWorkspaceId],
        activeWorkspaceId: initialWorkspaceId,
        onboardingDone: localDone,
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

      // Cria workspace inicial
      await setDoc(doc(db, 'workspaces', initialWorkspaceId), {
        id: initialWorkspaceId,
        name: 'Principal',
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        budgetMode: 'categoria',
      });

      // Cria membro
      await setDoc(doc(db, 'workspaces', initialWorkspaceId, 'members', user.uid), {
        uid: user.uid,
        role: 'owner',
        name: user.displayName || 'Usuário',
        email: user.email || '',
        joinedAt: new Date().toISOString(),
      });

      await setDoc(userRef, newProfile);
      setUserProfile(newProfile);
      return newProfile;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (user) {
        try {
          await syncUserProfile(user);
        } catch (err) {
          console.error('Erro ao sincronizar perfil:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) {
      await syncUserProfile(res.user);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      await syncUserProfile(res.user);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      const userRef = doc(db, 'users', res.user.uid);
      const initialWorkspaceId = `ws_${Math.random().toString(36).substring(2, 9)}`;
      const newProfile: UserProfile = {
        uid: res.user.uid,
        name: name.trim() || 'Usuário',
        email: res.user.email || '',
        photoURL: null,
        currency: 'BRL',
        theme: 'dark',
        workspaceIds: [initialWorkspaceId],
        activeWorkspaceId: initialWorkspaceId,
        onboardingDone: false,
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

      await setDoc(doc(db, 'workspaces', initialWorkspaceId), {
        id: initialWorkspaceId,
        name: 'Principal',
        ownerId: res.user.uid,
        createdAt: new Date().toISOString(),
        budgetMode: 'categoria',
      });

      await setDoc(doc(db, 'workspaces', initialWorkspaceId, 'members', res.user.uid), {
        uid: res.user.uid,
        role: 'owner',
        name: name.trim() || 'Usuário',
        email: res.user.email || '',
        joinedAt: new Date().toISOString(),
      });

      await setDoc(userRef, newProfile);
      setUserProfile(newProfile);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
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