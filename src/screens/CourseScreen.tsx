import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Course } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function CourseScreen({ navigation }: any) {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'enrolled' | 'interested'>('all');

  useEffect(() => {
    loadCourses();
  }, [userData]);

  useEffect(() => {
    filterCourses();
  }, [courses, searchQuery, selectedFilter]);

  const loadCourses = async () => {
    if (!userData?.university) return;
    
    try {
      const allCourses = await DatabaseService.getCourses(userData.university);
      setCourses(allCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const filterCourses = () => {
    let filtered = [...courses];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply enrollment filter
    if (selectedFilter === 'enrolled' && userData?.courses) {
      filtered = filtered.filter(c => userData.courses.includes(c.id));
    }

    setFilteredCourses(filtered);
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses or professors..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'enrolled', 'interested'] as const).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              selectedFilter === filter && styles.filterTabSelected,
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterTabText,
                selectedFilter === filter && styles.filterTabTextSelected,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Courses List */}
      <FlatList
        data={filteredCourses}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.courseCard}
            onPress={() => navigation.navigate('CourseDetail', { courseId: item.id })}
          >
            <View style={styles.courseHeader}>
              <Text style={styles.courseCode}>{item.code}</Text>
              {userData?.courses?.includes(item.id) && (
                <View style={styles.enrolledBadge}>
                  <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                </View>
              )}
            </View>
            <Text style={styles.courseName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.courseDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.courseFooter}>
              <Ionicons name="people-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.courseMeta}>
                {item.professors?.length || 0} professors
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No courses found</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      margin: 16,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 44,
      color: theme.colors.text,
      fontSize: 16,
    },
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterTabSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterTabText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    filterTabTextSelected: {
      color: '#FFFFFF',
    },
    listContent: {
      padding: 16,
    },
    courseCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    courseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    courseCode: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    enrolledBadge: {
      backgroundColor: theme.colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    enrolledBadgeText: {
      fontSize: 12,
      color: theme.colors.success,
      fontWeight: '600',
    },
    courseName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    courseDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    courseFooter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    courseMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
