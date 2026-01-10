import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Professor, ProfessorRating } from '../types';
import { Image as ExpoImage } from 'expo-image';

export default function ProfessorDetailScreen({ route, navigation }: any) {
  const { professorId } = route.params;
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [ratings, setRatings] = useState<ProfessorRating[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfessor = useCallback(async () => {
    try {
      const prof = await DatabaseService.getProfessor(professorId);
      if (prof) {
        setProfessor(prof);
        // Sort ratings by score (upvotes - downvotes) descending, then by date
        const sortedRatings = [...prof.ratings].sort((a, b) => {
          const aScore = (a.upvotes?.length || 0) - (a.downvotes?.length || 0);
          const bScore = (b.upvotes?.length || 0) - (b.downvotes?.length || 0);
          if (bScore !== aScore) return bScore - aScore;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        setRatings(sortedRatings);
      }
    } catch (error) {
      console.error('Error loading professor:', error);
    } finally {
      setLoading(false);
    }
  }, [professorId]);

  useEffect(() => {
    loadProfessor();
  }, [loadProfessor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfessor();
    setRefreshing(false);
  }, [loadProfessor]);

  const handleVoteRating = async (ratingId: string, voteType: 'upvote' | 'downvote' | 'remove') => {
    if (!userData?.id) return;
    
    try {
      await DatabaseService.voteProfessorRating(professorId, ratingId, userData.id, voteType);
      await loadProfessor(); // Reload to get updated votes
    } catch (error) {
      console.error('Error voting on rating:', error);
    }
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 4) return '#10b981'; // Green
    if (rating >= 3) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  // Create styles early so they're available for early returns
  const styles = createStyles(theme);

  const renderRatingCard = ({ item }: { item: ProfessorRating }) => {
    const score = (item.upvotes?.length || 0) - (item.downvotes?.length || 0);
    const hasUpvoted = userData?.id && item.upvotes?.includes(userData.id);
    const hasDownvoted = userData?.id && item.downvotes?.includes(userData.id);
    
    return (
      <View style={[styles.ratingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.ratingHeader}>
          <View style={styles.ratingInfo}>
            <Text style={[styles.ratingAuthor, { color: theme.colors.text }]}>
              {item.anonymous ? 'Anonymous' : item.userId ? 'User' : 'Anonymous'}
            </Text>
            <Text style={[styles.ratingDate, { color: theme.colors.textSecondary }]}>
              {item.createdAt.toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.ratingStats}>
            <Text style={[styles.ratingStatLabel, { color: theme.colors.textSecondary }]}>Overall</Text>
            <Text style={[styles.ratingStatValue, { color: getRatingColor(item.totalRating) }]}>
              {item.totalRating.toFixed(1)}/5
            </Text>
          </View>
        </View>
        
        {item.text && (
          <Text style={[styles.ratingText, { color: theme.colors.text }]}>{item.text}</Text>
        )}
        
        <View style={styles.ratingMetrics}>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Difficulty</Text>
            <Text style={[styles.metricValue, { color: getRatingColor(5 - item.difficulty + 1) }]}>
              {item.difficulty}/5
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Enjoyment</Text>
            <Text style={[styles.metricValue, { color: getRatingColor(item.enjoyment) }]}>
              {item.enjoyment}/5
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Understanding</Text>
            <Text style={[styles.metricValue, { color: getRatingColor(item.understandability) }]}>
              {item.understandability}/5
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Would Retake</Text>
            <Text style={[styles.metricValue, { color: item.retake ? '#10b981' : '#ef4444' }]}>
              {item.retake ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>
        
        <View style={styles.voteContainer}>
          <TouchableOpacity
            style={[
              styles.voteButton,
              hasUpvoted ? styles.voteButtonActive : undefined,
            ]}
            onPress={() => handleVoteRating(item.id, hasUpvoted ? 'remove' : 'upvote')}
          >
            <Ionicons 
              name="chevron-up" 
              size={20} 
              color={hasUpvoted ? '#FFFFFF' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.voteText,
              { color: hasUpvoted ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              {item.upvotes?.length || 0}
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.scoreText, { color: theme.colors.text }]}>{score}</Text>
          
          <TouchableOpacity
            style={[
              styles.voteButton,
              hasDownvoted ? styles.voteButtonDownvote : undefined,
            ]}
            onPress={() => handleVoteRating(item.id, hasDownvoted ? 'remove' : 'downvote')}
          >
            <Ionicons 
              name="chevron-down" 
              size={20} 
              color={hasDownvoted ? '#FFFFFF' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.voteText,
              { color: hasDownvoted ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              {item.downvotes?.length || 0}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading professor...</Text>
        </View>
      </View>
    );
  }

  if (!professor) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Professor not found</Text>
        </View>
      </View>
    );
  }

  const avgRating = professor.averageRating;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          {professor.image ? (
            <ExpoImage
              source={{ uri: professor.image }}
              style={styles.professorImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.professorImage, styles.professorImagePlaceholder]}>
              <Ionicons name="person" size={60} color={theme.colors.textSecondary} />
            </View>
          )}
          
          <Text style={[styles.professorName, { color: theme.colors.text }]}>{professor.name}</Text>
          {professor.email && (
            <Text style={[styles.professorEmail, { color: theme.colors.textSecondary }]}>
              {professor.email}
            </Text>
          )}
        </View>

        {/* Ratings Overview */}
        <View style={[styles.ratingsOverview, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.overallRatingHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, { color: theme.colors.text }]}>Overall Ratings</Text>
            <View style={[
              styles.overallRatingBox,
              { backgroundColor: getRatingColor(avgRating.totalRating) }
            ]}>
              <Text style={styles.overallRatingText}>
                {avgRating.totalRating.toFixed(1)}/5
              </Text>
            </View>
          </View>
          
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]}>Difficulty</Text>
            <Text style={[styles.ratingValue, { color: getRatingColor(5 - avgRating.difficulty + 1) }]}>
              {avgRating.difficulty.toFixed(1)}/5
            </Text>
          </View>
          
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]}>Enjoyment</Text>
            <Text style={[styles.ratingValue, { color: getRatingColor(avgRating.enjoyment) }]}>
              {avgRating.enjoyment.toFixed(1)}/5
            </Text>
          </View>
          
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]}>Understandability</Text>
            <Text style={[styles.ratingValue, { color: getRatingColor(avgRating.understandability) }]}>
              {avgRating.understandability.toFixed(1)}/5
            </Text>
          </View>
          
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]}>Retake Percentage</Text>
            <Text style={[styles.ratingValue, { color: avgRating.retakePercentage >= 50 ? '#10b981' : '#ef4444' }]}>
              {avgRating.retakePercentage.toFixed(1)}%
            </Text>
          </View>
          
          <Text style={[styles.totalRatings, { color: theme.colors.textSecondary }]}>
            Based on {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
          </Text>
        </View>

        {/* Ratings List */}
        <View style={styles.ratingsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Student Reviews</Text>
          
          {ratings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No ratings yet. Be the first to rate!
              </Text>
            </View>
          ) : (
            <FlatList
              data={ratings}
              renderItem={renderRatingCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No ratings yet
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('CreateProfessorRating', { professorId: professor.id })}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
    },
    headerSection: {
      alignItems: 'center',
      marginBottom: 24,
      paddingTop: 40,
      paddingHorizontal: 16,
    },
    professorImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      marginBottom: 16,
    },
    professorImagePlaceholder: {
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    professorName: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    professorEmail: {
      fontSize: 14,
    },
    ratingsOverview: {
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    sectionTitleInline: {
      marginBottom: 0,
    },
    overallRatingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    overallRatingBox: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      minWidth: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overallRatingText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    ratingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    ratingLabel: {
      fontSize: 16,
    },
    ratingValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    totalRatings: {
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    ratingsSection: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    ratingCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
    },
    ratingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    ratingInfo: {
      flex: 1,
    },
    ratingAuthor: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    ratingDate: {
      fontSize: 12,
    },
    ratingStats: {
      alignItems: 'flex-end',
    },
    ratingStatLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    ratingStatValue: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    ratingText: {
      fontSize: 14,
      marginBottom: 12,
      lineHeight: 20,
    },
    ratingMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
      gap: 12,
    },
    metric: {
      minWidth: 100,
    },
    metricLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    voteContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    voteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    voteButtonActive: {
      backgroundColor: theme.colors.upvote || '#10b981',
      borderColor: theme.colors.upvote || '#10b981',
    },
    voteButtonDownvote: {
      backgroundColor: theme.colors.downvote || '#ef4444',
      borderColor: theme.colors.downvote || '#ef4444',
    },
    voteText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 4,
    },
    scoreText: {
      fontSize: 16,
      fontWeight: '600',
      minWidth: 30,
      textAlign: 'center',
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
    },
    fab: {
      position: 'absolute',
      right: 40,
      bottom: 40,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
  });
