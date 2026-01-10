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
  createdAt: Date;
}

export interface Professor {
  id: string;
  name: string;
  email?: string;
  courses: string[]; // Course IDs
  ratings: ProfessorRating[];
  averageRating: {
    hardness: number;
    coursework: number;
    communication: number;
    enjoyment: number;
  };
}

export interface ProfessorRating {
  userId: string;
  courseId: string;
  hardness: number;
  coursework: number;
  communication: number;
  enjoyment: number;
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
