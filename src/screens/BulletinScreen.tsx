import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { MLService } from '../services/mlService';
import { Discussion, SortOption } from '../types';
import DiscussionCard from '../components/DiscussionCard';
import { Ionicons } from '@expo/vector-icons';

export default function BulletinScreen({ navigation }: any) {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [filteredDiscussions, setFilteredDiscussions] = useState<Discussion[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadDiscussions();
  }, [sortBy, userData]);

  useEffect(() => {
    filterAndSortDiscussions();
  }, [discussions, searchQuery, selectedFilter, sortBy]);

  const loadDiscussions = async () => {
    try {
      const allDiscussions = await DatabaseService.getDiscussions(
        {},
        sortBy,
        100
      );
      
      // Apply ML ranking
      const rankedDiscussions = allDiscussions.map(discussion => {
        const rankingInput = {
          upvotes: discussion.upvotes.length,
          downvotes: discussion.downvotes.length,
          comments: discussion.comments.length,
          timeSinceCreation: Date.now() - discussion.createdAt.getTime(),
          userRanking: 0, // TODO: Get from user data
        };
        const mlOutput = MLService.calculateRanking(rankingInput);
        return {
          ...discussion,
          score: mlOutput.score,
          controversy: mlOutput.controversy,
        };
      });

      // Sort by ML score if popularity
      if (sortBy === 'popularity') {
        rankedDiscussions.sort((a, b) => b.score - a.score);
      } else if (sortBy === 'controversy') {
        rankedDiscussions.sort((a, b) => b.controversy - a.controversy);
      }

      setDiscussions(rankedDiscussions);
    } catch (error) {
      console.error('Error loading discussions:', error);
    }
  };

  const filterAndSortDiscussions = () => {
    let filtered = [...discussions];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        d =>
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(d => {
        if (selectedFilter === 'course' && d.courseId) return true;
        if (selectedFilter === 'professor' && d.professorId) return true;
        if (selectedFilter === 'club' && d.clubId) return true;
        if (selectedFilter === 'tag' && d.tags.length > 0) return true;
        return false;
      });
    }

    setFilteredDiscussions(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiscussions();
    setRefreshing(false);
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header with University Image/Logo */}
      {userData?.university && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bulletin</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search discussions..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'course', 'professor', 'club', 'tag'].map(filter => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === filter && styles.filterChipTextSelected,
                  ]}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {(['popularity', 'controversy', 'recent'] as SortOption[]).map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sortButton,
              sortBy === option && styles.sortButtonSelected,
            ]}
            onPress={() => setSortBy(option)}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortBy === option && styles.sortButtonTextSelected,
              ]}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Discussions List */}
      <FlatList
        data={filteredDiscussions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DiscussionCard discussion={item} navigation={navigation} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No discussions found</Text>
          </View>
        }
      />

      {/* Create Discussion Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateDiscussion')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
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
    filterButton: {
      padding: 4,
    },
    filterContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      color: theme.colors.text,
      fontSize: 14,
    },
    filterChipTextSelected: {
      color: '#FFFFFF',
    },
    sortContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sortLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginRight: 8,
    },
    sortButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sortButtonSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    sortButtonText: {
      fontSize: 12,
      color: theme.colors.text,
    },
    sortButtonTextSelected: {
      color: '#FFFFFF',
    },
    listContent: {
      padding: 16,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 80,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
  });
