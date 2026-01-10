import { MLRankingInput, MLRankingOutput } from '../types';

/**
 * ML Service for ranking discussions and calculating controversy scores
 * 
 * This service provides integration points for ML models.
 * For production, you can:
 * 1. Use TensorFlow.js for client-side inference
 * 2. Use a backend ML service (Python/Flask, Node.js, etc.)
 * 3. Use Firebase Cloud Functions with ML models
 */

export class MLService {
  /**
   * Calculate discussion ranking score
   * This is a simplified version - replace with actual ML model
   */
  static calculateRanking(input: MLRankingInput): MLRankingOutput {
    // Simple heuristic-based ranking (replace with ML model)
    const timeDecay = Math.exp(-input.timeSinceCreation / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    const voteRatio = input.upvotes / (input.upvotes + input.downvotes + 1);
    const engagementScore = Math.log(input.comments + 1) * 0.5;
    const userBoost = Math.log(input.userRanking + 1) * 0.3;
    
    const score = (input.upvotes - input.downvotes) * timeDecay + engagementScore + userBoost;
    
    // Calculate controversy (high upvotes AND high downvotes = controversial)
    const totalVotes = input.upvotes + input.downvotes;
    const controversy = totalVotes > 0 
      ? Math.min(input.upvotes, input.downvotes) / totalVotes 
      : 0;
    
    // Recommendation score (for personalized feed)
    const recommendationScore = score * (1 + userBoost) * (1 - controversy * 0.5);
    
    return {
      score: Math.max(0, score),
      controversy: controversy,
      recommendationScore: Math.max(0, recommendationScore),
    };
  }

  /**
   * Batch calculate rankings for multiple discussions
   */
  static batchCalculateRankings(inputs: MLRankingInput[]): MLRankingOutput[] {
    return inputs.map(input => this.calculateRanking(input));
  }

  /**
   * Calculate user discussion ranking based on their activity
   */
  static calculateUserRanking(
    postsCreated: number,
    totalUpvotes: number,
    totalDownvotes: number,
    commentsMade: number,
    followers: number
  ): number {
    // Simple heuristic (replace with ML model)
    const postScore = Math.log(postsCreated + 1) * 10;
    const voteScore = (totalUpvotes - totalDownvotes) * 0.5;
    const commentScore = Math.log(commentsMade + 1) * 5;
    const followerScore = Math.log(followers + 1) * 3;
    
    return postScore + voteScore + commentScore + followerScore;
  }

  /**
   * Detect duplicate submissions (for courses, professors, clubs)
   * Uses simple text similarity - replace with ML-based similarity
   */
  static detectDuplicates(
    newItem: { name: string; description?: string },
    existingItems: Array<{ name: string; description?: string }>,
    threshold: number = 0.8
  ): Array<{ item: { name: string; description?: string }; similarity: number }> {
    const similarities = existingItems.map(item => ({
      item,
      similarity: this.calculateSimilarity(newItem.name, item.name),
    }));
    
    return similarities.filter(s => s.similarity >= threshold);
  }

  /**
   * Simple string similarity (Jaccard similarity)
   * Replace with more sophisticated ML-based similarity (e.g., embeddings)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Initialize ML model (for TensorFlow.js or other ML frameworks)
   * Call this when app starts
   */
  static async initializeModel(): Promise<void> {
    // TODO: Load your ML model here
    // Example for TensorFlow.js:
    // const model = await tf.loadLayersModel('path/to/model.json');
    // this.model = model;
    console.log('ML Service initialized (using heuristic-based ranking)');
  }

  /**
   * Get personalized feed recommendations
   */
  static getPersonalizedRecommendations(
    userInterests: string[],
    userCourses: string[],
    userClubs: string[],
    discussions: Array<{ tags: string[]; courseId?: string; clubId?: string; score: number }>
  ): Array<{ discussion: typeof discussions[0]; recommendationScore: number }> {
    return discussions.map(discussion => {
      let relevanceScore = 0;
      
      // Tag matching
      const tagMatches = discussion.tags.filter(tag => 
        userInterests.some(interest => 
          tag.toLowerCase().includes(interest.toLowerCase())
        )
      ).length;
      relevanceScore += tagMatches * 0.3;
      
      // Course matching
      if (discussion.courseId && userCourses.includes(discussion.courseId)) {
        relevanceScore += 0.5;
      }
      
      // Club matching
      if (discussion.clubId && userClubs.includes(discussion.clubId)) {
        relevanceScore += 0.4;
      }
      
      const recommendationScore = discussion.score * (1 + relevanceScore);
      
      return {
        discussion,
        recommendationScore,
      };
    }).sort((a, b) => b.recommendationScore - a.recommendationScore);
  }
}
