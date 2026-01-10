import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User, Course, Club } from '../types';
import { Ionicons } from '@expo/vector-icons';

type SearchResult = {
  type: 'user' | 'course' | 'club';
  data: User | Course | Club;
};

export default function SearchScreen({ navigation }: any) {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !userData?.university) return;

    setSearching(true);
    try {
      const [users, courses, clubs] = await Promise.all([
        DatabaseService.searchUsers(searchQuery, userData.university),
        DatabaseService.getCourses(userData.university),
        DatabaseService.getClubs(userData.university),
      ]);

      const filteredCourses = courses.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const filteredClubs = clubs.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const allResults: SearchResult[] = [
        ...users.map(u => ({ type: 'user' as const, data: u })),
        ...filteredCourses.map(c => ({ type: 'course' as const, data: c })),
        ...filteredClubs.map(c => ({ type: 'club' as const, data: c })),
      ];

      setResults(allResults);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => {
    const styles = createStyles(theme);

    if (item.type === 'user') {
      const user = item.data as User;
      return (
        <TouchableOpacity
          style={styles.resultCard}
          onPress={() => navigation.navigate('Profile', { userId: user.id })}
        >
          <Ionicons name="person-circle" size={40} color={theme.colors.textSecondary} />
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle}>{user.name}</Text>
            <Text style={styles.resultSubtitle}>{user.email}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item.type === 'course') {
      const course = item.data as Course;
      return (
        <TouchableOpacity
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
    }

    if (item.type === 'club') {
      const club = item.data as Club;
      return (
        <TouchableOpacity
          style={styles.resultCard}
          onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
        >
          <Ionicons name="people" size={40} color={theme.colors.secondary} />
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle}>{club.name}</Text>
            {club.description && (
              <Text style={styles.resultSubtitle} numberOfLines={1}>
                {club.description}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users, courses, clubs..."
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
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={renderResult}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>Search for users, courses, or clubs</Text>
        </View>
      )}
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
    listContent: {
      padding: 16,
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
      color: theme.colors.textSecondary,
      marginTop: 16,
    },
  });
