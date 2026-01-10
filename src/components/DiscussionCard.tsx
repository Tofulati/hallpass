import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Discussion } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

interface DiscussionCardProps {
  discussion: Discussion;
  navigation: any;
}

export default function DiscussionCard({ discussion, navigation }: DiscussionCardProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [associationName, setAssociationName] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUpvoted(discussion.upvotes.includes(user.uid));
      setDownvoted(discussion.downvotes.includes(user.uid));
    }
  }, [discussion, user]);

  useEffect(() => {
    // Reset association name when discussion changes
    setAssociationName(null);
    
    const loadAssociationName = async () => {
      if (discussion.courseId && discussion.courseId.trim()) {
        try {
          const course = await DatabaseService.getCourse(discussion.courseId.trim());
          if (course) {
            setAssociationName(`${course.code} - ${course.name}`);
          }
        } catch (error) {
          console.error('Error loading course name:', error);
        }
      } else if (discussion.organizationId && discussion.organizationId.trim()) {
        try {
          const org = await DatabaseService.getOrganization(discussion.organizationId.trim());
          if (org) {
            setAssociationName(org.name);
          }
        } catch (error) {
          console.error('Error loading organization name:', error);
        }
      }
    };

    loadAssociationName();
  }, [discussion.courseId, discussion.organizationId]);

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!user) return;

    const currentUpvoted = discussion.upvotes.includes(user.uid);
    const currentDownvoted = discussion.downvotes.includes(user.uid);

    // Determine the vote type to send (remove if already voted, otherwise toggle)
    let voteType: 'upvote' | 'downvote' | 'remove' = type;
    
    if (type === 'upvote') {
      if (currentUpvoted) {
        voteType = 'remove';
      } else {
        voteType = 'upvote'; // This will automatically remove downvote if exists
      }
    } else {
      if (currentDownvoted) {
        voteType = 'remove';
      } else {
        voteType = 'downvote'; // This will automatically remove upvote if exists
      }
    }

    try {
      await DatabaseService.voteDiscussion(discussion.id, user.uid, voteType);
      // Update local state optimistically
      setUpvoted(voteType === 'upvote');
      setDownvoted(voteType === 'downvote');
    } catch (error) {
      console.error('Error voting on discussion:', error);
      // Revert optimistic update on error
      setUpvoted(currentUpvoted);
      setDownvoted(currentDownvoted);
    }
  };

  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DiscussionDetail', { discussionId: discussion.id })}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{discussion.title}</Text>
        {associationName && (
          <View style={styles.associationBadge}>
            <Ionicons 
              name={discussion.courseId ? "school-outline" : "people-outline"} 
              size={12} 
              color={theme.colors.primary} 
              style={styles.associationIcon}
            />
            <Text style={[styles.associationText, { color: theme.colors.primary }]}>
              {associationName}
            </Text>
          </View>
        )}
        {discussion.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {discussion.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.content} numberOfLines={3}>
        {discussion.content}
      </Text>

      {discussion.images && discussion.images.length > 0 && (
        <Image source={{ uri: discussion.images[0] }} style={styles.image} />
      )}

      <View style={styles.footer}>
        <View style={styles.voteContainer}>
          <TouchableOpacity
            style={[styles.voteButton, upvoted && styles.voteButtonActive, upvoted && { backgroundColor: theme.colors.upvote + '20' }]}
            onPress={() => handleVote('upvote')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.voteLetter,
                upvoted && { color: theme.colors.upvote, fontWeight: 'bold' },
                !upvoted && { color: theme.colors.textSecondary },
              ]}
            >
              A
            </Text>
            <Text
              style={[
                styles.voteCount,
                upvoted && { color: theme.colors.upvote },
                !upvoted && { color: theme.colors.textSecondary },
              ]}
            >
              {discussion.upvotes.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, downvoted && styles.voteButtonActive, downvoted && { backgroundColor: theme.colors.downvote + '20' }]}
            onPress={() => handleVote('downvote')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.voteLetter,
                downvoted && { color: theme.colors.downvote, fontWeight: 'bold' },
                !downvoted && { color: theme.colors.textSecondary },
              ]}
            >
              F
            </Text>
            <Text
              style={[
                styles.voteCount,
                downvoted && { color: theme.colors.downvote },
                !downvoted && { color: theme.colors.textSecondary },
              ]}
            >
              {discussion.downvotes.length}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metaContainer}>
          <Ionicons name="chatbubble-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.metaText}>{discussion.comments.length}</Text>
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>
            {formatDistanceToNow(discussion.createdAt, { addSuffix: true })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    associationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginBottom: 8,
    },
    associationIcon: {
      marginRight: 4,
    },
    associationText: {
      fontSize: 12,
      fontWeight: '500',
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    tag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 6,
      marginBottom: 4,
    },
    tagText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    content: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    image: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: theme.colors.border,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    voteContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    voteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    voteButtonActive: {
      borderWidth: 2,
    },
    voteLetter: {
      fontSize: 18,
      fontWeight: '600',
      marginRight: 6,
    },
    voteCount: {
      fontSize: 14,
      fontWeight: '600',
    },
    metaContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
  });
