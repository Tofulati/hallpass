import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Course, Professor } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function CourseDetailScreen({ route, navigation }: any) {
  const { courseId } = route.params;
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [course, setCourse] = useState<Course | null>(null);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const courseData = await DatabaseService.getCourse(courseId);
      setCourse(courseData);
      
      if (courseData) {
        // Load professors
        const profs = await Promise.all(
          courseData.professors.map(id => DatabaseService.getProfessor(id))
        );
        setProfessors(profs.filter(p => p !== null) as Professor[]);
      }

      // Check if enrolled
      if (userData?.courses?.includes(courseId)) {
        setIsEnrolled(true);
      }
    } catch (error) {
      console.error('Error loading course:', error);
    }
  };

  const styles = createStyles(theme);

  if (!course) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.courseCode}>{course.code}</Text>
        {isEnrolled && (
          <View style={styles.enrolledBadge}>
            <Text style={styles.enrolledBadgeText}>Enrolled</Text>
          </View>
        )}
      </View>
      <Text style={styles.courseName}>{course.name}</Text>
      {course.description && (
        <Text style={styles.description}>{course.description}</Text>
      )}

      {/* Professors Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Professors</Text>
        {professors.length > 0 ? (
          professors.map(prof => (
            <TouchableOpacity
              key={prof.id}
              style={styles.professorCard}
              onPress={() => navigation.navigate('ProfessorDetail', { professorId: prof.id })}
            >
              <View style={styles.professorInfo}>
                <Text style={styles.professorName}>{prof.name}</Text>
                {prof.averageRating && (
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={16} color={theme.colors.upvote} />
                    <Text style={styles.ratingText}>
                      {(prof.averageRating.enjoyment + prof.averageRating.communication) / 2}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No professors listed</Text>
        )}
      </View>

      {/* Discussions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discussions</Text>
        <TouchableOpacity
          style={styles.discussionButton}
          onPress={() => navigation.navigate('CourseDiscussions', { courseId })}
        >
          <Text style={styles.discussionButtonText}>View All Discussions</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Private Session (if enrolled) */}
      {isEnrolled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Private Session</Text>
          <TouchableOpacity
            style={styles.privateSessionButton}
            onPress={() => navigation.navigate('PrivateSession', { courseId })}
          >
            <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
            <Text style={styles.privateSessionButtonText}>Access Private Session</Text>
          </TouchableOpacity>
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    courseCode: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    enrolledBadge: {
      backgroundColor: theme.colors.success + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    enrolledBadgeText: {
      fontSize: 12,
      color: theme.colors.success,
      fontWeight: '600',
    },
    courseName: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 24,
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
    professorCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    professorInfo: {
      flex: 1,
    },
    professorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ratingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginLeft: 4,
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
    privateSessionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    privateSessionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginLeft: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
