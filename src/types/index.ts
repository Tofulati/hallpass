// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  profileImage?: string;
  university: University;
  courses: Course[];
  clubs: Club[];
  followers: string[];
  following: string[];
  discussionRanking: number;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface University {
  id: string;
  name: string;
  logo: string;
  image: string;
  colors: {
    primary: string;
    secondary: string;
  };
}

// Course Types
export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
  universityId: string;
  professors: Professor[];
  members: string[]; // User IDs
  createdAt: Date;
}

export interface Professor {
  id: string;
  name: string;
  email?: string;
  image?: string;
  courses: string[]; // Course IDs
  universityId?: string;
  ratings: ProfessorRating[];
  averageRating: {
    totalRating: number; // 1-5
    difficulty: number; // 1-5
    enjoyment: number; // 1-5
    retakePercentage: number; // 0-100
    understandability: number; // 1-5
  };
}

export interface ProfessorRating {
  id: string;
  userId?: string; // Optional if anonymous
  courseId: string;
  totalRating: number; // 1-5
  difficulty: number; // 1-5
  enjoyment: number; // 1-5
  retake: boolean; // Would retake this professor
  understandability: number; // 1-5
  text?: string; // Review text
  anonymous: boolean;
  upvotes: string[]; // User IDs who upvoted (A)
  downvotes: string[]; // User IDs who downvoted (F)
  createdAt: Date;
}

// Club Types
export interface Club {
  id: string;
  name: string;
  description?: string;
  image?: string;
  universityId: string;
  members: string[]; // User IDs
  ratings: ClubRating[];
  averageRating: {
    engagement: number;
    community: number;
    events: number;
    overall: number;
  };
  createdAt: Date;
}

// Organization Types (for onboarding/clubs page)
export interface Organization {
  id: string;
  name: string;
  logo: string;
  description: string;
  universityId: string; // University ID the organization belongs to
  colors: {
    primary: string;
    secondary: string;
  };
  members: string[]; // User IDs
}

export interface ClubRating {
  userId: string;
  engagement: number;
  community: number;
  events: number;
  overall: number;
  createdAt: Date;
}

// Discussion/Post Types
export interface Discussion {
  id: string;
  userId: string;
  title: string;
  content: string;
  images?: string[];
  tags: string[];
  courseId?: string;
  professorId?: string;
  clubId?: string;
  organizationId?: string;
  upvotes: string[]; // User IDs who upvoted (A)
  downvotes: string[]; // User IDs who downvoted (F)
  comments: Comment[];
  score: number; // Calculated from upvotes/downvotes and ML ranking
  controversy: number; // ML calculated controversy score
  createdAt: Date;
  updatedAt: Date;
  isPrivate?: boolean; // For course private sessions
  enrolledUsers?: string[]; // For course private sessions
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  upvotes: string[];
  downvotes: string[];
  replies?: Comment[];
  createdAt: Date;
}

// Message Types
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  images?: string[];
  read: boolean;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: Message;
  updatedAt: Date;
}

// Filter and Sort Types
export type SortOption = 'popularity' | 'controversy' | 'recent';
export type FilterType = 'all' | 'course' | 'professor' | 'club' | 'tag';

// Onboarding Types
export interface OnboardingData {
  name: string;
  universityId: string;
  courses: string[];
  clubs: string[];
}

// ID Verification Types
export interface IDVerification {
  id: string;
  userId: string;
  universityId: string;
  idCardImage: string; // URL to uploaded ID card image
  nameOnCard: string; // Extracted name from ID card (for OCR later)
  universityNameOnCard?: string; // Extracted university name from ID card (for OCR later)
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'manual_review';
  verified: boolean;
  verifiedAt?: Date;
  reviewedBy?: string; // Admin ID who reviewed (if manual)
  createdAt: Date;
  updatedAt: Date;
}

export interface IDVerificationData {
  idCardImage: string;
  nameOnCard?: string;
  universityNameOnCard?: string;
}

// ML Model Types
export interface MLRankingInput {
  upvotes: number;
  downvotes: number;
  comments: number;
  timeSinceCreation: number;
  userRanking: number;
  controversyScore?: number;
}

export interface MLRankingOutput {
  score: number;
  controversy: number;
  recommendationScore: number;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Theme {
  mode: ThemeMode;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    upvote: string;
    downvote: string;
  };
}
