import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Club } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function ClubDetailScreen({ route, navigation }: any) {
  const { clubId } = route.params;
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [club, setClub] = useState<Club | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    loadClub();
  }, [clubId]);

  const loadClub = async () => {
    try {
      const clubData = await DatabaseService.getClub(clubId);
      setClub(clubData);
      
      if (clubData && userData?.clubs?.includes(clubId)) {
        setIsMember(true);
      }
    } catch (error) {
      console.error('Error loading club:', error);
    }
  };

  const styles = createStyles(theme);

  if (!club) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {club.image && (
        <Image source={{ uri: club.image }} style={styles.clubImage} />
      )}
      
      <View style={styles.header}>
        <Text style={styles.clubName}>{club.name}</Text>
        {isMember && (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>Member</Text>
          </View>
        )}
      </View>

      {club.description && (
        <Text style={styles.description}>{club.description}</Text>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={24} color={theme.colors.primary} />
          <Text style={styles.statValue}>{club.members?.length || 0}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        {club.averageRating && (
          <View style={styles.statItem}>
            <Ionicons name="star" size={24} color={theme.colors.upvote} />
            <Text style={styles.statValue}>
              {club.averageRating.overall.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        )}
      </View>

      {/* Discussions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discussions</Text>
        <TouchableOpacity
          style={styles.discussionButton}
          onPress={() => navigation.navigate('ClubDiscussions', { clubId })}
        >
          <Text style={styles.discussionButtonText}>View All Discussions</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Rate Club Button */}
      {isMember && (
        <TouchableOpacity
          style={styles.rateButton}
          onPress={() => navigation.navigate('RateClub', { clubId })}
        >
          <Ionicons name="star-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.rateButtonText}>Rate This Club</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centerContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      padding: 16,
    },
    clubImage: {
      width: '100%',
      height: 200,
      borderRadius: 16,
      marginBottom: 16,
      backgroundColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    clubName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    memberBadge: {
      backgroundColor: theme.colors.success + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    memberBadgeText: {
      fontSize: 12,
      color: theme.colors.success,
      fontWeight: '600',
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 24,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    discussionButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.primary + '20',
      borderRadius: 12,
      padding: 16,
    },
    discussionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    rateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginLeft: 8,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
