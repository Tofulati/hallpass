import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthService } from '../services/authService';
import { DatabaseService } from '../services/databaseService';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  hasCompletedOnboarding: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await loadUserData(firebaseUser.uid);
        const completed = await AuthService.hasCompletedOnboarding(firebaseUser.uid);
        setHasCompletedOnboarding(completed);
      } else {
        setUserData(null);
        setHasCompletedOnboarding(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const data = await DatabaseService.getUser(userId);
      setUserData(data);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    await AuthService.signIn(email, password);
    // User data will be loaded by onAuthStateChanged
  };

  const register = async (email: string, password: string, name: string) => {
    await AuthService.register(email, password, name);
    // User data will be loaded by onAuthStateChanged
  };

  const signOut = async () => {
    await AuthService.signOut();
    setUserData(null);
    setHasCompletedOnboarding(false);
  };

  const refreshUserData = async () => {
    if (user) {
      await loadUserData(user.uid);
      const completed = await AuthService.hasCompletedOnboarding(user.uid);
      setHasCompletedOnboarding(completed);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        signIn,
        register,
        signOut,
        refreshUserData,
        hasCompletedOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
