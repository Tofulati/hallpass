import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User, Course, Organization } from '../types';
import { Ionicons } from '@expo/vector-icons';

type SearchResult = {
  type: 'user' | 'course' | 'organization';
  data: User | Course | Organization;
};

type SearchResultsByCategory = {
  users: User[];
  courses: Course[];
  organizations: Organization[];
};

export default function SearchScreen({ navigation }: any) {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultsByCategory>({
    users: [],
    courses: [],
    organizations: [],
  });
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !userData?.university) {
      setResults({ users: [], courses: [], organizations: [] });
      return;
    }

    setSearching(true);
    try {
      const [users, courses, organizations] = await Promise.all([
        DatabaseService.searchUsers(searchQuery, userData.university),
        DatabaseService.getCourses(userData.university),
        DatabaseService.getOrganizations(userData.university),
      ]);

      const filteredCourses = courses.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const filteredOrganizations = organizations.filter(
        o =>
          o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setResults({
        users,
        courses: filteredCourses,
        organizations: filteredOrganizations,
      });
    } catch (error) {
      console.error('Error searching:', error);
      setResults({ users: [], courses: [], organizations: [] });
    } finally {
      setSearching(false);
    }
  };

  const renderUser = (user: User) => (
    <TouchableOpacity
      key={user.id}
      style={styles.resultCard}
      onPress={() => navigation.navigate('Profile', { userId: user.id })}
    >
      <Ionicons name="person-circle" size={40} color={theme.colors.textSecondary} />
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{user.name}</Text>
        {user.username && (
          <Text style={styles.resultSubtitle}>@{user.username}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCourse = (course: Course) => (
    <TouchableOpacity
      key={course.id}
      style={styles.resultCard}
      onPress={() => navigation.navigate('CourseDetail', { courseId: course.id })}
    >
      <Ionicons name="book" size={40} color={theme.colors.primary} />
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{course.code}</Text>
        <Text style={styles.resultSubtitle}>{course.name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderOrganization = (organization: Organization) => (
    <TouchableOpacity
      key={organization.id}
      style={styles.resultCard}
      onPress={() => navigation.navigate('ClubDetail', { organizationId: organization.id })}
    >
      <Ionicons name="people" size={40} color={theme.colors.secondary} />
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{organization.name}</Text>
        {organization.description && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {organization.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const hasResults = results.users.length > 0 || results.courses.length > 0 || results.organizations.length > 0;

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users, courses, organizations..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={handleSearch} disabled={searching}>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={searching ? theme.colors.textSecondary : theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Results */}
      {hasResults ? (
        <ScrollView 
          contentContainerStyle={[styles.resultsContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Users Section */}
          {results.users.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Users ({results.users.length})</Text>
              {results.users.map(renderUser)}
            </View>
          )}

          {/* Courses Section */}
          {results.courses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Courses ({results.courses.length})</Text>
              {results.courses.map(renderCourse)}
            </View>
          )}

          {/* Organizations Section */}
          {results.organizations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organizations ({results.organizations.length})</Text>
              {results.organizations.map(renderOrganization)}
            </View>
          )}
        </ScrollView>
      ) : searchQuery.trim() ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>Search for users, courses, or organizations</Text>
        </View>
      )}
    </SafeAreaView>
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
    resultsContent: {
      padding: 16,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    resultCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    resultContent: {
      flex: 1,
      marginLeft: 12,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    resultSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 16,
      fontWeight: '600',
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
  });
