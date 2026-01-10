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
  arrayUnion,
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
      // Validate userId before attempting to fetch
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.error('Invalid userId provided to getUser:', userId);
        return null;
      }
      
      const userDoc = await getDoc(doc(db, 'users', userId.trim()));
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
      // Filter out undefined values - Firestore doesn't store undefined fields
      const discussionData: any = {
        userId: discussion.userId,
        title: discussion.title,
        content: discussion.content,
        tags: discussion.tags || [],
        upvotes: discussion.upvotes || [],
        downvotes: discussion.downvotes || [],
        comments: discussion.comments || [],
        score: 0,
        controversy: 0,
        isPrivate: discussion.isPrivate || false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only include optional fields if they exist (not undefined)
      if (discussion.images && discussion.images.length > 0) {
        discussionData.images = discussion.images;
      }
      // Normalize and include courseId/organizationId if provided
      if (discussion.courseId && typeof discussion.courseId === 'string' && discussion.courseId.trim()) {
        discussionData.courseId = discussion.courseId.trim();
      }
      if (discussion.organizationId && typeof discussion.organizationId === 'string' && discussion.organizationId.trim()) {
        discussionData.organizationId = discussion.organizationId.trim();
      }
      if (discussion.professorId && typeof discussion.professorId === 'string' && discussion.professorId.trim()) {
        discussionData.professorId = discussion.professorId.trim();
      }
      if (discussion.clubId && typeof discussion.clubId === 'string' && discussion.clubId.trim()) {
        discussionData.clubId = discussion.clubId.trim();
      }

      const docRef = await addDoc(collection(db, 'discussions'), discussionData);
      
      // Log for debugging
      console.log('Discussion created successfully:', {
        id: docRef.id,
        courseId: discussionData.courseId || 'none',
        organizationId: discussionData.organizationId || 'none',
        isPrivate: discussionData.isPrivate,
        title: discussionData.title.substring(0, 50),
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
      organizationId?: string;
      tags?: string[];
      userId?: string;
      isPrivate?: boolean;
    },
    sortBy: SortOption = 'popularity',
    limitCount: number = 50
  ): Promise<Discussion[]> {
    try {
      const constraints: QueryConstraint[] = [];

      // Normalize filters to ensure consistent matching (trim whitespace)
      if (filters?.courseId && typeof filters.courseId === 'string' && filters.courseId.trim()) {
        constraints.push(where('courseId', '==', filters.courseId.trim()));
      }
      if (filters?.professorId && typeof filters.professorId === 'string' && filters.professorId.trim()) {
        constraints.push(where('professorId', '==', filters.professorId.trim()));
      }
      if (filters?.clubId && typeof filters.clubId === 'string' && filters.clubId.trim()) {
        constraints.push(where('clubId', '==', filters.clubId.trim()));
      }
      if (filters?.organizationId && typeof filters.organizationId === 'string' && filters.organizationId.trim()) {
        constraints.push(where('organizationId', '==', filters.organizationId.trim()));
      }
      if (filters?.userId && typeof filters.userId === 'string' && filters.userId.trim()) {
        constraints.push(where('userId', '==', filters.userId.trim()));
      }
      if (filters?.isPrivate !== undefined) {
        constraints.push(where('isPrivate', '==', filters.isPrivate));
      }

      // Check if we have any filters (not just constraints, since orderBy adds constraints)
      const hasFilters = filters && (
        filters.courseId || 
        filters.professorId || 
        filters.clubId || 
        filters.organizationId || 
        filters.userId || 
        filters.isPrivate !== undefined ||
        (filters.tags && filters.tags.length > 0)
      );

      // Note: Sorting requires composite indexes when filtering by courseId/organizationId
      // To avoid index issues, we'll sort client-side when filtering
      // When filtering by courseId/organizationId (with or without isPrivate), we cannot use orderBy without a composite index
      let needsClientSort = false;
      
      // Check if we're filtering by courseId or organizationId
      const isFilteringByCourseOrOrg = !!(filters?.courseId || filters?.organizationId);
      
      if (isFilteringByCourseOrOrg) {
        // When filtering by courseId or organizationId (with or without isPrivate), sort client-side to avoid composite index
        // Do NOT add orderBy here - it requires a composite index
        needsClientSort = true;
        // IMPORTANT: Do not add any orderBy constraints when filtering by courseId/organizationId
      } else {
        // No courseId/organizationId filter - try server-side sorting
        switch (sortBy) {
          case 'popularity':
            // Try to sort by score, but fallback to client-side if not available
            try {
              constraints.push(orderBy('score', 'desc'));
            } catch {
              needsClientSort = true;
            }
            break;
          case 'controversy':
            try {
              constraints.push(orderBy('controversy', 'desc'));
            } catch {
              needsClientSort = true;
            }
            break;
          case 'recent':
            constraints.push(orderBy('createdAt', 'desc'));
            break;
        }
      }

      // Always add a limit, but use a higher limit when no filters (for bulletin/cross-posting)
      // When no filters are provided, we want all discussions for cross-posting
      const actualLimit = hasFilters ? limitCount : Math.max(limitCount, 500);
      constraints.push(limit(actualLimit));

      const q = query(collection(db, 'discussions'), ...constraints);
      
      // Log query details for debugging
      const hasCourseOrOrgFilter = !!(filters?.courseId || filters?.organizationId);
      console.log('Querying discussions:', {
        filters: {
          courseId: filters?.courseId,
          organizationId: filters?.organizationId,
          isPrivate: filters?.isPrivate,
        },
        hasCourseOrOrgFilter,
        sortBy,
        needsClientSort,
        constraintsCount: constraints.length,
        willUseOrderBy: !hasCourseOrOrgFilter, // Should be false when filtering by courseId/orgId
      });
      
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error: any) {
        console.error('Error executing query:', error);
        // If it's an index error, return empty array and log
        if (error.code === 'failed-precondition' && error.message?.includes('index')) {
          console.warn('Query requires index. Returning empty array. Please create the index:', error.message);
          return [];
        }
        throw error;
      }
      
      let discussions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        let updatedAt = new Date();
        
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
          createdAt = data.createdAt;
        } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
          const parsedDate = new Date(data.createdAt);
          if (!isNaN(parsedDate.getTime())) {
            createdAt = parsedDate;
          }
        }
        
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
          updatedAt = data.updatedAt.toDate();
        } else if (data.updatedAt instanceof Date) {
          updatedAt = data.updatedAt;
        } else if (typeof data.updatedAt === 'string' || typeof data.updatedAt === 'number') {
          const parsedDate = new Date(data.updatedAt);
          if (!isNaN(parsedDate.getTime())) {
            updatedAt = parsedDate;
          }
        }

        return {
          id: doc.id,
          userId: data.userId || '',
          title: data.title || '',
          content: data.content || '',
          tags: data.tags || [],
          upvotes: data.upvotes || [],
          downvotes: data.downvotes || [],
          comments: data.comments || [],
          score: data.score || 0,
          controversy: data.controversy || 0,
          createdAt,
          updatedAt,
          // Optional fields - only include if they exist
          images: data.images || undefined,
          courseId: data.courseId || undefined,
          organizationId: data.organizationId || undefined,
          professorId: data.professorId || undefined,
          clubId: data.clubId || undefined,
          isPrivate: data.isPrivate || false,
          enrolledUsers: data.enrolledUsers || undefined,
        } as Discussion;
      });

      // Client-side sorting if needed (when filtering by courseId/organizationId or when server-side sort fails)
      if (needsClientSort) {
        if (sortBy === 'popularity') {
          discussions.sort((a, b) => {
            const aScore = (a.score || 0) + (a.upvotes?.length || 0) - (a.downvotes?.length || 0);
            const bScore = (b.score || 0) + (b.upvotes?.length || 0) - (b.downvotes?.length || 0);
            return bScore - aScore;
          });
        } else if (sortBy === 'controversy') {
          discussions.sort((a, b) => (b.controversy || 0) - (a.controversy || 0));
        } else if (sortBy === 'recent') {
          // Already sorted by createdAt from server, but ensure it's correct
          discussions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
      }

      return discussions;
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
      
      const data = courseDoc.data();
      
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
          console.warn('Error parsing createdAt for course:', courseDoc.id, dateError);
          // createdAt already defaults to new Date()
        }
      }

        // Convert string[] to Professor[] format for type compatibility (same as getCourses)
        const professorsData = data.professors || [];
        const professors: Professor[] = Array.isArray(professorsData) && professorsData.length > 0
          ? professorsData.map((prof: any, index: number) => {
              // If prof is a string (professor name), convert to Professor object
              // Default to max ratings when professor is just a name (no actual ratings yet)
              if (typeof prof === 'string') {
                return {
                  id: `prof-${index}-${prof.replace(/\s+/g, '-').toLowerCase()}`,
                  name: prof.trim(),
                  courses: [],
                  ratings: [],
                  averageRating: {
                    totalRating: 5,
                    difficulty: 1,
                    enjoyment: 5,
                    retakePercentage: 100,
                    understandability: 5,
                  },
                } as Professor;
              }
              // If it's already an object, use it as-is (with defaults if needed)
              // Handle both old and new averageRating structures
              const oldRating = prof.averageRating;
              const newRating = oldRating ? {
                // If rating is all zeros, default to max (professor has no actual ratings)
                totalRating: (oldRating.totalRating && oldRating.totalRating > 0) ? oldRating.totalRating : (oldRating.enjoyment ?? 5),
                difficulty: (oldRating.difficulty && oldRating.difficulty > 0) ? oldRating.difficulty : (oldRating.hardness ? 5 - oldRating.hardness + 1 : 1),
                enjoyment: (oldRating.enjoyment && oldRating.enjoyment > 0) ? oldRating.enjoyment : 5,
                retakePercentage: (oldRating.retakePercentage && oldRating.retakePercentage > 0) ? oldRating.retakePercentage : 100,
                understandability: (oldRating.understandability && oldRating.understandability > 0) ? oldRating.understandability : (oldRating.communication ?? 5),
              } : {
                totalRating: 5,
                difficulty: 1,
                enjoyment: 5,
                retakePercentage: 100,
                understandability: 5,
              };
              
              return {
                id: prof.id || `prof-${index}`,
                name: prof.name || '',
                email: prof.email,
                courses: prof.courses || [],
                ratings: prof.ratings || [],
                averageRating: newRating,
              } as Professor;
            })
          : [];
      
      // Handle members - array of user IDs
      const members: string[] = data.members || [];
      
      return {
        id: courseDoc.id,
        code: data.code || '',
        name: data.name || '',
        description: data.description || undefined,
        universityId: data.universityId || '',
        professors,
        members,
        createdAt,
      } as Course;
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
        
        // Handle professors - in database it's string[] (professor names), but TypeScript type says Professor[]
        // Convert string[] to Professor[] format for type compatibility
        const professorsData = data.professors || [];
        const professors: Professor[] = Array.isArray(professorsData) && professorsData.length > 0
          ? professorsData.map((prof: any, index: number) => {
              // If prof is a string (professor name), convert to Professor object
              // Default to max ratings when professor is just a name (no actual ratings yet)
              if (typeof prof === 'string') {
                return {
                  id: `prof-${index}-${prof.replace(/\s+/g, '-').toLowerCase()}`,
                  name: prof.trim(),
                  courses: [],
                  ratings: [],
                  averageRating: {
                    totalRating: 5,
                    difficulty: 1,
                    enjoyment: 5,
                    retakePercentage: 100,
                    understandability: 5,
                  },
                } as Professor;
              }
              // If it's already an object, use it as-is (with defaults if needed)
              // Handle both old and new averageRating structures
              const oldRating = prof.averageRating;
              const newRating = oldRating ? {
                // If rating is all zeros, default to max (professor has no actual ratings)
                totalRating: (oldRating.totalRating && oldRating.totalRating > 0) ? oldRating.totalRating : (oldRating.enjoyment ?? 5),
                difficulty: (oldRating.difficulty && oldRating.difficulty > 0) ? oldRating.difficulty : (oldRating.hardness ? 5 - oldRating.hardness + 1 : 1),
                enjoyment: (oldRating.enjoyment && oldRating.enjoyment > 0) ? oldRating.enjoyment : 5,
                retakePercentage: (oldRating.retakePercentage && oldRating.retakePercentage > 0) ? oldRating.retakePercentage : 100,
                understandability: (oldRating.understandability && oldRating.understandability > 0) ? oldRating.understandability : (oldRating.communication ?? 5),
              } : {
                totalRating: 5,
                difficulty: 1,
                enjoyment: 5,
                retakePercentage: 100,
                understandability: 5,
              };
              
              return {
                id: prof.id || `prof-${index}`,
                name: prof.name || '',
                email: prof.email,
                courses: prof.courses || [],
                ratings: prof.ratings || [],
                averageRating: newRating,
              } as Professor;
            })
          : [];
        
        // Handle members - array of user IDs
        const members: string[] = data.members || [];
        
        return {
          id: doc.id,
          code: data.code || '',
          name: data.name || '',
          description: data.description || undefined,
          universityId: data.universityId || universityId,
          professors,
          members,
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
      
      const data = profDoc.data();
      
      // Get all ratings for this professor
      const ratingsSnapshot = await getDocs(
        collection(db, 'professors', professorId, 'ratings')
      );
      
      const ratings = ratingsSnapshot.docs.map(doc => {
        const ratingData = doc.data();
        let createdAt = new Date();
        if (ratingData.createdAt && typeof ratingData.createdAt.toDate === 'function') {
          createdAt = ratingData.createdAt.toDate();
        } else if (ratingData.createdAt instanceof Date) {
          createdAt = ratingData.createdAt;
        }
        
        return {
          id: doc.id,
          ...ratingData,
          createdAt,
        } as ProfessorRating;
      });
      
      // Calculate average ratings from all ratings
      const totalRatings = ratings.length;
      let averages;
      
      if (totalRatings === 0) {
        // Default to max ratings (5/5) when no ratings exist
        // If stored averageRating exists with zeros, use max as default
        const storedRating = data.averageRating;
        if (storedRating && storedRating.totalRating === 0 && storedRating.difficulty === 0) {
          // If all zeros, default to max (except difficulty which starts at 1 - easy)
          averages = {
            totalRating: 5,
            difficulty: 1,
            enjoyment: 5,
            retakePercentage: 100,
            understandability: 5,
          };
        } else {
          // Use stored averageRating if it has values, otherwise default to max (except difficulty)
          averages = storedRating || {
            totalRating: 5,
            difficulty: 1,
            enjoyment: 5,
            retakePercentage: 100,
            understandability: 5,
          };
        }
      } else {
        // Calculate from actual ratings
        const avgDifficulty = ratings.reduce((sum, r) => sum + (r.difficulty || 0), 0) / totalRatings;
        const avgEnjoyment = ratings.reduce((sum, r) => sum + (r.enjoyment || 0), 0) / totalRatings;
        const avgUnderstandability = ratings.reduce((sum, r) => sum + (r.understandability || 0), 0) / totalRatings;
        const retakePercentage = (ratings.filter(r => r.retake === true).length / totalRatings) * 100;
        
        // Calculate overall rating as average of: inverted difficulty (low is good), enjoyment, understandability, and retake percentage
        // Invert difficulty: 6 - difficulty (so 1 difficulty = 5 score, 5 difficulty = 1 score)
        const invertedDifficulty = 6 - avgDifficulty; // 1 difficulty becomes 5 score, 5 difficulty becomes 1 score
        
        // Convert retake percentage to 1-5 scale (100% = 5, 0% = 1)
        const retakeScore = 1 + (retakePercentage / 100) * 4; // 0% = 1, 100% = 5
        
        // Average all four metrics (inverted difficulty, enjoyment, understandability, retake)
        const overallRating = (invertedDifficulty + avgEnjoyment + avgUnderstandability + retakeScore) / 4;
        
        averages = {
          totalRating: overallRating,
          difficulty: avgDifficulty,
          enjoyment: avgEnjoyment,
          retakePercentage: retakePercentage,
          understandability: avgUnderstandability,
        };
      }
      
      return {
        id: profDoc.id,
        name: data.name || '',
        email: data.email,
        image: data.image,
        courses: data.courses || [],
        universityId: data.universityId,
        ratings,
        averageRating: averages,
      } as Professor;
    } catch (error) {
      console.error('Error getting professor:', error);
      return null;
    }
  }

  static async getProfessors(universityId?: string, searchQuery?: string): Promise<Professor[]> {
    try {
      let q;
      if (universityId) {
        q = query(
          collection(db, 'professors'),
          where('universityId', '==', universityId)
        );
      } else {
        q = query(collection(db, 'professors'));
      }
      
      const querySnapshot = await getDocs(q);
      const professorPromises = querySnapshot.docs.map(doc => this.getProfessor(doc.id));
      
      const profsResult = await Promise.all(professorPromises);
      let profs = profsResult.filter((p): p is Professor => p !== null);
      
      // Filter by search query if provided
      if (searchQuery) {
        profs = profs.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      return profs;
    } catch (error) {
      console.error('Error getting professors:', error);
      return [];
    }
  }

  static async getOrCreateProfessor(name: string, universityId: string, email?: string): Promise<string> {
    try {
      // Search for existing professor by name and university
      const q = query(
        collection(db, 'professors'),
        where('universityId', '==', universityId)
      );
      const querySnapshot = await getDocs(q);
      
      const existingProf = querySnapshot.docs.find(doc => {
        const data = doc.data();
        return (data.name || '').toLowerCase().trim() === name.toLowerCase().trim();
      });
      
      let professorId: string;
      let isNewProfessor = false;
      
      if (existingProf) {
        professorId = existingProf.id;
      } else {
        // Create new professor with default max ratings
        const docRef = await addDoc(collection(db, 'professors'), {
          name: name.trim(),
          email: email?.trim(),
          universityId,
          courses: [],
        averageRating: {
          totalRating: 5,
          difficulty: 1,
          enjoyment: 5,
          retakePercentage: 100,
          understandability: 5,
        },
        createdAt: Timestamp.now(),
      });
        professorId = docRef.id;
        isNewProfessor = true;
      }
      
      // When a professor is created or found, update associated courses
      // Search for courses that have this professor's name as a string in their professors array
      // Note: Courses store professors as strings (names), so we keep that format but ensure
      // the professor document's courses array is updated with the course IDs
      const coursesQuery = query(
        collection(db, 'courses'),
        where('universityId', '==', universityId)
      );
      const coursesSnapshot = await getDocs(coursesQuery);
      
      const professorName = name.trim();
      const professorNameLower = professorName.toLowerCase();
      const updatedCourseIds: string[] = [];
      
      // Find courses that have this professor name
      coursesSnapshot.docs.forEach(courseDoc => {
        const courseData = courseDoc.data();
        const professorsData = courseData.professors || [];
        
        // Check if course has this professor name as a string
        const hasProfessorName = professorsData.some((prof: any) => {
          if (typeof prof === 'string') {
            return prof.toLowerCase().trim() === professorNameLower;
          }
          if (prof && typeof prof === 'object' && prof.name) {
            return prof.name.toLowerCase().trim() === professorNameLower;
          }
          return false;
        });
        
        if (hasProfessorName) {
          updatedCourseIds.push(courseDoc.id);
        }
      });
      
      // Update professor's courses array with the associated course IDs
      if (updatedCourseIds.length > 0) {
        const profRef = doc(db, 'professors', professorId);
        const profDoc = await getDoc(profRef);
        if (profDoc.exists()) {
          const profData = profDoc.data();
          const existingCourses = profData.courses || [];
          const newCourses = updatedCourseIds.filter(courseId => !existingCourses.includes(courseId));
          
          if (newCourses.length > 0) {
            // Update professor's courses array
            await updateDoc(profRef, {
              courses: arrayUnion(...newCourses),
            });
          }
        }
      }
      
      return professorId;
    } catch (error) {
      console.error('Error getting/creating professor:', error);
      throw error;
    }
  }

  static async createProfessorRating(
    professorId: string,
    rating: Omit<ProfessorRating, 'id' | 'createdAt'>
  ): Promise<string> {
    try {
      // Ensure professor document exists
      const profDoc = await getDoc(doc(db, 'professors', professorId));
      if (!profDoc.exists()) {
        throw new Error('Professor not found. Please ensure the professor exists.');
      }

      const profData = profDoc.data();
      const professorName = profData.name || '';
      
      // Update the course to include this professor name if not already there
      // Note: Courses store professors as strings (names) for simplicity and backward compatibility
      // This is done before creating the rating to ensure the course knows about the professor
      if (rating.courseId) {
        const courseDoc = await getDoc(doc(db, 'courses', rating.courseId));
        if (courseDoc.exists()) {
          const courseData = courseDoc.data();
          const professorsData = courseData.professors || [];
          const professorNameLower = professorName.toLowerCase();
          
          // Check if professor name is already in the course (as string)
          const hasProfessor = professorsData.some((prof: any) => {
            if (typeof prof === 'string') {
              return prof.toLowerCase().trim() === professorNameLower;
            }
            if (prof && typeof prof === 'object' && prof.name) {
              return prof.name.toLowerCase().trim() === professorNameLower;
            }
            return false;
          });
          
          if (!hasProfessor) {
            // Add professor name to course's professors array (as string for consistency)
            await updateDoc(courseDoc.ref, {
              professors: arrayUnion(professorName),
            });
          }
        }
      }

      // Create rating document in subcollection
      // Filter out undefined values - Firestore doesn't accept undefined
      const ratingData: any = {
        totalRating: rating.totalRating,
        difficulty: rating.difficulty,
        enjoyment: rating.enjoyment,
        understandability: rating.understandability,
        retake: rating.retake,
        anonymous: rating.anonymous,
        upvotes: [],
        downvotes: [],
        createdAt: Timestamp.now(),
      };

      // Only include userId if it's not undefined (for anonymous ratings)
      if (rating.userId !== undefined && rating.userId !== null) {
        ratingData.userId = rating.userId;
      }

      // Only include optional fields if they exist
      if (rating.courseId) {
        ratingData.courseId = rating.courseId;
      }
      if (rating.text) {
        ratingData.text = rating.text;
      }

      const ratingRef = collection(db, 'professors', professorId, 'ratings');
      const docRef = await addDoc(ratingRef, ratingData);

      // After rating is successfully created, update professor's courses array if courseId is provided
      // This ensures we only add the course if the rating was successfully created
      if (rating.courseId && rating.courseId.trim()) {
        // Re-fetch professor data to get latest courses array
        const updatedProfDoc = await getDoc(doc(db, 'professors', professorId));
        if (updatedProfDoc.exists()) {
          const updatedProfData = updatedProfDoc.data();
          const courses = updatedProfData.courses || [];
          const normalizedCourseId = rating.courseId.trim();
          
          // Normalize existing courses for comparison
          const normalizedCourses = (courses as any[]).map((c: any) => {
            if (typeof c === 'string') return c.trim();
            if (c && typeof c === 'object' && c.id) return c.id.trim();
            return String(c).trim();
          });
          
          // Check if course is already in the professor's courses array
          const courseExists = normalizedCourses.some((c: string) => c === normalizedCourseId);
          
          if (!courseExists) {
            // Add course to professor's courses array
            await updateDoc(doc(db, 'professors', professorId), {
              courses: arrayUnion(normalizedCourseId),
            });
            console.log(`Added course ${normalizedCourseId} to professor ${professorId}'s courses array after rating submission`);
          }
        }
      }

      // Update professor average rating
      const professor = await this.getProfessor(professorId);
      if (professor) {
        await updateDoc(doc(db, 'professors', professorId), {
          averageRating: professor.averageRating,
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating professor rating:', error);
      throw error;
    }
  }

  static async voteProfessorRating(
    professorId: string,
    ratingId: string,
    userId: string,
    voteType: 'upvote' | 'downvote' | 'remove'
  ): Promise<void> {
    try {
      const ratingRef = doc(db, 'professors', professorId, 'ratings', ratingId);
      const ratingDoc = await getDoc(ratingRef);
      
      if (!ratingDoc.exists()) throw new Error('Rating not found');

      const data = ratingDoc.data();
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

      await updateDoc(ratingRef, {
        upvotes,
        downvotes,
      });
    } catch (error) {
      console.error('Error voting on professor rating:', error);
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
  static async getOrganizations(universityId?: string): Promise<Organization[]> {
    try {
      let q;
      if (universityId) {
        // Query by universityId first (no orderBy to avoid index requirement)
        q = query(
          collection(db, 'organizations'),
          where('universityId', '==', universityId)
        );
      } else {
        q = query(collection(db, 'organizations'), orderBy('name', 'asc'));
      }
      const querySnapshot = await getDocs(q);
      
      let organizations = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Clean logo URL - remove any spaces that might have been introduced
        const logo = data.logo ? data.logo.trim().replace(/\s+/g, '') : '';
        return {
          id: doc.id,
          name: data.name || '',
          logo: logo,
          description: data.description || '',
          universityId: data.universityId || '',
          colors: data.colors || { primary: '#6366f1', secondary: '#8b92a7' },
          members: data.members || [],
        } as Organization;
      });
      
      // Sort by name client-side (to avoid Firestore index requirement)
      if (universityId) {
        organizations.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      }
      
      return organizations;
    } catch (error: any) {
      console.error('Error getting organizations:', error);
      // If index error, try without orderBy
      if (error.message?.includes('index')) {
        try {
          const q = universityId
            ? query(collection(db, 'organizations'), where('universityId', '==', universityId))
            : query(collection(db, 'organizations'));
          const querySnapshot = await getDocs(q);
          let organizations = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Clean logo URL - remove any spaces that might have been introduced
            const logo = data.logo ? data.logo.trim().replace(/\s+/g, '') : '';
            return {
              id: doc.id,
              name: data.name || '',
              logo: logo,
              description: data.description || '',
              universityId: data.universityId || '',
              colors: data.colors || { primary: '#6366f1', secondary: '#8b92a7' },
              members: data.members || [],
            } as Organization;
          });
          // Sort client-side
          organizations.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
          return organizations;
        } catch (fallbackError) {
          console.error('Error in fallback query:', fallbackError);
          return [];
        }
      }
      return [];
    }
  }

  /**
   * Get a single organization by ID
   */
  static async getOrganization(organizationId: string): Promise<Organization | null> {
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
      if (!orgDoc.exists()) return null;
      const data = orgDoc.data();
      // Clean logo URL - remove any spaces that might have been introduced
      const logo = data.logo ? data.logo.trim().replace(/\s+/g, '') : '';
      return {
        id: orgDoc.id,
        name: data.name || '',
        logo: logo,
        description: data.description || '',
        universityId: data.universityId || '',
        colors: data.colors || { primary: '#6366f1', secondary: '#8b92a7' },
        members: data.members || [],
      } as Organization;
    } catch (error) {
      console.error('Error getting organization:', error);
      return null;
    }
  }

  /**
   * Join an organization (follow)
   */
  static async joinOrganization(organizationId: string, userId: string): Promise<void> {
    try {
      // Add user to organization's members array
      const orgRef = doc(db, 'organizations', organizationId);
      await updateDoc(orgRef, {
        members: arrayUnion(userId),
      });

      // Add organization to user's clubs array
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        clubs: arrayUnion(organizationId),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error joining organization:', error);
      throw error;
    }
  }

  /**
   * Leave an organization (unfollow)
   */
  static async leaveOrganization(organizationId: string, userId: string): Promise<void> {
    try {
      // Remove user from organization's members array
      const orgRef = doc(db, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);
      if (orgDoc.exists()) {
        const currentMembers = orgDoc.data().members || [];
        const updatedMembers = currentMembers.filter((id: string) => id !== userId);
        await updateDoc(orgRef, {
          members: updatedMembers,
        });
      }

      // Remove organization from user's clubs array
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const currentClubs = userDoc.data().clubs || [];
        const updatedClubs = currentClubs.filter((id: string) => id !== organizationId);
        await updateDoc(userRef, {
          clubs: updatedClubs,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Error leaving organization:', error);
      throw error;
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
   * Submit a professor request for verification
   */
  static async requestProfessor(professor: { name: string; email?: string; image?: string; universityId: string; courseIds?: string[] }, userId: string): Promise<string> {
    try {
      // Validate universityId - ensure it's not empty
      if (!professor.universityId || !professor.universityId.trim()) {
        throw new Error('University ID is required');
      }

      const universityId = professor.universityId.trim();

      // Verify that the universityId matches the format used by existing professors
      // Get a sample of existing professors to verify universityId format consistency
      const existingSnapshot = await getDocs(query(collection(db, 'professors'), where('universityId', '==', universityId)));
      const requestsSnapshot = await getDocs(query(collection(db, 'professor_requests'), where('universityId', '==', universityId)));

      // Check for duplicates (case-insensitive) - same name, same university (courses can differ)
      // Ensure universityId matches exactly (already filtered by query, but validate for consistency)
      const allProfessors = [...existingSnapshot.docs, ...requestsSnapshot.docs];
      const duplicate = allProfessors.find(doc => {
        const data = doc.data();
        const docUniversityId = (data.universityId || '').trim();
        return (data.name || '').toLowerCase().trim() === professor.name.toLowerCase().trim() && 
               docUniversityId === universityId;
      });

      if (duplicate) {
        throw new Error('A professor with this name already exists or is pending review for this university');
      }

      // Verify that if courseIds are provided, they belong to the same university
      if (professor.courseIds && professor.courseIds.length > 0) {
        for (const courseId of professor.courseIds) {
          try {
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            if (courseDoc.exists()) {
              const courseData = courseDoc.data();
              const courseUniversityId = (courseData.universityId || '').trim();
              if (courseUniversityId !== universityId) {
                console.warn(`Course ${courseId} belongs to university ${courseUniversityId}, but professor universityId is ${universityId}. Course will be filtered during processing.`);
              }
            }
          } catch (error) {
            console.error(`Error checking course ${courseId}:`, error);
          }
        }
      }

      // Create request document with courseIds array
      // Ensure universityId is trimmed and consistent
      const requestData: any = {
        name: professor.name.trim(),
        email: professor.email?.trim() || null,
        image: professor.image?.trim() || null,
        universityId: universityId, // Use validated and trimmed universityId
        courseIds: professor.courseIds && professor.courseIds.length > 0 ? professor.courseIds : [],
        nameLowercase: professor.name.toLowerCase().trim(),
        userId: userId,
        status: 'pending',
        requestedAt: Timestamp.now(),
        verified: false,
      };

      const docRef = await addDoc(collection(db, 'professor_requests'), requestData);
      
      // Check if we've reached the threshold (100 requests) and process if so
      const allRequests = await getDocs(collection(db, 'professor_requests'));
      if (allRequests.size >= 100) {
        DatabaseService.processProfessorRequests().catch(error => {
          console.error('Error processing professor requests:', error);
        });
      }
      
      return docRef.id;
    } catch (error: any) {
      console.error('Error requesting professor:', error);
      throw error;
    }
  }

  /**
   * Submit an organization request for verification
   */
  static async requestOrganization(organization: { name: string; logo: string; description: string; universityId: string; colors: { primary: string; secondary: string } }, userId: string): Promise<string> {
    try {
      // Get all existing organizations for this university and check for duplicates (case-insensitive)
      const existingSnapshot = await getDocs(
        query(collection(db, 'organizations'), where('universityId', '==', organization.universityId))
      );
      const requestsSnapshot = await getDocs(
        query(collection(db, 'organization_requests'), where('universityId', '==', organization.universityId))
      );

      // Check for duplicates (case-insensitive) within the same university
      const allOrganizations = [...existingSnapshot.docs, ...requestsSnapshot.docs];
      const duplicate = allOrganizations.find(doc => {
        const data = doc.data();
        return (data.name || '').toLowerCase().trim() === organization.name.toLowerCase().trim() &&
               (data.universityId || '') === organization.universityId;
      });

      if (duplicate) {
        throw new Error('An organization with this name already exists or is pending review for this university');
      }

      // Clean logo URL - remove any spaces that might have been introduced
      const cleanedLogo = organization.logo ? organization.logo.trim().replace(/\s+/g, '') : '';
      
      // Create request document
      const docRef = await addDoc(collection(db, 'organization_requests'), {
        ...organization,
        logo: cleanedLogo,
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
  static async sendMessage(conversationId: string, message: Omit<Message, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Add message to conversation subcollection
      const messageRef = collection(db, 'conversations', conversationId, 'messages');
      const docRef = await addDoc(messageRef, {
        ...message,
        read: false,
        createdAt: Timestamp.now(),
      });

      // Update conversation's lastMessage and updatedAt
      const conversationRef = doc(db, 'conversations', conversationId);
      const lastMessageData = {
        id: docRef.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        images: message.images || [],
        read: false,
        createdAt: Timestamp.now(),
      };
      await updateDoc(conversationRef, {
        lastMessage: lastMessageData,
        updatedAt: Timestamp.now(),
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

  static async getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
    try {
      // Check if conversation already exists
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId1)
      );
      const querySnapshot = await getDocs(q);
      
      // Find conversation with both participants
      const existingConv = querySnapshot.docs.find(doc => {
        const data = doc.data();
        const participants = data.participants || [];
        return participants.includes(userId1) && participants.includes(userId2) && participants.length === 2;
      });

      if (existingConv) {
        return existingConv.id;
      }

      // Create new conversation
      const participants = [userId1, userId2].sort(); // Sort for consistency
      const docRef = await addDoc(collection(db, 'conversations'), {
        participants,
        lastMessage: null,
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      throw error;
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
          members: [], // Initialize empty members array
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
      const organizationsToAdd: Array<{ name: string; logo: string; description: string; universityId: string; colors: { primary: string; secondary: string } }> = [];
      const requestIdsToDelete: string[] = [];

      for (const group of groups) {
        if (group.length === 0) continue;

        // Extract all values from the group
        const names = group.map(doc => doc.data().name || '').filter(n => n.trim());
        const logos = group.map(doc => doc.data().logo || '').filter(l => l.trim());
        const descriptions = group.map(doc => doc.data().description || '').filter(d => d.trim());
        const universityIds = group.map(doc => doc.data().universityId || '').filter(uid => uid.trim());
        const primaryColors = group.map(doc => doc.data().colors?.primary || '').filter(c => c.trim());
        const secondaryColors = group.map(doc => doc.data().colors?.secondary || '').filter(c => c.trim());

        // Find most common values
        const mostCommonName = this.findMostCommonNonEmpty(names);
        const mostCommonUniversityId = this.findMostCommonNonEmpty(universityIds);
        if (!mostCommonName || !mostCommonUniversityId) continue;

        // Check for duplicate against existing organizations (same university)
        const nameLowercase = mostCommonName.toLowerCase().trim();
        const existingOrgForUni = existingSnapshot.docs.find(doc => {
          const data = doc.data();
          return (data.nameLowercase || data.name?.toLowerCase().trim()) === nameLowercase &&
                 (data.universityId || '') === mostCommonUniversityId;
        });
        if (existingOrgForUni) {
          console.log(`Skipping duplicate organization: ${mostCommonName} for university ${mostCommonUniversityId}`);
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }

        // Get most common values, with fallbacks
        let logo = this.findMostCommonNonEmpty(logos) || '';
        // Clean logo URL - remove any spaces that might have been introduced
        logo = logo.trim().replace(/\s+/g, '');
        const description = this.findMostCommonNonEmpty(descriptions) || '';
        const primaryColor = this.findMostCommonNonEmpty(primaryColors) || '#6366f1';
        const secondaryColor = this.findMostCommonNonEmpty(secondaryColors) || '#8b92a7';

        // Prepare organization data
        const organizationData = {
          name: mostCommonName.trim(),
          logo: logo,
          description: description.trim(),
          universityId: mostCommonUniversityId.trim(),
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

  /**
   * Process professor requests when threshold (100) is reached
   */
  static async processProfessorRequests(): Promise<void> {
    try {
      const requestsSnapshot = await getDocs(collection(db, 'professor_requests'));
      
      if (requestsSnapshot.size < 100) {
        console.log(`Only ${requestsSnapshot.size} professor requests, threshold not reached`);
        return;
      }

      console.log(`Processing ${requestsSnapshot.size} professor requests...`);

      // Get existing professors for duplicate checking (grouped by universityId)
      const existingSnapshot = await getDocs(collection(db, 'professors'));
      const existingProfessors = new Map<string, Set<string>>(); // universityId -> Set of nameLowercase
      
      existingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const uniId = data.universityId || '';
        if (!existingProfessors.has(uniId)) {
          existingProfessors.set(uniId, new Set());
        }
        const nameLowercase = (data.name || '').toLowerCase().trim();
        if (nameLowercase) {
          existingProfessors.get(uniId)!.add(nameLowercase);
        }
      });

      // Group requests by similar names (per university, courses can differ)
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
          const name1 = (req1.name || '').toLowerCase().trim();
          const name2 = (req2.name || '').toLowerCase().trim();

          // If name similarity is >= 0.75, group them together (courses can differ)
          if (name1 && name2 && this.stringSimilarity(name1, name2) >= 0.75) {
            group.push(requestDocs[j]);
            processed.add(requestDocs[j].id);
          }
        }

        groups.push(group);
      }

      console.log(`Grouped ${requestDocs.length} professor requests into ${groups.length} groups`);

      // Process each group and create professors
      const professorsToAdd: Array<{ id: string; name: string; email?: string; image?: string; universityId: string; courses: string[] }> = [];
      const requestIdsToDelete: string[] = [];

      for (const group of groups) {
        if (group.length === 0) continue;

        const firstData = group[0].data();
        
        // Extract university IDs from all requests in the group to ensure consistency
        const universityIds = group.map(doc => doc.data().universityId || '').filter(uid => uid.trim());
        const mostCommonUniversityId = this.findMostCommonNonEmpty(universityIds) || '';
        
        // Ensure all requests have the same universityId (should be true due to grouping, but validate)
        if (!mostCommonUniversityId) {
          console.log('Skipping group with no valid universityId');
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }
        
        // Verify that the universityId matches existing professors in that university
        // This ensures consistency - all professors in the same university must have the same universityId
        const uniId = mostCommonUniversityId;
        
        // Extract all values from the group
        const names = group.map(doc => doc.data().name || '').filter(n => n.trim());
        const emails = group.map(doc => doc.data().email || '').filter(e => e.trim());
        const images = group.map(doc => doc.data().image || '').filter(img => img.trim());
        
        // Extract course IDs from all requests (unique, can differ between requests)
        // Handle both courseId (single) and courseIds (array) for backward compatibility
        const allCourseIds: string[] = [];
        group.forEach(doc => {
          const data = doc.data();
          // Check for courseIds array first (new format)
          if (data.courseIds && Array.isArray(data.courseIds)) {
            data.courseIds.forEach((courseId: string) => {
              if (courseId && courseId.trim() && !allCourseIds.includes(courseId.trim())) {
                allCourseIds.push(courseId.trim());
              }
            });
          }
          // Fallback to courseId (old format) for backward compatibility
          else if (data.courseId && data.courseId.trim() && !allCourseIds.includes(data.courseId.trim())) {
            allCourseIds.push(data.courseId.trim());
          }
        });

        // Find most common values
        const mostCommonName = this.findMostCommonNonEmpty(names);
        const mostCommonEmail = this.findMostCommonNonEmpty(emails);
        const mostCommonImage = this.findMostCommonNonEmpty(images);
        if (!mostCommonName || !uniId) continue;

        // Verify universityId consistency: ensure it matches the universityId used by existing professors in that university
        // This is a safety check to ensure all professors in the same university share the same universityId
        if (existingProfessors.has(uniId)) {
          // Verify that all existing professors with similar names in this university have the same universityId
          // This should already be true, but we validate for consistency
        }

        // Check for duplicate against existing professors for this university (case-insensitive name)
        const nameLowercase = mostCommonName.toLowerCase().trim();
        if (existingProfessors.has(uniId) && existingProfessors.get(uniId)!.has(nameLowercase)) {
          console.log(`Skipping duplicate professor: ${mostCommonName} in university ${uniId}`);
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }

        // Generate document ID: name lowercase with underscores
        const professorId = mostCommonName.toLowerCase().trim().replace(/\s+/g, '_');

        // Check if professor with this ID already exists (shouldn't happen due to duplicate check, but safety check)
        const existingProfDoc = await getDoc(doc(db, 'professors', professorId));
        if (existingProfDoc.exists()) {
          console.log(`Skipping professor with existing ID: ${professorId}`);
          group.forEach(doc => requestIdsToDelete.push(doc.id));
          continue;
        }

        // Prepare professor data with default max ratings
        const professorData = {
          id: professorId,
          name: mostCommonName.trim(),
          email: mostCommonEmail?.trim() || undefined,
          image: mostCommonImage?.trim() || undefined,
          universityId: uniId,
          courses: allCourseIds, // Can include multiple courses
          averageRating: {
            totalRating: 5,
            difficulty: 1, // Default to 1 (easy)
            enjoyment: 5,
            retakePercentage: 100,
            understandability: 5,
          },
        };

        professorsToAdd.push(professorData);
        if (!existingProfessors.has(uniId)) {
          existingProfessors.set(uniId, new Set());
        }
        existingProfessors.get(uniId)!.add(nameLowercase); // Prevent duplicates within this batch

        // Mark all requests in this group for deletion
        group.forEach(doc => requestIdsToDelete.push(doc.id));
      }

      // Firestore batch limit is 500 operations
      const MAX_BATCH_SIZE = 500;
      let batchOps = 0;
      let currentBatch = writeBatch(db);
      const batches: typeof currentBatch[] = [currentBatch];

      // Get all course IDs that need to be updated and verify they exist and belong to the same university
      const allUniqueCourseIds = new Set<string>();
      professorsToAdd.forEach(prof => {
        prof.courses.forEach(courseId => allUniqueCourseIds.add(courseId));
      });

      const existingCourses = new Map<string, string>(); // courseId -> universityId
      for (const courseId of allUniqueCourseIds) {
        try {
          const courseDoc = await getDoc(doc(db, 'courses', courseId));
          if (courseDoc.exists()) {
            const courseData = courseDoc.data();
            const courseUniversityId = courseData.universityId || '';
            existingCourses.set(courseId, courseUniversityId);
          }
        } catch (error) {
          console.error(`Error checking course ${courseId}:`, error);
        }
      }

      // Add all professors with specific document IDs
      for (const professorData of professorsToAdd) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        // Use setDoc with specific ID (name lowercase with underscores)
        const professorRef = doc(db, 'professors', professorData.id);
        
        // Filter courses to only include existing ones that belong to the same university
        // This ensures the professor's universityId matches the universityId of their courses
        const validCourseIds = (professorData.courses || []).filter(id => {
          const courseUniversityId = existingCourses.get(id);
          // Only include courses that exist and belong to the same university as the professor
          return courseUniversityId && courseUniversityId === professorData.universityId;
        });
        
        // Prepare data without id field (Firestore ID is separate)
        // Ensure universityId is explicitly set to match other professors in the same university
        const { id, ...profData } = professorData;
        currentBatch.set(professorRef, {
          ...profData,
          universityId: professorData.universityId, // Explicitly set to ensure consistency
          courses: validCourseIds,
          createdAt: Timestamp.now(),
        });
        batchOps++;

        // Also update courses to include this professor (only for existing courses in the same university)
        for (const courseId of validCourseIds) {
          if (batchOps >= MAX_BATCH_SIZE) {
            currentBatch = writeBatch(db);
            batches.push(currentBatch);
            batchOps = 0;
          }

          // Verify course belongs to the same university before updating
          const courseUniversityId = existingCourses.get(courseId);
          if (courseUniversityId === professorData.universityId) {
            const courseRef = doc(db, 'courses', courseId);
            currentBatch.update(courseRef, {
              professors: arrayUnion(professorData.name.trim()),
            });
            batchOps++;
          }
        }
      }

      // Delete all processed requests
      for (const requestId of requestIdsToDelete) {
        if (batchOps >= MAX_BATCH_SIZE) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          batchOps = 0;
        }

        const requestRef = doc(db, 'professor_requests', requestId);
        currentBatch.delete(requestRef);
        batchOps++;
      }

      // Commit all batches sequentially
      for (const batchToCommit of batches) {
        await batchToCommit.commit();
      }

      console.log(`Successfully processed ${professorsToAdd.length} professors and deleted ${requestIdsToDelete.length} requests`);
    } catch (error) {
      console.error('Error processing professor requests:', error);
      throw error;
    }
  }
}
