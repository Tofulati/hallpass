import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  User,
  University,
  Discussion,
  Course,
  Professor,
  Club,
  Organization,
  Message,
  Conversation,
  SortOption,
  FilterType,
  ProfessorRating,
  ClubRating,
} from '../types';

export class DatabaseService {
  // User Operations
  static async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return null;
      return { id: userDoc.id, ...userDoc.data() } as User;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Discussion Operations
  static async createDiscussion(discussion: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'discussions'), {
        ...discussion,
        score: 0,
        controversy: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating discussion:', error);
      throw error;
    }
  }

  static async getDiscussions(
    filters?: {
      courseId?: string;
      professorId?: string;
      clubId?: string;
      tags?: string[];
      userId?: string;
    },
    sortBy: SortOption = 'popularity',
    limitCount: number = 50
  ): Promise<Discussion[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (filters?.courseId) {
        constraints.push(where('courseId', '==', filters.courseId));
      }
      if (filters?.professorId) {
        constraints.push(where('professorId', '==', filters.professorId));
      }
      if (filters?.clubId) {
        constraints.push(where('clubId', '==', filters.clubId));
      }
      if (filters?.userId) {
        constraints.push(where('userId', '==', filters.userId));
      }

      switch (sortBy) {
        case 'popularity':
          constraints.push(orderBy('score', 'desc'));
          break;
        case 'controversy':
          constraints.push(orderBy('controversy', 'desc'));
          break;
        case 'recent':
          constraints.push(orderBy('createdAt', 'desc'));
          break;
      }

      constraints.push(limit(limitCount));

      const q = query(collection(db, 'discussions'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Discussion[];
    } catch (error) {
      console.error('Error getting discussions:', error);
      return [];
    }
  }

  static async voteDiscussion(
    discussionId: string,
    userId: string,
    voteType: 'upvote' | 'downvote' | 'remove'
  ): Promise<void> {
    try {
      const discussionRef = doc(db, 'discussions', discussionId);
      const discussionDoc = await getDoc(discussionRef);
      
      if (!discussionDoc.exists()) throw new Error('Discussion not found');

      const data = discussionDoc.data();
      let upvotes = [...(data.upvotes || [])];
      let downvotes = [...(data.downvotes || [])];

      // Remove existing votes
      upvotes = upvotes.filter(id => id !== userId);
      downvotes = downvotes.filter(id => id !== userId);

      // Add new vote if not removing
      if (voteType === 'upvote') {
        upvotes.push(userId);
      } else if (voteType === 'downvote') {
        downvotes.push(userId);
      }

      await updateDoc(discussionRef, {
        upvotes,
        downvotes,
        score: upvotes.length - downvotes.length,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error voting on discussion:', error);
      throw error;
    }
  }

  // Course Operations
  static async getCourse(courseId: string): Promise<Course | null> {
    try {
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) return null;
      return { id: courseDoc.id, ...courseDoc.data() } as Course;
    } catch (error) {
      console.error('Error getting course:', error);
      return null;
    }
  }

  static async getCourses(universityId: string): Promise<Course[]> {
    try {
      const q = query(
        collection(db, 'courses'),
        where('universityId', '==', universityId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Handle createdAt - it might be a Timestamp, Date, null, or undefined
        let createdAt = new Date();
        if (data.createdAt != null) {
          try {
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
              // It's a Firestore Timestamp
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt instanceof Date) {
              // It's already a Date
              createdAt = data.createdAt;
            } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
              // It's a string or timestamp number
              const parsedDate = new Date(data.createdAt);
              if (!isNaN(parsedDate.getTime())) {
                createdAt = parsedDate;
              }
            }
          } catch (dateError) {
            console.warn('Error parsing createdAt for course:', doc.id, dateError);
            // createdAt already defaults to new Date()
          }
        }
        
        // Handle professors - in database it's string[] (IDs), but TypeScript type says Professor[]
        // For onboarding, we just need an empty array since we don't need full professor objects
        const professors: Professor[] = [];
        
        return {
          id: doc.id,
          code: data.code || '',
          name: data.name || '',
          description: data.description || undefined,
          universityId: data.universityId || universityId,
          professors,
          createdAt,
        } as Course;
      });
    } catch (error) {
      console.error('Error getting courses:', error);
      return [];
    }
  }

  static async createCourse(course: Omit<Course, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'courses'), {
        ...course,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  }

  // Professor Operations
  static async getProfessor(professorId: string): Promise<Professor | null> {
    try {
      const profDoc = await getDoc(doc(db, 'professors', professorId));
      if (!profDoc.exists()) return null;
      return { id: profDoc.id, ...profDoc.data() } as Professor;
    } catch (error) {
      console.error('Error getting professor:', error);
      return null;
    }
  }

  static async rateProfessor(
    professorId: string,
    courseId: string,
    userId: string,
    rating: Omit<ProfessorRating, 'userId' | 'courseId' | 'createdAt'>
  ): Promise<void> {
    try {
      const ratingRef = doc(db, 'professors', professorId, 'ratings', `${userId}_${courseId}`);
      await setDoc(ratingRef, {
        userId,
        courseId,
        ...rating,
        createdAt: Timestamp.now(),
      });

      // Update professor average rating
      const ratingsSnapshot = await getDocs(
        collection(db, 'professors', professorId, 'ratings')
      );
      const ratings = ratingsSnapshot.docs.map(doc => doc.data() as ProfessorRating);
      
      const averages = {
        hardness: ratings.reduce((sum, r) => sum + r.hardness, 0) / ratings.length,
        coursework: ratings.reduce((sum, r) => sum + r.coursework, 0) / ratings.length,
        communication: ratings.reduce((sum, r) => sum + r.communication, 0) / ratings.length,
        enjoyment: ratings.reduce((sum, r) => sum + r.enjoyment, 0) / ratings.length,
      };

      await updateDoc(doc(db, 'professors', professorId), {
        averageRating: averages,
      });
    } catch (error) {
      console.error('Error rating professor:', error);
      throw error;
    }
  }

  // Club Operations
  static async getClub(clubId: string): Promise<Club | null> {
    try {
      const clubDoc = await getDoc(doc(db, 'clubs', clubId));
      if (!clubDoc.exists()) return null;
      return { id: clubDoc.id, ...clubDoc.data() } as Club;
    } catch (error) {
      console.error('Error getting club:', error);
      return null;
    }
  }

  static async getClubs(universityId: string): Promise<Club[]> {
    try {
      const q = query(
        collection(db, 'clubs'),
        where('universityId', '==', universityId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Club[];
    } catch (error) {
      console.error('Error getting clubs:', error);
      return [];
    }
  }

  static async rateClub(
    clubId: string,
    userId: string,
    rating: Omit<ClubRating, 'userId' | 'createdAt'>
  ): Promise<void> {
    try {
      const ratingRef = doc(db, 'clubs', clubId, 'ratings', userId);
      await setDoc(ratingRef, {
        userId,
        ...rating,
        createdAt: Timestamp.now(),
      });

      // Update club average rating
      const ratingsSnapshot = await getDocs(
        collection(db, 'clubs', clubId, 'ratings')
      );
      const ratings = ratingsSnapshot.docs.map(doc => doc.data() as ClubRating);
      
      const averages = {
        engagement: ratings.reduce((sum, r) => sum + r.engagement, 0) / ratings.length,
        community: ratings.reduce((sum, r) => sum + r.community, 0) / ratings.length,
        events: ratings.reduce((sum, r) => sum + r.events, 0) / ratings.length,
        overall: ratings.reduce((sum, r) => sum + r.overall, 0) / ratings.length,
      };

      await updateDoc(doc(db, 'clubs', clubId), {
        averageRating: averages,
      });
    } catch (error) {
      console.error('Error rating club:', error);
      throw error;
    }
  }

  // Organization Operations
  static async getOrganizations(): Promise<Organization[]> {
    try {
      const q = query(collection(db, 'organizations'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          logo: data.logo || '',
          description: data.description || '',
          colors: data.colors || { primary: '#6366f1', secondary: '#8b92a7' },
          members: data.members || [],
        } as Organization;
      });
    } catch (error) {
      console.error('Error getting organizations:', error);
      return [];
    }
  }

  /**
   * Submit a course request for verification
   */
  static async requestCourse(course: { code: string; name: string; description?: string; universityId: string; professors?: string[] }, userId: string): Promise<string> {
    try {
      // Get all existing courses and check for duplicates (case-insensitive)
      const existingSnapshot = await getDocs(query(collection(db, 'courses'), where('universityId', '==', course.universityId)));
      const requestsSnapshot = await getDocs(query(collection(db, 'course_requests'), where('universityId', '==', course.universityId)));

      // Check for duplicates (case-insensitive) - check both code and name
      const allCourses = [...existingSnapshot.docs, ...requestsSnapshot.docs];
      const duplicate = allCourses.find(doc => {
        const data = doc.data();
        return (data.code || '').toLowerCase().trim() === course.code.toLowerCase().trim() ||
               ((data.name || '').toLowerCase().trim() === course.name.toLowerCase().trim() && data.universityId === course.universityId);
      });

      if (duplicate) {
        throw new Error('A course with this code or name already exists or is pending review for this university');
      }

      // Create request document
      const docRef = await addDoc(collection(db, 'course_requests'), {
        ...course,
        professors: course.professors || [],
        codeLowercase: course.code.toLowerCase().trim(),
        nameLowercase: course.name.toLowerCase().trim(),
        userId: userId,
        status: 'pending',
        requestedAt: Timestamp.now(),
        verified: false,
      });
      
      // Check if we've reached the threshold (100 requests) and process if so
      const allRequests = await getDocs(collection(db, 'course_requests'));
      if (allRequests.size >= 100) {
        DatabaseService.processCourseRequests().catch(error => {
          console.error('Error processing course requests:', error);
        });
      }
      
      return docRef.id;
    } catch (error: any) {
      console.error('Error requesting course:', error);
      throw error;
    }
  }

  /**
   * Submit an organization request for verification
   */
  static async requestOrganization(organization: { name: string; logo: string; description: string; colors: { primary: string; secondary: string } }, userId: string): Promise<string> {
    try {
      // Get all existing organizations and check for duplicates (case-insensitive)
      const existingSnapshot = await getDocs(collection(db, 'organizations'));
      const requestsSnapshot = await getDocs(collection(db, 'organization_requests'));

      // Check for duplicates (case-insensitive)
      const allOrganizations = [...existingSnapshot.docs, ...requestsSnapshot.docs];
      const duplicate = allOrganizations.find(doc => {
        const data = doc.data();
        return (data.name || '').toLowerCase().trim() === organization.name.toLowerCase().trim();
      });

      if (duplicate) {
        throw new Error('An organization with this name already exists or is pending review');
      }

      // Create request document
      const docRef = await addDoc(collection(db, 'organization_requests'), {
        ...organization,
        nameLowercase: organization.name.toLowerCase().trim(),
        members: [],
        userId: userId,
        status: 'pending',
        requestedAt: Timestamp.now(),
        verified: false,
      });
      
      // Check if we've reached the threshold (100 requests) and process if so
      const allRequests = await getDocs(collection(db, 'organization_requests'));
      if (allRequests.size >= 100) {
        DatabaseService.processOrganizationRequests().catch(error => {
          console.error('Error processing organization requests:', error);
        });
      }
      
      return docRef.id;
    } catch (error: any) {
      console.error('Error requesting organization:', error);
      throw error;
    }
  }

  // Message Operations
  static async sendMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'messages'), {
        ...message,
        read: false,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static async getConversations(userId: string): Promise<Conversation[]> {
    try {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Conversation[];
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  static async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const q = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Message[];
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  // Search Operations
  static async searchUsers(query: string, universityId: string): Promise<User[]> {
    try {
      // Note: Firestore doesn't support full-text search natively
      // For production, consider using Algolia or similar
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
      
      return allUsers.filter(user => {
        const userUniversityId = typeof user.university === 'string' 
          ? user.university 
          : user.university?.id;
        return userUniversityId === universityId &&
          (user.name.toLowerCase().includes(query.toLowerCase()) ||
           user.email.toLowerCase().includes(query.toLowerCase()));
      });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  // Follow/Unfollow Operations
  static async followUser(followerId: string, followingId: string): Promise<void> {
    try {
      const followerRef = doc(db, 'users', followerId);
      const followingRef = doc(db, 'users', followingId);
      
      const followerDoc = await getDoc(followerRef);
      const followingDoc = await getDoc(followingRef);
      
      const followerFollowing = [...(followerDoc.data()?.following || []), followingId];
      const followingFollowers = [...(followingDoc.data()?.followers || []), followerId];
      
      await updateDoc(followerRef, { following: followerFollowing });
      await updateDoc(followingRef, { followers: followingFollowers });
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    }
  }

  static async unfollowUser(followerId: string, followingId: string): Promise<void> {
    try {
      const followerRef = doc(db, 'users', followerId);
      const followingRef = doc(db, 'users', followingId);
      
      const followerDoc = await getDoc(followerRef);
      const followingDoc = await getDoc(followingRef);
      
      const followerFollowing = (followerDoc.data()?.following || []).filter(
        (id: string) => id !== followingId
      );
      const followingFollowers = (followingDoc.data()?.followers || []).filter(
        (id: string) => id !== followerId
      );
      
      await updateDoc(followerRef, { following: followerFollowing });
      await updateDoc(followingRef, { followers: followingFollowers });
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  }

  // University Operations
  static async getUniversities(): Promise<University[]> {
    try {
      const q = query(collection(db, 'universities'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          logo: data.logo || '',
          image: data.image || '',
          colors: data.colors || { primary: '#6366f1', secondary: '#8b92a7' },
        } as University;
      });
    } catch (error) {
      console.error('Error getting universities:', error);
      return [];
    }
  }

  static async getUniversity(universityId: string): Promise<University | null> {
    try {
      const universityDoc = await getDoc(doc(db, 'universities', universityId));
      if (!universityDoc.exists()) return null;
      return { id: universityDoc.id, ...universityDoc.data() } as University;
    } catch (error) {
      console.error('Error getting university:', error);
      return null;
    }
  }

  /**
   * Submit a university request for verification
   * This creates a request document that can be reviewed before adding to the main universities collection
   */
  static async requestUniversity(university: Omit<University, 'id'>, userId: string): Promise<string> {
    try {
      // Get all existing universities and check for duplicates (case-insensitive)
      const existingSnapshot = await getDocs(collection(db, 'universities'));
      const requestsSnapshot = await getDocs(collection(db, 'university_requests'));

      // Check for duplicates (case-insensitive)
      const allUniversities = [...existingSnapshot.docs, ...requestsSnapshot.docs];
      const duplicate = allUniversities.find(doc => {
        const data = doc.data();
        return (data.name || '').toLowerCase().trim() === university.name.toLowerCase().trim();
      });

      if (duplicate) {
        throw new Error('A university with this name already exists or is pending review');
      }

      // Create request document with lowercase name for easier querying
      const docRef = await addDoc(collection(db, 'university_requests'), {
        ...university,
        nameLowercase: university.name.toLowerCase().trim(), // Store lowercase for easier duplicate checking
        userId: userId, // Track who submitted the request
        status: 'pending',
        requestedAt: Timestamp.now(),
        verified: false,
      });
      
      // Check if we've reached the threshold (100 requests) and process if so
      const allRequests = await getDocs(collection(db, 'university_requests'));
      if (allRequests.size >= 100) {
        // Process requests in background (don't await to avoid blocking)
        DatabaseService.processUniversityRequests().catch(error => {
          console.error('Error processing university requests:', error);
        });
      }
      
      return docRef.id;
    } catch (error: any) {
      console.error('Error requesting university:', error);
      throw error;
    }
  }

  /**
   * Helper function to calculate string similarity (normalized Levenshtein distance)
   * Returns a value between 0 (completely different) and 1 (identical)
   */
  private static stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    // If the longer string is more than 50% longer, similarity is low
    if (longer.length > shorter.length * 1.5) return 0.0;

    // Calculate Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= shorter.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= longer.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= shorter.length; i++) {
      for (let j = 1; j <= longer.length; j++) {
        if (shorter.charAt(i - 1) === longer.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[shorter.length][longer.length];
    return 1 - (distance / longer.length);
  }

  /**
   * Helper function to find the most common value in an array
   */
  private static findMostCommon<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    
    const counts = new Map<T, number>();
    arr.forEach(item => {
      const key = item as T;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    let mostCommon: T | null = null;
    let maxCount = 0;
    
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  /**
   * Helper function to find the most common non-empty value
   */
  private static findMostCommonNonEmpty(arr: string[]): string | null {
    const nonEmpty = arr.filter(val => val && val.trim().length > 0);
    if (nonEmpty.length === 0) return null;
    return this.findMostCommon(nonEmpty) || nonEmpty[0] || null;
  }

  /**
   * Process university requests when threshold (100) is reached
   * Groups similar names, finds most common values, and creates universities
   * NOTE: In production, this should be a Firebase Cloud Function for better security and automation
   */
  static async processUniversityRequests(): Promise<void> {
    try {
      const requestsSnapshot = await getDocs(collection(db, 'university_requests'));
      
      if (requestsSnapshot.size < 100) {
        console.log(`Only ${requestsSnapshot.size} requests, threshold not reached`);
        return;
      }

      console.log(`Processing ${requestsSnapshot.size} university requests...`);

      // Get existing universities for duplicate checking
      const existingSnapshot = await getDocs(collection(db, 'universities'));
      const existingNames = new Set(
        existingSnapshot.docs.map(doc => doc.data().nameLowercase || doc.data().name?.toLowerCase().trim())
      );

      // Group requests by similar names
      const requestDocs = requestsSnapshot.docs;
      const processed = new Set<string>();
      const groups: Array<Array<typeof requestDocs[0]>> = [];

      for (let i = 0; i < requestDocs.length; i++) {
        if (processed.has(requestDocs[i].id)) continue;

        const group = [requestDocs[i]];
        processed.add(requestDocs[i].id);

        for (let j = i + 1; j < requestDocs.length; j++) {
          if (processed.has(requestDocs[j].id)) continue;

          const req1 = requestDocs[i].data();
          const req2 = requestDocs[j].data();
          const name1 = req1.name?.toLowerCase().trim() || '';
          const name2 = req2.name?.toLowerCase().trim() || '';

          // If similarity is >= 0.75 (75%), group them together
          if (name1 && name2 && this.stringSimilarity(name1, name2) >= 0.75) {
            group.push(requestDocs[j]);
            processed.add(requestDocs[j].id);
          }
        }

        groups.push(group);
      }

      console.log(`Grouped ${requestDocs.length} requests into ${groups.length} groups`);

      // Process each group and create universities
      const universitiesToAdd: Array<{ name: string; logo: string; image: string; colors: { primary: string; secondary: string } }> = [];
      const requestIdsToDelete: string[] = [];

      for (const group of groups) {
        if (group.length === 0) continue;

        // Extract all values from the group
        const names = group.map(doc => doc.data().name || '').filter(n => n.trim());
        const logos = group.map(doc => doc.data().logo || '').filter(l => l.trim());
        const images = group.map(doc => doc.data().image || '').filter(i => i.trim());
        const primaryColors = group.map(doc => doc.data().colors?.primary || '').filter(c => c.trim());
        const secondaryColors = group.map(doc => doc.data().colors?.secondary || '').filter(c => c.trim());

        // Find most common values
        const mostCommonName = this.findMostCommonNonEmpty(names);
        if (!mostCommonName) continue;

        // Check for duplicate against existing universities
        const nameLowercase = mostCommonName.toLowerCase().trim();
        if (existingNames.has(nameLowercase)) {
          console.log(`Skipping duplicate: ${mostCommonName}`);
          // Still delete these requests as they're duplicates
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }

        // Get most common values, with fallbacks
        const logo = this.findMostCommonNonEmpty(logos) || '';
        const image = this.findMostCommonNonEmpty(images) || '';
        const primaryColor = this.findMostCommonNonEmpty(primaryColors) || '#182B49';
        const secondaryColor = this.findMostCommonNonEmpty(secondaryColors) || '#C69214';

        // Prepare university data
        const universityData = {
          name: mostCommonName.trim(),
          logo: logo.trim(),
          image: image.trim(),
          colors: {
            primary: primaryColor.trim(),
            secondary: secondaryColor.trim(),
          },
        };

        universitiesToAdd.push(universityData);
        existingNames.add(nameLowercase); // Prevent duplicates within this batch

        // Mark all requests in this group for deletion
        group.forEach(doc => requestIdsToDelete.push(doc.id));
      }

      // Firestore batch limit is 500 operations
      // We need to split into multiple batches if needed
      const MAX_BATCH_SIZE = 500;
      let batchOps = 0;
      let currentBatch = writeBatch(db);
      const batches: typeof currentBatch[] = [currentBatch];

      // Add all universities
      for (const uniData of universitiesToAdd) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const newUniRef = doc(collection(db, 'universities'));
        currentBatch.set(newUniRef, {
          ...uniData,
          nameLowercase: uniData.name.toLowerCase().trim(),
          createdAt: Timestamp.now(),
        });
        batchOps++;
      }

      // Delete all processed requests
      for (const requestId of requestIdsToDelete) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const requestRef = doc(db, 'university_requests', requestId);
        currentBatch.delete(requestRef);
        batchOps++;
      }

      // Commit all batches sequentially
      for (const batchToCommit of batches) {
        await batchToCommit.commit();
      }

      console.log(`Successfully processed ${universitiesToAdd.length} universities and deleted ${requestIdsToDelete.length} requests`);
    } catch (error) {
      console.error('Error processing university requests:', error);
      throw error;
    }
  }

  /**
   * Process course requests when threshold (100) is reached
   */
  static async processCourseRequests(): Promise<void> {
    try {
      const requestsSnapshot = await getDocs(collection(db, 'course_requests'));
      
      if (requestsSnapshot.size < 100) {
        console.log(`Only ${requestsSnapshot.size} course requests, threshold not reached`);
        return;
      }

      console.log(`Processing ${requestsSnapshot.size} course requests...`);

      // Get existing courses for duplicate checking (grouped by universityId)
      const existingSnapshot = await getDocs(collection(db, 'courses'));
      const existingCourses = new Map<string, Set<string>>(); // universityId -> Set of (codeLowercase + nameLowercase)
      
      existingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const uniId = data.universityId || '';
        if (!existingCourses.has(uniId)) {
          existingCourses.set(uniId, new Set());
        }
        const key = `${(data.code || '').toLowerCase().trim()}_${(data.name || '').toLowerCase().trim()}`;
        existingCourses.get(uniId)!.add(key);
      });

      // Group requests by similar names (per university)
      const requestDocs = requestsSnapshot.docs;
      const processed = new Set<string>();
      const groups: Array<Array<typeof requestDocs[0]>> = [];

      for (let i = 0; i < requestDocs.length; i++) {
        if (processed.has(requestDocs[i].id)) continue;

        const group = [requestDocs[i]];
        processed.add(requestDocs[i].id);
        const uniId1 = requestDocs[i].data().universityId || '';

        for (let j = i + 1; j < requestDocs.length; j++) {
          if (processed.has(requestDocs[j].id)) continue;

          const req2 = requestDocs[j].data();
          const uniId2 = req2.universityId || '';
          
          // Only group if same university
          if (uniId1 !== uniId2) continue;

          const req1 = requestDocs[i].data();
          const code1 = (req1.code || '').toLowerCase().trim();
          const code2 = (req2.code || '').toLowerCase().trim();
          const name1 = (req1.name || '').toLowerCase().trim();
          const name2 = (req2.name || '').toLowerCase().trim();

          // If code or name similarity is >= 0.75, group them together
          if ((code1 && code2 && this.stringSimilarity(code1, code2) >= 0.75) ||
              (name1 && name2 && this.stringSimilarity(name1, name2) >= 0.75)) {
            group.push(requestDocs[j]);
            processed.add(requestDocs[j].id);
          }
        }

        groups.push(group);
      }

      console.log(`Grouped ${requestDocs.length} course requests into ${groups.length} groups`);

      // Process each group and create courses
      const coursesToAdd: Array<{ code: string; name: string; description?: string; universityId: string; professors: string[] }> = [];
      const requestIdsToDelete: string[] = [];

      for (const group of groups) {
        if (group.length === 0) continue;

        const firstData = group[0].data();
        const uniId = firstData.universityId || '';
        
        // Extract all values from the group
        const codes = group.map(doc => doc.data().code || '').filter(c => c.trim());
        const names = group.map(doc => doc.data().name || '').filter(n => n.trim());
        const descriptions = group.map(doc => doc.data().description || '').filter(d => d.trim());
        
        // Extract professors from all requests in the group (case-sensitive, unique)
        const allProfessors: string[] = [];
        group.forEach(doc => {
          const profs = doc.data().professors || [];
          if (Array.isArray(profs)) {
            profs.forEach((prof: string) => {
              if (prof && prof.trim() && !allProfessors.includes(prof.trim())) {
                allProfessors.push(prof.trim());
              }
            });
          }
        });

        // Find most common values
        const mostCommonCode = this.findMostCommonNonEmpty(codes);
        const mostCommonName = this.findMostCommonNonEmpty(names);
        if (!mostCommonCode || !mostCommonName || !uniId) continue;

        // Check for duplicate against existing courses for this university
        const key = `${mostCommonCode.toLowerCase().trim()}_${mostCommonName.toLowerCase().trim()}`;
        if (existingCourses.has(uniId) && existingCourses.get(uniId)!.has(key)) {
          console.log(`Skipping duplicate course: ${mostCommonCode} - ${mostCommonName}`);
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }

        // Get most common description
        const description = this.findMostCommonNonEmpty(descriptions) || undefined;

        // Prepare course data with unique professors (case-sensitive)
        const courseData = {
          code: mostCommonCode.trim(),
          name: mostCommonName.trim(),
          description: description?.trim(),
          universityId: uniId,
          professors: allProfessors, // Unique professors from all requests (case-sensitive)
        };

        coursesToAdd.push(courseData);
        if (!existingCourses.has(uniId)) {
          existingCourses.set(uniId, new Set());
        }
        existingCourses.get(uniId)!.add(key); // Prevent duplicates within this batch

        // Mark all requests in this group for deletion
        group.forEach(doc => requestIdsToDelete.push(doc.id));
      }

      // Firestore batch limit is 500 operations
      const MAX_BATCH_SIZE = 500;
      let batchOps = 0;
      let currentBatch = writeBatch(db);
      const batches: typeof currentBatch[] = [currentBatch];

      // Add all courses
      for (const courseData of coursesToAdd) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const newCourseRef = doc(collection(db, 'courses'));
        currentBatch.set(newCourseRef, {
          ...courseData,
          professors: courseData.professors || [], // Include professors from courseData
          createdAt: Timestamp.now(),
        });
        batchOps++;
      }

      // Delete all processed requests
      for (const requestId of requestIdsToDelete) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const requestRef = doc(db, 'course_requests', requestId);
        currentBatch.delete(requestRef);
        batchOps++;
      }

      // Commit all batches sequentially
      for (const batchToCommit of batches) {
        await batchToCommit.commit();
      }

      console.log(`Successfully processed ${coursesToAdd.length} courses and deleted ${requestIdsToDelete.length} requests`);
    } catch (error) {
      console.error('Error processing course requests:', error);
      throw error;
    }
  }

  /**
   * Process organization requests when threshold (100) is reached
   */
  static async processOrganizationRequests(): Promise<void> {
    try {
      const requestsSnapshot = await getDocs(collection(db, 'organization_requests'));
      
      if (requestsSnapshot.size < 100) {
        console.log(`Only ${requestsSnapshot.size} organization requests, threshold not reached`);
        return;
      }

      console.log(`Processing ${requestsSnapshot.size} organization requests...`);

      // Get existing organizations for duplicate checking
      const existingSnapshot = await getDocs(collection(db, 'organizations'));
      const existingNames = new Set(
        existingSnapshot.docs.map(doc => doc.data().nameLowercase || doc.data().name?.toLowerCase().trim())
      );

      // Group requests by similar names
      const requestDocs = requestsSnapshot.docs;
      const processed = new Set<string>();
      const groups: Array<Array<typeof requestDocs[0]>> = [];

      for (let i = 0; i < requestDocs.length; i++) {
        if (processed.has(requestDocs[i].id)) continue;

        const group = [requestDocs[i]];
        processed.add(requestDocs[i].id);

        for (let j = i + 1; j < requestDocs.length; j++) {
          if (processed.has(requestDocs[j].id)) continue;

          const req1 = requestDocs[i].data();
          const req2 = requestDocs[j].data();
          const name1 = (req1.name || '').toLowerCase().trim();
          const name2 = (req2.name || '').toLowerCase().trim();

          // If similarity is >= 0.75 (75%), group them together
          if (name1 && name2 && this.stringSimilarity(name1, name2) >= 0.75) {
            group.push(requestDocs[j]);
            processed.add(requestDocs[j].id);
          }
        }

        groups.push(group);
      }

      console.log(`Grouped ${requestDocs.length} organization requests into ${groups.length} groups`);

      // Process each group and create organizations
      const organizationsToAdd: Array<{ name: string; logo: string; description: string; colors: { primary: string; secondary: string } }> = [];
      const requestIdsToDelete: string[] = [];

      for (const group of groups) {
        if (group.length === 0) continue;

        // Extract all values from the group
        const names = group.map(doc => doc.data().name || '').filter(n => n.trim());
        const logos = group.map(doc => doc.data().logo || '').filter(l => l.trim());
        const descriptions = group.map(doc => doc.data().description || '').filter(d => d.trim());
        const primaryColors = group.map(doc => doc.data().colors?.primary || '').filter(c => c.trim());
        const secondaryColors = group.map(doc => doc.data().colors?.secondary || '').filter(c => c.trim());

        // Find most common values
        const mostCommonName = this.findMostCommonNonEmpty(names);
        if (!mostCommonName) continue;

        // Check for duplicate against existing organizations
        const nameLowercase = mostCommonName.toLowerCase().trim();
        if (existingNames.has(nameLowercase)) {
          console.log(`Skipping duplicate organization: ${mostCommonName}`);
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }

        // Get most common values, with fallbacks
        const logo = this.findMostCommonNonEmpty(logos) || '';
        const description = this.findMostCommonNonEmpty(descriptions) || '';
        const primaryColor = this.findMostCommonNonEmpty(primaryColors) || '#6366f1';
        const secondaryColor = this.findMostCommonNonEmpty(secondaryColors) || '#8b92a7';

        // Prepare organization data
        const organizationData = {
          name: mostCommonName.trim(),
          logo: logo.trim(),
          description: description.trim(),
          colors: {
            primary: primaryColor.trim(),
            secondary: secondaryColor.trim(),
          },
        };

        organizationsToAdd.push(organizationData);
        existingNames.add(nameLowercase); // Prevent duplicates within this batch

        // Mark all requests in this group for deletion
        group.forEach(doc => requestIdsToDelete.push(doc.id));
      }

      // Firestore batch limit is 500 operations
      const MAX_BATCH_SIZE = 500;
      let batchOps = 0;
      let currentBatch = writeBatch(db);
      const batches: typeof currentBatch[] = [currentBatch];

      // Add all organizations
      for (const orgData of organizationsToAdd) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const newOrgRef = doc(collection(db, 'organizations'));
        currentBatch.set(newOrgRef, {
          ...orgData,
          nameLowercase: orgData.name.toLowerCase().trim(),
          members: [],
        });
        batchOps++;
      }

      // Delete all processed requests
      for (const requestId of requestIdsToDelete) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const requestRef = doc(db, 'organization_requests', requestId);
        currentBatch.delete(requestRef);
        batchOps++;
      }

      // Commit all batches sequentially
      for (const batchToCommit of batches) {
        await batchToCommit.commit();
      }

      console.log(`Successfully processed ${organizationsToAdd.length} organizations and deleted ${requestIdsToDelete.length} requests`);
    } catch (error) {
      console.error('Error processing organization requests:', error);
      throw error;
    }
  }
}
