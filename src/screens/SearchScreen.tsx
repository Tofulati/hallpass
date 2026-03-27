import React, { useState, useEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User, Course, Organization, Professor } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { RateMyProfessorService, type RateMyProfessorRating } from '../services/rateMyProfessorService';

type SearchResult = {
  type: 'user' | 'course' | 'organization' | 'professor';
  data: User | Course | Organization | Professor;
};

type SearchResultsByCategory = {
  users: User[];
  courses: Course[];
  organizations: Organization[];
  professors: Professor[];
};

type RecommendationSets = SearchResultsByCategory;

export default function SearchScreen({ navigation }: any) {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultsByCategory>({
    users: [],
    courses: [],
    organizations: [],
    professors: [],
  });
  const [recommendations, setRecommendations] = useState<RecommendationSets>({
    users: [],
    courses: [],
    organizations: [],
    professors: [],
  });
  const [searching, setSearching] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [universityName, setUniversityName] = useState<string>('');
  const [rmpByProfessorId, setRmpByProfessorId] = useState<Record<string, RateMyProfessorRating | null>>({});

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || !userData?.university) {
      setResults({ users: [], courses: [], organizations: [], professors: [] });
      setSearching(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const universityId =
          typeof userData.university === 'string'
            ? userData.university
            : userData.university.id;

        const [users, courses, organizations, professors] = await Promise.all([
          DatabaseService.searchUsers(q, universityId),
          DatabaseService.getCourses(universityId),
          DatabaseService.getOrganizations(universityId),
          DatabaseService.getProfessors(universityId, q),
        ]);

        const qLower = q.toLowerCase();
        const filteredCourses = courses.filter(
          c =>
            c.name.toLowerCase().includes(qLower) || c.code.toLowerCase().includes(qLower)
        );

        const filteredOrganizations = organizations.filter(
          o =>
            o.name.toLowerCase().includes(qLower) ||
            o.description?.toLowerCase().includes(qLower)
        );

        if (!cancelled) {
          setResults({
            users,
            courses: filteredCourses,
            organizations: filteredOrganizations,
            professors,
          });
        }
      } catch (error) {
        console.error('Error searching:', error);
        if (!cancelled) {
          setResults({ users: [], courses: [], organizations: [], professors: [] });
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, userData]);

  useEffect(() => {
    if (!userData?.university || !userData?.id) {
      setRecommendations({ users: [], courses: [], organizations: [], professors: [] });
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingRecommendations(true);
      try {
        const universityId =
          typeof userData.university === 'string'
            ? userData.university
            : userData.university.id;

        const [discussions, courses, organizations, professors, allUniversityUsers] = await Promise.all([
          DatabaseService.getDiscussions({ universityId }, 'recent', 500),
          DatabaseService.getCourses(universityId),
          DatabaseService.getOrganizations(universityId),
          DatabaseService.getProfessors(universityId),
          DatabaseService.searchUsers('', universityId),
        ]);

        const courseDiscussionCounts = new Map<string, number>();
        const organizationDiscussionCounts = new Map<string, number>();
        for (const discussion of discussions) {
          if (discussion.courseId) {
            courseDiscussionCounts.set(
              discussion.courseId,
              (courseDiscussionCounts.get(discussion.courseId) ?? 0) + 1
            );
          }
          if (discussion.organizationId) {
            organizationDiscussionCounts.set(
              discussion.organizationId,
              (organizationDiscussionCounts.get(discussion.organizationId) ?? 0) + 1
            );
          }
        }

        const trendingCourses = [...courses]
          .sort((a, b) => {
            const aCount = courseDiscussionCounts.get(a.id) ?? 0;
            const bCount = courseDiscussionCounts.get(b.id) ?? 0;
            if (bCount !== aCount) return bCount - aCount;
            return (b.members?.length ?? 0) - (a.members?.length ?? 0);
          })
          .slice(0, 8);

        const trendingOrganizations = [...organizations]
          .sort((a, b) => {
            const aCount = organizationDiscussionCounts.get(a.id) ?? 0;
            const bCount = organizationDiscussionCounts.get(b.id) ?? 0;
            if (bCount !== aCount) return bCount - aCount;
            return (b.members?.length ?? 0) - (a.members?.length ?? 0);
          })
          .slice(0, 8);

        const viewerNetwork = new Set<string>([
          ...(userData.following || []),
          ...(userData.followers || []),
        ]);

        const recommendedUsers = allUniversityUsers
          .filter((candidate) => candidate.id !== userData.id)
          .filter((candidate) => !(userData.following || []).includes(candidate.id))
          .map((candidate) => {
            const mutuals = new Set<string>();
            for (const id of candidate.followers || []) {
              if (viewerNetwork.has(id)) mutuals.add(id);
            }
            for (const id of candidate.following || []) {
              if (viewerNetwork.has(id)) mutuals.add(id);
            }
            return {
              candidate,
              mutualCount: mutuals.size,
            };
          })
          .sort((a, b) => {
            if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount;
            return (b.candidate.discussionRanking || 0) - (a.candidate.discussionRanking || 0);
          })
          .map((x) => x.candidate)
          .slice(0, 8);

        const userCourseIds = (userData.courses || [])
          .map((course: any) => {
            if (typeof course === 'string') return course;
            if (course?.id && typeof course.id === 'string') return course.id;
            return null;
          })
          .filter((id: string | null): id is string => !!id);
        const courseIdSet = new Set<string>(userCourseIds);

        const recommendedProfessors = professors
          .filter((prof) => {
            const byCourseArray = (prof.courses || []).some((courseId) => courseIdSet.has(courseId));
            const byTaughtCourses = (prof.taughtCourses || []).some((entry) =>
              courseIdSet.has(entry.courseId)
            );
            return byCourseArray || byTaughtCourses;
          })
          .sort((a, b) => (b.averageRating?.totalRating || 0) - (a.averageRating?.totalRating || 0))
          .slice(0, 8);

        if (!cancelled) {
          setRecommendations({
            users: recommendedUsers,
            courses: trendingCourses,
            organizations: trendingOrganizations,
            professors: recommendedProfessors,
          });
        }
      } catch (error) {
        console.error('Error loading search recommendations:', error);
        if (!cancelled) {
          setRecommendations({ users: [], courses: [], organizations: [], professors: [] });
        }
      } finally {
        if (!cancelled) setLoadingRecommendations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userData]);

  useEffect(() => {
    // Fetch university name once (needed for RMP lookup).
    if (!userData?.university) return;
    let cancelled = false;
    (async () => {
      try {
        const universityId =
          typeof userData.university === 'string' ? userData.university : userData.university.id;
        const uni = await DatabaseService.getUniversity(universityId);
        const name = uni?.name || '';
        if (!cancelled) setUniversityName(name);
      } catch {
        if (!cancelled) setUniversityName('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userData?.university]);

  useEffect(() => {
    // Best-effort: enrich professor search results with RMP ratings so the list rating matches the profile.
    if (!universityName.trim()) return;
    const professorsToEnrich = [...results.professors, ...recommendations.professors];
    if (!professorsToEnrich.length) return;

    let cancelled = false;
    (async () => {
      for (const prof of professorsToEnrich) {
        if (cancelled) return;
        if (!prof?.id || !prof?.name) continue;
        if (Object.prototype.hasOwnProperty.call(rmpByProfessorId, prof.id)) continue;

        try {
          const rating = await RateMyProfessorService.lookupProfessorRating({
            universityName,
            professorName: prof.name,
          });
          if (!cancelled) {
            setRmpByProfessorId((prev) => ({ ...prev, [prof.id]: rating }));
          }
        } catch {
          if (!cancelled) {
            setRmpByProfessorId((prev) => ({ ...prev, [prof.id]: null }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [results.professors, recommendations.professors, universityName, Object.keys(rmpByProfessorId).length]);

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

  const renderProfessor = (professor: Professor) => {
    const appOverall = professor.averageRating?.totalRating ?? 0;
    const internalCount = professor.ratings?.length ?? 0;
    const rmpRating = professor.id ? rmpByProfessorId[professor.id] : undefined;
    const rmpOverall = rmpRating?.totalRating ?? null;

    const combinedOverall =
      rmpOverall && rmpOverall > 0
        ? internalCount > 0
          ? (appOverall + rmpOverall) / 2
          : rmpOverall
        : appOverall;

    return (
    <TouchableOpacity
      key={professor.id}
      style={styles.resultCard}
      onPress={() => navigation.navigate('ProfessorDetail', { professorId: professor.id })}
    >
      <Ionicons name="school" size={40} color={theme.colors.primary} />
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{professor.name}</Text>
        {professor.email && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {professor.email}
          </Text>
        )}
        {combinedOverall > 0 && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            Rating: {combinedOverall.toFixed(1)}/5
          </Text>
        )}
      </View>
    </TouchableOpacity>
    );
  };

  const showingSearchResults = debouncedQuery.trim().length > 0;
  const shownData = showingSearchResults ? results : recommendations;
  const hasResults =
    shownData.users.length > 0 ||
    shownData.courses.length > 0 ||
    shownData.organizations.length > 0 ||
    shownData.professors.length > 0;

  const queryTrim = searchQuery.trim();
  const debTrim = debouncedQuery.trim();
  const pendingDebounce = queryTrim.length > 0 && queryTrim !== debTrim;

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users, courses, organizations, professors..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searching || pendingDebounce ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 4 }} />
        ) : null}
      </View>

      {/* Results */}
      {hasResults ? (
        <ScrollView 
          contentContainerStyle={[styles.resultsContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Users Section */}
          {shownData.users.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {showingSearchResults ? 'Users' : 'Recommended Users'} ({shownData.users.length})
                </Text>
              </View>
              <View style={styles.sectionContent}>
                {shownData.users.map(renderUser)}
              </View>
            </View>
          )}

          {/* Professors Section */}
          {shownData.professors.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {showingSearchResults ? 'Professors' : 'Recommended Professors'} ({shownData.professors.length})
                </Text>
              </View>
              <View style={styles.sectionContent}>
                {shownData.professors.map(renderProfessor)}
              </View>
            </View>
          )}

          {/* Courses Section */}
          {shownData.courses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {showingSearchResults ? 'Courses' : 'Trending Courses'} ({shownData.courses.length})
                </Text>
              </View>
              <View style={styles.sectionContent}>
                {shownData.courses.map(renderCourse)}
              </View>
            </View>
          )}

          {/* Organizations Section */}
          {shownData.organizations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {showingSearchResults ? 'Organizations' : 'Trending Organizations'} ({shownData.organizations.length})
                </Text>
              </View>
              <View style={styles.sectionContent}>
                {shownData.organizations.map(renderOrganization)}
              </View>
            </View>
          )}
        </ScrollView>
      ) : searching || loadingRecommendations ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.emptySubtext}>Loading recommendations...</Text>
        </View>
      ) : searchQuery.trim() ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No recommendations yet</Text>
          <Text style={styles.emptySubtext}>Try searching users, courses, organizations, or professors</Text>
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
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    sectionContent: {
      marginTop: 4,
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
