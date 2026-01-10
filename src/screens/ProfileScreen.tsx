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
import { User } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const userData = await DatabaseService.getUser(userId);
      setProfileUser(userData);
      
      if (currentUser && userData?.followers?.includes(currentUser.uid)) {
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profileUser) return;
    
    try {
      if (isFollowing) {
        await DatabaseService.unfollowUser(currentUser.uid, profileUser.id);
        setIsFollowing(false);
      } else {
        await DatabaseService.followUser(currentUser.uid, profileUser.id);
        setIsFollowing(true);
      }
      await loadProfile();
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    }
  };

  const styles = createStyles(theme);

  if (!profileUser) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isOwnProfile = currentUser?.uid === userId;
  const isPrivate = profileUser.isPrivate && !isFollowing && !isOwnProfile;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        {profileUser.profileImage ? (
          <Image source={{ uri: profileUser.profileImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Ionicons name="person" size={40} color={theme.colors.textSecondary} />
          </View>
        )}
        
        <Text style={styles.userName}>{profileUser.name}</Text>
        <Text style={styles.userEmail}>{profileUser.email}</Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileUser.followers?.length || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileUser.following?.length || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileUser.discussionRanking || 0}</Text>
            <Text style={styles.statLabel}>Ranking</Text>
          </View>
        </View>

        {/* Follow Button */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollow}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Courses Section */}
      {(!isPrivate || isOwnProfile) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Courses</Text>
          {profileUser.courses && profileUser.courses.length > 0 ? (
            <View style={styles.coursesList}>
              {profileUser.courses.map((courseId, index) => (
                <View key={index} style={styles.courseTag}>
                  <Text style={styles.courseTagText}>Course {index + 1}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No courses</Text>
          )}
        </View>
      )}

      {/* Clubs Section */}
      {(!isPrivate || isOwnProfile) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clubs</Text>
          {profileUser.clubs && profileUser.clubs.length > 0 ? (
            <View style={styles.clubsList}>
              {profileUser.clubs.map((clubId, index) => (
                <View key={index} style={styles.clubTag}>
                  <Text style={styles.clubTagText}>Club {index + 1}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No clubs</Text>
          )}
        </View>
      )}

      {isPrivate && !isOwnProfile && (
        <View style={styles.privateContainer}>
          <Ionicons name="lock-closed" size={48} color={theme.colors.textSecondary} />
          <Text style={styles.privateText}>This profile is private</Text>
          <Text style={styles.privateSubtext}>Follow to see more</Text>
        </View>
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
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: theme.colors.primary,
    },
    profileImagePlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 3,
      borderColor: theme.colors.primary,
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    statDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
    },
    followButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingHorizontal: 32,
      paddingVertical: 12,
      marginTop: 8,
    },
    followingButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    followingButtonText: {
      color: theme.colors.text,
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
    coursesList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    courseTag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      marginBottom: 8,
    },
    courseTagText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    clubsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    clubTag: {
      backgroundColor: theme.colors.secondary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      marginBottom: 8,
    },
    clubTagText: {
      fontSize: 14,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    privateContainer: {
      alignItems: 'center',
      padding: 32,
    },
    privateText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 16,
    },
    privateSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
