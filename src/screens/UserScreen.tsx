import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User, University, Course, Organization } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function UserScreen({ navigation }: any) {
  const { user, userData, refreshUserData } = useAuth();
  const { theme } = useTheme();
  const [university, setUniversity] = useState<University | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    if (userData) {
      loadUniversity();
      loadUserCourses();
      loadUserOrganizations();
    }
  }, [userData]);

  const loadUniversity = async () => {
    if (userData?.university && typeof userData.university === 'string') {
      try {
        const uni = await DatabaseService.getUniversity(userData.university);
        if (uni) {
          setUniversity(uni);
        }
      } catch (error) {
        console.error('Error loading university:', error);
      }
    }
  };

  const loadUserCourses = async () => {
    if (!userData?.courses || !Array.isArray(userData.courses) || userData.courses.length === 0) {
      setCourses([]);
      return;
    }

    if (!userData?.university || typeof userData.university !== 'string') {
      setCourses([]);
      return;
    }

    setLoadingCourses(true);
    try {
      // Get all courses for the user's university
      const allCourses = await DatabaseService.getCourses(userData.university);
      // In Firestore, courses is stored as string[] (IDs), not Course[]
      const courseIds = userData.courses.map((c: any) => typeof c === 'string' ? c : c.id);
      // Filter to only courses the user is enrolled in
      const userCourses = allCourses.filter(course => 
        courseIds.includes(course.id)
      );
      setCourses(userCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadUserOrganizations = async () => {
    if (!userData?.clubs || !Array.isArray(userData.clubs) || userData.clubs.length === 0) {
      setOrganizations([]);
      return;
    }

    setLoadingOrgs(true);
    try {
      // Get all organizations
      const allOrganizations = await DatabaseService.getOrganizations();
      // In Firestore, clubs is stored as string[] (IDs), not Club[]
      const clubIds = userData.clubs.map((c: any) => typeof c === 'string' ? c : c.id);
      // Filter to only organizations the user is a member of
      const userOrgs = allOrganizations.filter(org => 
        clubIds.includes(org.id)
      );
      setOrganizations(userOrgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleShare = async () => {
    if (!user) return;
    
    try {
      await Share.share({
        message: `Check out my HallPass profile! User ID: ${user.uid}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const styles = createStyles(theme, university);

  if (!userData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header with Settings Button */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

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
            {userData.profileImage ? (
              <Image source={{ uri: userData.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={40} color="#FFFFFF" />
              </View>
            )}
            
            <Text style={styles.userName}>{userData.name}</Text>
            <Text style={styles.userId}>ID: {user?.uid.slice(0, 8).toUpperCase()}</Text>
          </View>

          {/* Stats */}
          <View style={styles.idCardFooter}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userData.followers?.length || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userData.following?.length || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userData.discussionRanking || 0}</Text>
              <Text style={styles.statLabel}>Ranking</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Courses Section */}
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
            {courses.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={styles.listItem}
                onPress={() => {
                  if (navigation) {
                    navigation.navigate('Course', {
                      screen: 'CourseDetail',
                      params: { courseId: course.id },
                    });
                  }
                }}
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

      {/* Clubs Section */}
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
            {organizations.map((org) => (
              <TouchableOpacity
                key={org.id}
                style={styles.listItem}
                onPress={() => {
                  if (navigation) {
                    navigation.navigate('Clubs', {
                      screen: 'ClubDetail',
                      params: { clubId: org.id },
                    });
                  }
                }}
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

      {/* Share Button */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.shareButtonText}>Share Profile</Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, university: University | null) =>
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
      paddingBottom: 100, // Extra padding at bottom to prevent content from being hidden behind tabs
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    settingsButton: {
      padding: 8,
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
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    shareButtonText: {
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
