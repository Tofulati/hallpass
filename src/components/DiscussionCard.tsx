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

  useEffect(() => {
    if (user) {
      setUpvoted(discussion.upvotes.includes(user.uid));
      setDownvoted(discussion.downvotes.includes(user.uid));
    }
  }, [discussion, user]);

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!user) return;

    const currentUpvoted = discussion.upvotes.includes(user.uid);
    const currentDownvoted = discussion.downvotes.includes(user.uid);

    if (type === 'upvote') {
      if (currentUpvoted) {
        await DatabaseService.voteDiscussion(discussion.id, user.uid, 'remove');
      } else {
        await DatabaseService.voteDiscussion(discussion.id, user.uid, 'upvote');
        if (currentDownvoted) {
          await DatabaseService.voteDiscussion(discussion.id, user.uid, 'remove');
        }
      }
    } else {
      if (currentDownvoted) {
        await DatabaseService.voteDiscussion(discussion.id, user.uid, 'remove');
      } else {
        await DatabaseService.voteDiscussion(discussion.id, user.uid, 'downvote');
        if (currentUpvoted) {
          await DatabaseService.voteDiscussion(discussion.id, user.uid, 'remove');
        }
      }
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
            style={[styles.voteButton, upvoted && styles.voteButtonActive]}
            onPress={() => handleVote('upvote')}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={upvoted ? theme.colors.upvote : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.voteCount,
                upvoted && { color: theme.colors.upvote },
              ]}
            >
              {discussion.upvotes.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, downvoted && styles.voteButtonActive]}
            onPress={() => handleVote('downvote')}
          >
            <Ionicons
              name="arrow-down"
              size={20}
              color={downvoted ? theme.colors.downvote : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.voteCount,
                downvoted && { color: theme.colors.downvote },
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
      paddingVertical: 6,
      borderRadius: 8,
      marginRight: 8,
    },
    voteButtonActive: {
      backgroundColor: theme.colors.surface,
    },
    voteCount: {
      marginLeft: 4,
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
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
