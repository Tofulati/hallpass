import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, OnboardingData } from '../types';

export class AuthService {
  /**
   * Register a new user
   */
  static async register(email: string, password: string, name: string): Promise<FirebaseUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      // Create user document in Firestore
      const userData: Partial<User> = {
        id: userCredential.user.uid,
        email: email,
        name: name,
        courses: [],
        clubs: [],
        followers: [],
        following: [],
        discussionRanking: 0,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  /**
   * Sign in existing user (Email/Password)
   */
  static async signIn(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message || 'Sign in failed');
    }
  }

  /**
   * Sign in with Google
   */
  static async signInWithGoogle(idToken: string, accessToken: string): Promise<FirebaseUser> {
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Check if user document exists, create if not
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        const userData: Partial<User> = {
          id: userCredential.user.uid,
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'User',
          profileImage: userCredential.user.photoURL || undefined,
          courses: [],
          clubs: [],
          followers: [],
          following: [],
          discussionRanking: 0,
          isPrivate: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      }
      
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message || 'Google sign in failed');
    }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(error.message || 'Sign out failed');
    }
  }

  /**
   * Get current user
   */
  static getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Complete onboarding and update user profile
   * Also adds user as a member to selected courses and organizations
   */
  static async completeOnboarding(
    userId: string,
    onboardingData: OnboardingData
  ): Promise<void> {
    try {
      // Firestore batch limit is 500 operations
      const MAX_BATCH_SIZE = 500;
      let batchOps = 0;
      let currentBatch = writeBatch(db);
      const batches: typeof currentBatch[] = [currentBatch];

      // Update user document with university, courses, and clubs
      const userRef = doc(db, 'users', userId);
      currentBatch.set(
        userRef,
        {
          university: onboardingData.universityId,
          courses: onboardingData.courses, // Array of course IDs
          clubs: onboardingData.clubs, // Array of organization/club IDs
          updatedAt: new Date(),
        },
        { merge: true }
      );
      batchOps++;

      // Add user to each selected course's members array
      for (const courseId of onboardingData.courses) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const courseRef = doc(db, 'courses', courseId);
        currentBatch.update(courseRef, {
          members: arrayUnion(userId), // Add user ID to members array (no duplicates)
        });
        batchOps++;
      }

      // Add user to each selected organization's members array
      for (const organizationId of onboardingData.clubs) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const organizationRef = doc(db, 'organizations', organizationId);
        currentBatch.update(organizationRef, {
          members: arrayUnion(userId), // Add user ID to members array (no duplicates)
        });
        batchOps++;
      }

      // Commit all batches sequentially
      for (const batchToCommit of batches) {
        await batchToCommit.commit();
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      throw new Error(error.message || 'Onboarding completion failed');
    }
  }

  /**
   * Check if user has completed onboarding
   */
  static async hasCompletedOnboarding(userId: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return false;
      
      const userData = userDoc.data();
      return !!userData.university && userData.courses && userData.courses.length > 0;
    } catch (error) {
      return false;
    }
  }
}
