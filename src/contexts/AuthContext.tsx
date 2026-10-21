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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('meu_bolso_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Perfil instantâneo para carregar a interface sem esperar resposta de rede
  const buildFastProfile = (user: User): UserProfile => {
    const cachedWorkspaceId = localStorage.getItem(`meu_bolso_active_ws_${user.uid}`) || `ws_${user.uid.slice(0, 6)}`;
    return {
      uid: user.uid,
      name: user.displayName || 'Usuário',
      email: user.email || '',
      photoURL: user.photoURL || null,
      currency: 'BRL',
      theme: 'dark',
      workspaceIds: [cachedWorkspaceId],
      activeWorkspaceId: cachedWorkspaceId,
      onboardingDone: true,
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
  };

  // Sincroniza o perfil garantindo que o onboarding concluído nunca seja resetado
  const syncUserProfile = async (user: User, isNewRegistration: boolean = false): Promise<UserProfile> => {
    const userRef = doc(db, 'users', user.uid);
    const localDone = localStorage.getItem(`meu_bolso_onboarding_done_${user.uid}`) === 'true';

    try {
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        const isDone = data.onboardingDone === true || localDone;

        const merged: UserProfile = {
          ...data,
          onboardingDone: isDone,
        };

        if (isDone) {
          localStorage.setItem(`meu_bolso_onboarding_done_${user.uid}`, 'true');
          localStorage.setItem('meu_bolso_onboarding_completed', 'true');
        }

        setUserProfile(merged);
        localStorage.setItem('meu_bolso_cached_profile', JSON.stringify(merged));
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
          onboardingDone: !isNewRegistration,
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

        if (isNewRegistration) {
          sessionStorage.setItem('meu_bolso_just_registered', 'true');
        } else {
          localStorage.setItem(`meu_bolso_onboarding_done_${user.uid}`, 'true');
          localStorage.setItem('meu_bolso_onboarding_completed', 'true');
        }

        setUserProfile(newProfile);
        localStorage.setItem('meu_bolso_cached_profile', JSON.stringify(newProfile));

        // Cria workspace e perfil em segundo plano
        Promise.allSettled([
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
          setDoc(userRef, newProfile),
        ]).catch(err => console.warn('Erro ao salvar documentos iniciais:', err));

        return newProfile;
      }
    } catch (err) {
      console.warn('Sincronização offline ou lenta com Firestore:', err);
      const fallback = buildFastProfile(user);
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);

      if (user) {
        // Carrega imediatamente do cache ou cria perfil rápido para abrir na hora
        let current = userProfile;
        if (!current || current.uid !== user.uid) {
          try {
            const cached = localStorage.getItem('meu_bolso_cached_profile');
            const parsed = cached ? JSON.parse(cached) : null;
            current = (parsed && parsed.uid === user.uid) ? parsed : buildFastProfile(user);
          } catch {
            current = buildFastProfile(user);
          }
          setUserProfile(current);
        }

        // Abre o app instantaneamente
        setLoading(false);

        // Sincroniza em segundo plano sem travar a interface
        syncUserProfile(user, false);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) {
      const fast = buildFastProfile(res.user);
      setUserProfile(fast);
      localStorage.setItem('meu_bolso_cached_profile', JSON.stringify(fast));
      setLoading(false);
      syncUserProfile(res.user, false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      const fast = buildFastProfile(res.user);
      setUserProfile(fast);
      localStorage.setItem('meu_bolso_cached_profile', JSON.stringify(fast));
      setLoading(false);
      syncUserProfile(res.user, false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      const fast = buildFastProfile(res.user);
      fast.name = name.trim() || fast.name;
      setUserProfile(fast);
      localStorage.setItem('meu_bolso_cached_profile', JSON.stringify(fast));
      setLoading(false);
      syncUserProfile(res.user, true);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Erro ao sair do Firebase:', err);
    } finally {
      // Limpeza imediata de estado para retorno instantâneo à tela de login
      setCurrentUser(null);
      setUserProfile(null);
      localStorage.removeItem('meu_bolso_cached_profile');
      sessionStorage.clear();
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfileData = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);

    setUserProfile(prev => {
      const updated = prev ? { ...prev, ...data } : null;
      if (updated) {
        localStorage.setItem('meu_bolso_cached_profile', JSON.stringify(updated));
      }
      return updated;
    });

    if (data.onboardingDone) {
      localStorage.setItem(`meu_bolso_onboarding_done_${currentUser.uid}`, 'true');
      localStorage.setItem('meu_bolso_onboarding_completed', 'true');
    }

    try {
      await setDoc(userRef, data, { merge: true });
    } catch (err) {
      console.warn('Erro ao salvar atualização no Firestore:', err);
    }
  };

  const switchActiveWorkspace = async (workspaceId: string) => {
    if (!currentUser) return;
    localStorage.setItem(`meu_bolso_active_ws_${currentUser.uid}`, workspaceId);
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