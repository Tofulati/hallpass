import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { MLService } from '../services/mlService';
import { Organization, Discussion, SortOption, User } from '../types';
import { Ionicons } from '@expo/vector-icons';
import DiscussionCard from '../components/DiscussionCard';

export default function ClubDetailScreen({ route, navigation }: any) {
  const { clubId, organizationId } = route.params;
  const orgId = organizationId || clubId; // Support both param names
  const { user, userData, refreshUserData } = useAuth();
  const { theme } = useTheme();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'discussions' | 'members'>('discussions');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [imageError, setImageError] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadOrganization();
  }, [orgId, userData]);

  useEffect(() => {
    if (organization) {
      loadMembers();
      if (isMember) {
        loadDiscussions();
      } else {
        setDiscussions([]);
      }
    }
  }, [organization, isMember]);

  const loadOrganization = async () => {
    setLoading(true);
    setImageError(false);
    try {
      const orgData = await DatabaseService.getOrganization(orgId);
      if (orgData && orgData.logo) {
        // Clean up logo URL - remove any spaces and ensure it's a valid URL
        orgData.logo = orgData.logo.trim().replace(/\s+/g, '');
      }
      setOrganization(orgData);
      
      // Check if user is a member (clubs is stored as string[] in Firestore)
      if (orgData && userData?.clubs) {
        const clubIds = userData.clubs.map((c: any) => typeof c === 'string' ? c : c.id);
        setIsMember(clubIds.includes(orgId));
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      Alert.alert('Error', 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  const loadDiscussions = async () => {
    if (!organization) return;
    
    try {
      const allDiscussions = await DatabaseService.getDiscussions(
        { organizationId: organization.id },
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
    }
  };

  const loadMembers = async () => {
    if (!organization?.members || organization.members.length === 0) {
      setMembers([]);
      return;
    }

    setLoadingMembers(true);
    try {
      // Filter out invalid member IDs before fetching
      const validMemberIds = organization.members.filter(id => id && typeof id === 'string' && id.trim() !== '');
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOrganization(), loadMembers(), isMember ? loadDiscussions() : Promise.resolve()]);
    setRefreshing(false);
  };

  const handleToggleMembership = async () => {
    if (!user || !organization) return;

    setJoining(true);
    try {
      if (isMember) {
        // Leave organization
        await DatabaseService.leaveOrganization(organization.id, user.uid);
        setIsMember(false);
        setDiscussions([]); // Clear discussions when leaving
      } else {
        // Join organization
        await DatabaseService.joinOrganization(organization.id, user.uid);
        setIsMember(true);
        await loadDiscussions(); // Load discussions when joining
      }
      // Refresh user data to update clubs array
      if (refreshUserData) {
        await refreshUserData();
      }
    } catch (error: any) {
      console.error('Error toggling membership:', error);
      Alert.alert('Error', error.message || 'Failed to update membership');
    } finally {
      setJoining(false);
    }
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!organization) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={styles.loadingText}>Organization not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {organization.logo && organization.logo.trim() && !imageError ? (
        <ExpoImage
          source={{ uri: organization.logo.trim().replace(/\s+/g, '') }}
          style={styles.clubImage}
          contentFit="contain"
          onError={() => {
            console.error('Error loading organization logo:', organization.logo);
            setImageError(true);
          }}
        />
      ) : (
        <View style={styles.clubImagePlaceholder}>
          <Ionicons name="people" size={64} color={theme.colors.textSecondary} />
        </View>
      )}
      
      <View style={styles.header}>
        <View style={styles.nameAndMembersContainer}>
          <Text style={styles.clubName}>{organization.name}</Text>
          <Text style={styles.memberCount}>
            {organization.members?.length || 0} {organization.members?.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
        {user && (
          <TouchableOpacity
            style={[
              styles.memberBadge,
              isMember && styles.memberBadgeActive,
              joining && styles.memberBadgeDisabled,
            ]}
            onPress={handleToggleMembership}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color={isMember ? theme.colors.error : theme.colors.success} />
            ) : (
              <Ionicons 
                name={isMember ? "checkmark-circle" : "add-circle-outline"} 
                size={20} 
                color={isMember ? theme.colors.success : theme.colors.textSecondary} 
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {organization.description && (
        <Text style={styles.description}>{organization.description}</Text>
      )}
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discussions' && styles.tabActive]}
          onPress={() => {
            setActiveTab('discussions');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'discussions' && styles.tabTextActive]}>
            Discussions {isMember && `(${discussions.length})`}
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
        {activeTab === 'discussions' && (
          <View style={styles.tabContentInner}>
            {isMember ? (
              <>
                <TouchableOpacity
                  style={styles.addDiscussionButton}
                  onPress={() => navigation.navigate('CreateDiscussion', { organizationId: organization.id })}
                >
                  <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                  <Text style={styles.addDiscussionButtonText}>Start a Discussion</Text>
                </TouchableOpacity>
                {discussions.length > 0 ? (
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
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="lock-closed-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>Join to see discussions</Text>
                <Text style={styles.emptySubtext}>Join this organization to view and participate in discussions</Text>
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
      padding: 16,
      paddingBottom: 8,
    },
    content: {
      flexGrow: 1,
    },
    clubImage: {
      width: '100%',
      height: 200,
      borderRadius: 16,
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    clubImagePlaceholder: {
      width: '100%',
      height: 200,
      borderRadius: 16,
      marginBottom: 16,
      backgroundColor: theme.colors.border + '40',
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    nameAndMembersContainer: {
      flex: 1,
      marginRight: 12,
    },
    clubName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    memberCount: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    memberBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberBadgeActive: {
      backgroundColor: theme.colors.success + '20',
      borderColor: theme.colors.success,
    },
    memberBadgeDisabled: {
      opacity: 0.6,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 24,
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
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    backButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
    },
    backButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
