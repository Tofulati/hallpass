import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { MLService } from '../services/mlService';
import { Course, Professor, Discussion, User } from '../types';
import { Ionicons } from '@expo/vector-icons';
import DiscussionCard from '../components/DiscussionCard';

export default function CourseDetailScreen({ route, navigation }: any) {
  const { courseId } = route.params;
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [course, setCourse] = useState<Course | null>(null);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [privateDiscussions, setPrivateDiscussions] = useState<Discussion[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'professors' | 'discussions' | 'private'>('discussions');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  useEffect(() => {
    if (course) {
      loadMembers();
      loadDiscussions();
      if (isEnrolled) {
        loadPrivateDiscussions();
        // Set default tab to 'private' if enrolled and still on default 'discussions' tab
        setActiveTab(prevTab => prevTab === 'discussions' ? 'private' : prevTab);
      }
    }
  }, [course, isEnrolled]);

  const loadCourse = async () => {
    try {
      const courseData = await DatabaseService.getCourse(courseId);
      setCourse(courseData);
      
      if (courseData) {
        // Load actual professor data with real ratings
        await loadProfessors(courseData.professors || []);
      }

      // Check if enrolled
      if (userData?.courses?.includes(courseId)) {
        setIsEnrolled(true);
      }
    } catch (error) {
      console.error('Error loading course:', error);
    }
  };

  const loadProfessors = async (professorsFromCourse: Professor[]) => {
    if (!userData?.university || professorsFromCourse.length === 0) {
      setProfessors(professorsFromCourse);
      return;
    }

    try {
      const universityId = typeof userData.university === 'string' 
        ? userData.university 
        : userData.university.id;

      // Fetch actual professor data with real ratings
      const professorPromises = professorsFromCourse.map(async (prof) => {
        try {
          // Get or create professor to get the actual ID
          const professorId = await DatabaseService.getOrCreateProfessor(
            prof.name,
            universityId,
            prof.email
          );
          
          // Fetch actual professor data with calculated ratings
          const actualProfessor = await DatabaseService.getProfessor(professorId);
          
          if (actualProfessor) {
            return actualProfessor;
          }
          
          // Fallback to course professor data if actual professor not found
          return prof;
        } catch (error) {
          console.error(`Error loading professor ${prof.name}:`, error);
          // Fallback to course professor data on error
          return prof;
        }
      });

      const actualProfessors = await Promise.all(professorPromises);
      setProfessors(actualProfessors.filter((p): p is Professor => p !== null));
    } catch (error) {
      console.error('Error loading professors:', error);
      // Fallback to course professors on error
      setProfessors(professorsFromCourse);
    }
  };

  const loadMembers = async () => {
    if (!course?.members || course.members.length === 0) {
      setMembers([]);
      return;
    }

    setLoadingMembers(true);
    try {
      // Filter out invalid member IDs before fetching
      const validMemberIds = course.members.filter(id => id && typeof id === 'string' && id.trim() !== '');
      const memberPromises = validMemberIds.map(memberId => 
        DatabaseService.getUser(memberId)
      );
      const memberResults = await Promise.all(memberPromises);
      const validMembers = memberResults.filter((m): m is User => m !== null);
      setMembers(validMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadDiscussions = async () => {
    if (!courseId) return;
    
    setLoadingDiscussions(true);
    try {
      const allDiscussions = await DatabaseService.getDiscussions(
        { courseId },
        'popularity',
        50
      );
      
      // Apply ML ranking
      const rankedDiscussions = allDiscussions.map(discussion => {
        const rankingInput = {
          upvotes: discussion.upvotes.length,
          downvotes: discussion.downvotes.length,
          comments: discussion.comments.length,
          timeSinceCreation: Date.now() - discussion.createdAt.getTime(),
          userRanking: 0,
        };
        const mlOutput = MLService.calculateRanking(rankingInput);
        return {
          ...discussion,
          score: mlOutput.score,
          controversy: mlOutput.controversy,
        };
      });

      rankedDiscussions.sort((a, b) => b.score - a.score);
      setDiscussions(rankedDiscussions);
    } catch (error) {
      console.error('Error loading discussions:', error);
    } finally {
      setLoadingDiscussions(false);
    }
  };

  const loadPrivateDiscussions = async () => {
    if (!courseId || !isEnrolled) return;
    
    try {
      const allDiscussions = await DatabaseService.getDiscussions(
        { courseId, isPrivate: true },
        'popularity',
        50
      );
      
      // Apply ML ranking
      const rankedDiscussions = allDiscussions.map(discussion => {
        const rankingInput = {
          upvotes: discussion.upvotes.length,
          downvotes: discussion.downvotes.length,
          comments: discussion.comments.length,
          timeSinceCreation: Date.now() - discussion.createdAt.getTime(),
          userRanking: 0,
        };
        const mlOutput = MLService.calculateRanking(rankingInput);
        return {
          ...discussion,
          score: mlOutput.score,
          controversy: mlOutput.controversy,
        };
      });

      rankedDiscussions.sort((a, b) => b.score - a.score);
      setPrivateDiscussions(rankedDiscussions);
    } catch (error) {
      console.error('Error loading private discussions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadCourse(),
      loadMembers(),
      loadDiscussions(),
      isEnrolled ? loadPrivateDiscussions() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const styles = createStyles(theme);

  if (!course) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerSection}>
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
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
        {isEnrolled && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'private' && styles.tabActive]}
            onPress={() => {
              setActiveTab('private');
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
          >
            <View style={styles.tabWithIcon}>
              <Ionicons 
                name="lock-closed" 
                size={16} 
                color={activeTab === 'private' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'private' && styles.tabTextActive]}>
                Private ({privateDiscussions.length})
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discussions' && styles.tabActive]}
          onPress={() => {
            setActiveTab('discussions');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'discussions' && styles.tabTextActive]}>
            Discussions ({discussions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'professors' && styles.tabActive]}
          onPress={() => {
            setActiveTab('professors');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'professors' && styles.tabTextActive]}>
            Professors ({professors.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => {
            setActiveTab('members');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members ({members.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
        stickyHeaderIndices={[1]}
      >
        {renderHeader()}
        {renderTabs()}

        {/* Tab Content */}
        {activeTab === 'private' && isEnrolled && (
          <View style={styles.tabContentInner}>
            <TouchableOpacity
              style={styles.addDiscussionButton}
              onPress={() => navigation.navigate('CreateDiscussion', { courseId: course.id, isPrivate: true })}
            >
              <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
              <Text style={styles.addDiscussionButtonText}>Start a Private Discussion</Text>
            </TouchableOpacity>
            {privateDiscussions.length > 0 ? (
              privateDiscussions.map(discussion => (
                <DiscussionCard key={discussion.id} discussion={discussion} navigation={navigation} />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="lock-closed-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No private discussions yet</Text>
                <Text style={styles.emptySubtext}>Start a private discussion with enrolled students!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'discussions' && (
          <View style={styles.tabContentInner}>
            <TouchableOpacity
              style={styles.addDiscussionButton}
              onPress={() => navigation.navigate('CreateDiscussion', { courseId: course.id, isPrivate: false })}
            >
              <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
              <Text style={styles.addDiscussionButtonText}>Start a Discussion</Text>
            </TouchableOpacity>
            {loadingDiscussions ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Loading discussions...</Text>
              </View>
            ) : discussions.length > 0 ? (
              discussions.map(discussion => (
                <DiscussionCard key={discussion.id} discussion={discussion} navigation={navigation} />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No discussions yet</Text>
                <Text style={styles.emptySubtext}>Be the first to start a discussion!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'professors' && (
          <View style={styles.tabContentInner}>
            <TouchableOpacity
              style={styles.addDiscussionButton}
              onPress={() => navigation.navigate('RequestProfessor', { courseId: course.id })}
            >
              <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
              <Text style={styles.addDiscussionButtonText}>Request Add Professor</Text>
            </TouchableOpacity>
            {professors.length > 0 ? (
              professors.map((prof) => {
                const handleProfessorPress = async () => {
                  try {
                    // Get or create professor document
                    if (!userData?.university) return;
                    
                    const universityId = typeof userData.university === 'string' 
                      ? userData.university 
                      : userData.university.id;
                    
                    const professorId = await DatabaseService.getOrCreateProfessor(
                      prof.name,
                      universityId,
                      prof.email
                    );
                    
                    navigation.navigate('ProfessorDetail', { professorId });
                  } catch (error) {
                    console.error('Error navigating to professor:', error);
                  }
                };

                return (
                  <TouchableOpacity
                    key={prof.id}
                    style={styles.professorCard}
                    onPress={handleProfessorPress}
                  >
                    <Text style={styles.professorName}>{prof.name}</Text>
                    <View style={styles.professorRightSection}>
                      {prof.averageRating && prof.averageRating.totalRating !== undefined && prof.averageRating.totalRating !== null && prof.averageRating.totalRating > 0 && (
                        <View style={styles.ratingContainer}>
                          <Ionicons name="star" size={16} color={theme.colors.upvote} />
                          <Text style={styles.ratingText}>
                            {prof.averageRating.totalRating.toFixed(1)}/5
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} style={styles.chevronIcon} />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="school-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No professors listed</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'members' && (
          <View style={styles.tabContentInner}>
            {loadingMembers ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Loading members...</Text>
              </View>
            ) : members.length > 0 ? (
              members.map(member => {
                const isSelf = user?.uid === member.id;
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.memberCard}
                    onPress={() => {
                      if (isSelf) {
                        // Navigate to User tab if clicking on self
                        navigation.getParent()?.navigate('User');
                      } else {
                        navigation.navigate('Profile', { userId: member.id });
                      }
                    }}
                  >
                    <Ionicons name="person-circle" size={40} color={theme.colors.textSecondary} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {member.username && (
                        <Text style={styles.memberUsername}>@{member.username}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No members yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    centerContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    headerSection: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 8,
    },
    content: {
      flexGrow: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
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
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    tabContainer: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderTopWidth: 1,
      borderBottomColor: theme.colors.border,
      borderTopColor: theme.colors.border,
      paddingVertical: 8,
      marginBottom: 0,
      zIndex: 10,
    },
    tabScrollContent: {
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginRight: 8,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    tabWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tabContentInner: {
      padding: 16,
      paddingTop: 16,
    },
    addDiscussionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary + '20',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
    },
    addDiscussionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      marginLeft: 8,
    },
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    memberUsername: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyDiscussions: {
      padding: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
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
    professorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    professorRightSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 8,
    },
    ratingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    chevronIcon: {
      marginLeft: 0,
    },
    emptyProfessorText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
