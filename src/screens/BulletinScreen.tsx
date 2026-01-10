import React, { useState, useEffect, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { MLService } from '../services/mlService';
import { Discussion, SortOption, University } from '../types';
import DiscussionCard from '../components/DiscussionCard';
import { Ionicons } from '@expo/vector-icons';

// Helper function to interpolate between two hex colors
const interpolateColor = (color1: string, color2: string, factor: number): string => {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  // Convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const r = rgb1.r + (rgb2.r - rgb1.r) * factor;
  const g = rgb1.g + (rgb2.g - rgb1.g) * factor;
  const b = rgb1.b + (rgb2.b - rgb1.b) * factor;

  return rgbToHex(r, g, b);
};

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
  const [university, setUniversity] = useState<University | null>(null);
  
  // Create styles early so it's available for useMemo
  const styles = createStyles(theme, university);
  
  // Memoize the HallPass title letters to avoid recalculating on every render
  const hallPassLetters = useMemo(() => {
    const text = 'HallPass';
    const primaryColor = university?.colors?.primary || theme.colors.primary;
    const secondaryColor = university?.colors?.secondary || theme.colors.secondary;
    return text.split('').map((letter, index) => {
      const factor = index / (text.length - 1); // 0 to 1
      const letterColor = interpolateColor(primaryColor, secondaryColor, factor);
      return (
        <Text key={index} style={[styles.headerTitleLetter, { color: letterColor }]}>
          {letter}
        </Text>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [university?.colors?.primary, university?.colors?.secondary, theme.colors.primary, theme.colors.secondary]);

  useEffect(() => {
    loadDiscussions();
    loadUniversity();
  }, [sortBy, userData]);

  useEffect(() => {
    filterAndSortDiscussions();
  }, [discussions, searchQuery, selectedFilter, sortBy]);

  const loadUniversity = async () => {
    if (userData?.university && typeof userData.university === 'string') {
      try {
        const uni = await DatabaseService.getUniversity(userData.university);
        setUniversity(uni);
      } catch (error) {
        console.error('Error loading university:', error);
      }
    }
  };

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

  const renderHeader = () => (
    <View>
      {/* Header with HallPass Title */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          {hallPassLetters}
        </View>
      </View>

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
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Fixed Header - Logo, Search, Sort */}
      {renderHeader()}
      
      {/* Discussions List */}
      <FlatList
        style={styles.list}
        data={filteredDiscussions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DiscussionCard discussion={item} navigation={navigation} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
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
    </SafeAreaView>
  );
}

const createStyles = (theme: any, university: University | null) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: 5,
      paddingBottom: 2,
      paddingHorizontal: 10,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    headerTitleLetter: {
      fontSize: 28,
      fontWeight: 'bold',
      letterSpacing: 0.5,
      textAlign: 'center',
      backgroundColor: 'transparent',
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
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
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
      right: 40,
      bottom: 20, // 40px (tab bar height) + 24px (padding) = 64px from bottom for equal padding
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
