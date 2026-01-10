import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User, University } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function UserScreen({ navigation }: any) {
  const { user, userData, refreshUserData } = useAuth();
  const { theme } = useTheme();
  const [university, setUniversity] = useState<University | null>(null);

  useEffect(() => {
    loadUniversity();
  }, [userData]);

  const loadUniversity = async () => {
    // TODO: Load university data from database
    // For now, using mock data
    if (userData?.university) {
      // const uni = await DatabaseService.getUniversity(userData.university);
      // setUniversity(uni);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
            {university?.logo && (
              <Image source={{ uri: university.logo }} style={styles.universityLogo} />
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
          <Text style={styles.sectionCount}>{userData.courses?.length || 0}</Text>
        </View>
        {userData.courses && userData.courses.length > 0 ? (
          <View style={styles.coursesList}>
            {userData.courses.slice(0, 5).map((courseId, index) => (
              <View key={index} style={styles.courseTag}>
                <Text style={styles.courseTagText}>Course {index + 1}</Text>
              </View>
            ))}
            {userData.courses.length > 5 && (
              <Text style={styles.moreText}>+{userData.courses.length - 5} more</Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>No courses yet</Text>
        )}
      </View>

      {/* Clubs Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Clubs & Organizations</Text>
          <Text style={styles.sectionCount}>{userData.clubs?.length || 0}</Text>
        </View>
        {userData.clubs && userData.clubs.length > 0 ? (
          <View style={styles.clubsList}>
            {userData.clubs.slice(0, 5).map((clubId, index) => (
              <View key={index} style={styles.clubTag}>
                <Text style={styles.clubTagText}>Club {index + 1}</Text>
              </View>
            ))}
            {userData.clubs.length > 5 && (
              <Text style={styles.moreText}>+{userData.clubs.length - 5} more</Text>
            )}
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
  );
}

const createStyles = (theme: any, university: University | null) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 16,
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
    moreText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      alignSelf: 'center',
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
