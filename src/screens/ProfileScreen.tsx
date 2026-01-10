import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User, University, Course, Organization } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { user: currentUser, userData } = useAuth();
  const { theme } = useTheme();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [university, setUniversity] = useState<University | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    if (userId === currentUser?.uid) {
      // Redirect to User tab if clicking on self
      navigation.getParent()?.navigate('User');
      return;
    }
    loadProfile();
  }, [userId, currentUser]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const userData = await DatabaseService.getUser(userId);
      if (!userData) {
        setProfileUser(null);
        setLoading(false);
        return;
      }

      setProfileUser(userData);
      
      // Update following status
      if (currentUser) {
        setIsFollowing(userData.followers?.includes(currentUser.uid) || false);
      } else {
        setIsFollowing(false);
      }

      // Load university
      if (userData.university) {
        const universityId = typeof userData.university === 'string' 
          ? userData.university 
          : (userData.university as University).id;
        const uni = await DatabaseService.getUniversity(universityId);
        if (uni) {
          setUniversity(uni);
        }
      }

      // Reload courses and organizations based on updated following status
      const canViewContent = !userData.isPrivate || isFollowing;
      if (canViewContent && userData) {
        await Promise.all([loadUserCourses(userData), loadUserOrganizations(userData)]);
      } else {
        setCourses([]);
        setOrganizations([]);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
      setProfileUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUserCourses = async (userData: User) => {
    if (!userData.courses || !Array.isArray(userData.courses) || userData.courses.length === 0) {
      setCourses([]);
      return;
    }

    if (!userData.university || typeof userData.university !== 'string') {
      setCourses([]);
      return;
    }

    setLoadingCourses(true);
    try {
      const allCourses = await DatabaseService.getCourses(userData.university);
      const courseIds = userData.courses.map((c: any) => typeof c === 'string' ? c : c.id);
      const userCourses = allCourses.filter(course => courseIds.includes(course.id));
      setCourses(userCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadUserOrganizations = async (userData: User) => {
    if (!userData.clubs || !Array.isArray(userData.clubs) || userData.clubs.length === 0) {
      setOrganizations([]);
      return;
    }

    setLoadingOrgs(true);
    try {
      const allOrganizations = await DatabaseService.getOrganizations();
      const clubIds = userData.clubs.map((c: any) => typeof c === 'string' ? c : c.id);
      const userOrgs = allOrganizations.filter(org => clubIds.includes(org.id));
      setOrganizations(userOrgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
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
      
      // Reload profile to get updated following status and load courses/orgs if now visible
      await loadProfile();
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !profileUser) return;

    try {
      // Check if user is private and not followed
      if (profileUser.isPrivate && !isFollowing) {
        Alert.alert('Private Profile', 'You must follow this user first to message them.');
        return;
      }

      // Create or get conversation
      const conversationId = await DatabaseService.getOrCreateConversation(currentUser.uid, profileUser.id);
      // Navigate to Message tab, then to Chat screen
      navigation.getParent()?.navigate('Message', {
        screen: 'Chat',
        params: { conversationId, otherUserId: profileUser.id },
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const styles = createStyles(theme, university);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={styles.loadingText}>Profile not found</Text>
      </View>
    );
  }

  const isOwnProfile = currentUser?.uid === userId;
  const isPrivate = profileUser.isPrivate && !isFollowing && !isOwnProfile;
  const canMessage = !profileUser.isPrivate || isFollowing || isOwnProfile;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* ID Card */}
        <View style={styles.idCardContainer}>
          <LinearGradient
            colors={university?.colors ? [university.colors.primary, university.colors.secondary] : [theme.colors.primary, theme.colors.secondary]}
            style={styles.idCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* University Logo Area */}
            <View style={styles.idCardHeader}>
              {university?.logo && university.logo.trim() ? (
                <Image
                  source={{ uri: university.logo }}
                  style={styles.universityLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.universityLogoPlaceholder}>
                  <Ionicons name="school-outline" size={30} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.universityName}>
                {university?.name || 'University'}
              </Text>
            </View>

            {/* User Info */}
            <View style={styles.idCardBody}>
              {profileUser.profileImage ? (
                <Image source={{ uri: profileUser.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </View>
              )}
              
              <Text style={styles.userName}>{profileUser.name}</Text>
              {profileUser.username && (
                <Text style={styles.userId}>@{profileUser.username}</Text>
              )}
              {!profileUser.username && (
                <Text style={styles.userId}>ID: {profileUser.id.slice(0, 8).toUpperCase()}</Text>
              )}
            </View>

            {/* Stats */}
            <View style={styles.idCardFooter}>
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
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
            >
              <Text style={[styles.actionButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            {canMessage && (
              <TouchableOpacity
                style={[styles.actionButton, styles.messageButton]}
                onPress={handleMessage}
              >
                <Ionicons name="chatbubble-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.actionButtonText, styles.messageButtonText]}>Message</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Courses Section */}
        {(!isPrivate || isOwnProfile) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Courses</Text>
              <Text style={styles.sectionCount}>{courses.length || 0}</Text>
            </View>
            {loadingCourses ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading courses...</Text>
              </View>
            ) : courses.length > 0 ? (
              <View style={styles.listContainer}>
                {courses.map(course => (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.listItem}
                    onPress={() => navigation.navigate('Course', {
                      screen: 'CourseDetail',
                      params: { courseId: course.id },
                    })}
                  >
                    <View style={styles.listItemContent}>
                      <View style={styles.courseIconContainer}>
                        <Ionicons name="book" size={20} color={theme.colors.primary} />
                      </View>
                      <View style={styles.listItemText}>
                        <Text style={styles.listItemTitle}>{course.code}</Text>
                        <Text style={styles.listItemSubtitle} numberOfLines={1}>
                          {course.name}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No courses yet</Text>
            )}
          </View>
        )}

        {/* Organizations Section */}
        {(!isPrivate || isOwnProfile) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Clubs & Organizations</Text>
              <Text style={styles.sectionCount}>{organizations.length || 0}</Text>
            </View>
            {loadingOrgs ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading organizations...</Text>
              </View>
            ) : organizations.length > 0 ? (
              <View style={styles.listContainer}>
                {organizations.map(org => (
                  <TouchableOpacity
                    key={org.id}
                    style={styles.listItem}
                    onPress={() => navigation.navigate('Clubs', {
                      screen: 'ClubDetail',
                      params: { clubId: org.id, organizationId: org.id },
                    })}
                  >
                    <View style={styles.listItemContent}>
                      {org.logo && org.logo.trim() ? (
                        <ExpoImage
                          source={{ uri: org.logo }}
                          style={styles.orgLogo}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.orgLogoPlaceholder}>
                          <Ionicons name="people" size={20} color={theme.colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.listItemText}>
                        <Text style={styles.listItemTitle}>{org.name}</Text>
                        <Text style={styles.listItemSubtitle} numberOfLines={1}>
                          {org.members?.length || 0} {org.members?.length === 1 ? 'member' : 'members'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No clubs yet</Text>
            )}
          </View>
        )}

        {isPrivate && !isOwnProfile && (
          <View style={styles.privateContainer}>
            <Ionicons name="lock-closed" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.privateText}>This profile is private</Text>
            <Text style={styles.privateSubtext}>Follow to see more</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, university?: University | null) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingTop: 16,
      paddingBottom: 100,
    },
    centerContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    idCardContainer: {
      marginBottom: 24,
      borderRadius: 20,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    idCard: {
      padding: 24,
      minHeight: 280,
    },
    idCardHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    universityLogo: {
      width: 60,
      height: 60,
      marginBottom: 8,
      borderRadius: 30,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      padding: 8,
    },
    universityLogoPlaceholder: {
      width: 60,
      height: 60,
      marginBottom: 8,
      borderRadius: 30,
      backgroundColor: '#FFFFFF40',
      alignItems: 'center',
      justifyContent: 'center',
    },
    universityName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    idCardBody: {
      alignItems: 'center',
      marginBottom: 24,
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      marginBottom: 12,
    },
    profileImagePlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#FFFFFF40',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 4,
      borderColor: '#FFFFFF',
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    userId: {
      fontSize: 12,
      color: '#FFFFFF80',
      letterSpacing: 1,
    },
    idCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#FFFFFF30',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: '#FFFFFF80',
    },
    statDivider: {
      width: 1,
      backgroundColor: '#FFFFFF30',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    actionButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    followButton: {
      backgroundColor: theme.colors.primary,
    },
    followingButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    messageButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    followingButtonText: {
      color: theme.colors.text,
    },
    messageButtonText: {
      color: theme.colors.primary,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
    sectionCount: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    listContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    listItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    courseIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    orgLogo: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: theme.colors.border,
    },
    orgLogoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.border + '40',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    listItemText: {
      flex: 1,
    },
    listItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    listItemSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    privateContainer: {
      alignItems: 'center',
      padding: 32,
      marginTop: 32,
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
      textAlign: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
