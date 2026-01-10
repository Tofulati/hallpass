/**
 * ID Verification Service
 * Handles ID card verification for university enrollment
 */

import { doc, setDoc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { IDVerification, University } from '../types';

export class VerificationService {
  /**
   * Submit ID card verification (name and university matching only)
   * We don't store the actual ID card image - just verification status to prevent duplicate accounts
   */
  static async submitIDVerification(
    userId: string,
    universityId: string,
    nameOnCard: string,
    universityNameOnCard?: string,
    nameMatch: boolean = false,
    universityMatch: boolean = false
  ): Promise<string> {
    try {
      // Check for duplicate accounts: same name on ID card for same university
      // This prevents users from creating multiple accounts with the same ID card
      const duplicateCheck = query(
        collection(db, 'id_verifications'),
        where('universityId', '==', universityId),
        where('nameOnCard', '==', nameOnCard.trim().toLowerCase()),
        where('verified', '==', true)
      );
      const duplicateSnapshot = await getDocs(duplicateCheck);

      // If found duplicate verified account, check if it's the same user
      if (!duplicateSnapshot.empty) {
        const existingVerification = duplicateSnapshot.docs[0];
        if (existingVerification.data().userId !== userId) {
          throw new Error('An account with this ID card name already exists for this university. Please use your existing account or contact support if you believe this is an error.');
        }
      }

      // Check if verification already exists for this user
      const existingQuery = query(
        collection(db, 'id_verifications'),
        where('userId', '==', userId),
        where('universityId', '==', universityId)
      );
      const existingSnapshot = await getDocs(existingQuery);

      // Determine verification status based on matches
      let verificationStatus: 'pending' | 'verified' | 'rejected' | 'manual_review' = 'pending';
      let verified = false;

      if (nameMatch && (universityMatch || !universityNameOnCard)) {
        // Auto-verify if name matches and university matches (or not checked)
        verificationStatus = 'verified';
        verified = true;
      } else if (!nameMatch) {
        // If name doesn't match, needs manual review
        verificationStatus = 'manual_review';
        verified = false;
      } else if (universityNameOnCard && !universityMatch) {
        // If university doesn't match, needs manual review
        verificationStatus = 'manual_review';
        verified = false;
      }

      // Prepare data for Firestore (remove undefined values)
      const verificationData: any = {
        userId,
        universityId,
        idCardImage: '', // We don't store the actual image, just verification metadata (kept for type compatibility)
        nameOnCard: nameOnCard.trim().toLowerCase(), // Store normalized for duplicate checking
        verificationStatus,
        verified,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only add universityNameOnCard if it exists (don't include undefined)
      if (universityNameOnCard?.trim()) {
        verificationData.universityNameOnCard = universityNameOnCard.trim();
      }

      // Only add verifiedAt if verified
      if (verified) {
        verificationData.verifiedAt = Timestamp.now();
      }

      let verificationId: string;

      if (existingSnapshot.empty) {
        // Create new verification
        const docRef = doc(collection(db, 'id_verifications'));
        verificationId = docRef.id;
        await setDoc(docRef, verificationData);
      } else {
        // Update existing verification
        const existingDoc = existingSnapshot.docs[0];
        verificationId = existingDoc.id;
        const existingData = existingDoc.data();
        // Preserve verifiedAt if it exists and we're not verifying now
        if (existingData.verifiedAt && !verified) {
          verificationData.verifiedAt = existingData.verifiedAt;
        }
        await setDoc(existingDoc.ref, verificationData, { merge: true });
      }

      return verificationId;
    } catch (error: any) {
      console.error('Error submitting ID verification:', error);
      throw new Error(error.message || 'Failed to submit ID verification');
    }
  }

  /**
   * Get user's ID verification status
   */
  static async getVerification(userId: string, universityId: string): Promise<IDVerification | null> {
    try {
      const q = query(
        collection(db, 'id_verifications'),
        where('userId', '==', userId),
        where('universityId', '==', universityId)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        userId: data.userId,
        universityId: data.universityId,
        idCardImage: data.idCardImage || '', // Not stored anymore, kept for type compatibility
        nameOnCard: data.nameOnCard || '',
        universityNameOnCard: data.universityNameOnCard || undefined,
        verificationStatus: data.verificationStatus || 'pending',
        verified: data.verified || false,
        verifiedAt: data.verifiedAt?.toDate() || undefined,
        reviewedBy: data.reviewedBy || undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as IDVerification;
    } catch (error) {
      console.error('Error getting verification:', error);
      return null;
    }
  }

  /**
   * Verify name matches (basic string comparison)
   * This is a simplified version - can be enhanced with OCR later
   */
  static verifyNameMatch(userName: string, nameOnCard: string): boolean {
    if (!nameOnCard || !nameOnCard.trim()) {
      return false; // Can't verify if no name on card
    }

    // Normalize names: trim, lowercase, remove extra spaces
    const normalizedUserName = userName.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedNameOnCard = nameOnCard.trim().toLowerCase().replace(/\s+/g, ' ');

    // Exact match
    if (normalizedUserName === normalizedNameOnCard) {
      return true;
    }

    // Check if names contain each other (handles middle names, initials, etc.)
    const userNameParts = normalizedUserName.split(' ');
    const cardNameParts = normalizedNameOnCard.split(' ');

    // Check if all parts of user name are in card name or vice versa
    const allUserNamePartsInCard = userNameParts.every(part => 
      cardNameParts.some(cardPart => cardPart.includes(part) || part.includes(cardPart))
    );
    const allCardPartsInUserName = cardNameParts.every(part => 
      userNameParts.some(userPart => userPart.includes(part) || part.includes(userPart))
    );

    return allUserNamePartsInCard || allCardPartsInUserName;
  }

  /**
   * Verify university name matches (basic string comparison)
   * This is a simplified version - can be enhanced with OCR and logo matching later
   */
  static verifyUniversityMatch(selectedUniversity: University, universityNameOnCard?: string): boolean {
    if (!universityNameOnCard || !universityNameOnCard.trim()) {
      // If no university name extracted, we can't verify automatically
      // This will require manual review or OCR enhancement
      return false;
    }

    // Normalize names: trim, lowercase, remove extra spaces
    const normalizedSelected = selectedUniversity.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedOnCard = universityNameOnCard.trim().toLowerCase().replace(/\s+/g, ' ');

    // Exact match
    if (normalizedSelected === normalizedOnCard) {
      return true;
    }

    // Check if university names are similar (fuzzy matching for abbreviations, etc.)
    // For now, check if selected name contains card name or vice versa
    if (normalizedSelected.includes(normalizedOnCard) || normalizedOnCard.includes(normalizedSelected)) {
      return true;
    }

    // Extract common words (like "University", "College", etc.) and compare core name
    const selectedCore = normalizedSelected.replace(/\b(university|college|univ|u\s*of|uc)\b/g, '').trim();
    const cardCore = normalizedOnCard.replace(/\b(university|college|univ|u\s*of|uc)\b/g, '').trim();

    if (selectedCore && cardCore) {
      return selectedCore.includes(cardCore) || cardCore.includes(selectedCore);
    }

    return false;
  }

  /**
   * Check if a user with the same ID card name already has a verified account for this university
   * This helps prevent duplicate accounts
   */
  static async checkForDuplicateAccount(
    nameOnCard: string,
    universityId: string,
    currentUserId: string
  ): Promise<{ isDuplicate: boolean; existingUserId?: string }> {
    try {
      const normalizedName = nameOnCard.trim().toLowerCase();
      const duplicateQuery = query(
        collection(db, 'id_verifications'),
        where('universityId', '==', universityId),
        where('nameOnCard', '==', normalizedName),
        where('verified', '==', true)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        const existingVerification = duplicateSnapshot.docs[0].data();
        // If it's the same user, it's not a duplicate
        if (existingVerification.userId !== currentUserId) {
          return {
            isDuplicate: true,
            existingUserId: existingVerification.userId,
          };
        }
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking for duplicate account:', error);
      // If check fails, allow verification to proceed (better UX)
      return { isDuplicate: false };
    }
  }
}
