import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { MLService } from '../services/mlService';
import { Discussion, FollowRequest, User } from '../types';

export default function NotificationsScreen({ navigation }: any) {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [followExpanded, setFollowExpanded] = useState(true);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [requestUsers, setRequestUsers] = useState<Record<string, User>>({});
  const [activity, setActivity] = useState<Discussion[]>([]);
  const [activityLabels, setActivityLabels] = useState<Record<string, string>>({});
  const [loadingFollow, setLoadingFollow] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const loadFollowRequests = useCallback(async () => {
    if (!user?.uid) {
      setFollowRequests([]);
      setRequestUsers({});
      setLoadingFollow(false);
      return;
    }
    setLoadingFollow(true);
    try {
      const items = await DatabaseService.getIncomingFollowRequests(user.uid);
      setFollowRequests(items);
      const users: Record<string, User> = {};
      await Promise.all(
        items.map(async fr => {
          const u = await DatabaseService.getUser(fr.fromUserId);
          if (u) users[fr.fromUserId] = u;
        })
      );
      setRequestUsers(users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFollow(false);
    }
  }, [user?.uid]);

  const loadActivity = useCallback(async () => {
    if (!userData) {
      setActivity([]);
      setActivityLabels({});
      setLoadingActivity(false);
      return;
    }
    const universityId =
      userData.university == null
        ? ''
        : typeof userData.university === 'string'
          ? userData.university
          : userData.university.id;
    if (!universityId?.trim()) {
      setActivity([]);
      setActivityLabels({});
      setLoadingActivity(false);
      return;
    }

    setLoadingActivity(true);
    try {
      const courseIds = (userData.courses || []).map((c: any) => (typeof c === 'string' ? c : c.id));
      const orgIds = (userData.clubs || []).map((c: any) => (typeof c === 'string' ? c : c.id));
      if (courseIds.length === 0 && orgIds.length === 0) {
        setActivity([]);
        setActivityLabels({});
        return;
      }

      const all = await DatabaseService.getDiscussions({ universityId: universityId.trim() }, 'popularity', 200);
      const filtered = all.filter(d => {
        if (d.courseId && courseIds.includes(d.courseId)) return true;
        if (d.organizationId && orgIds.includes(d.organizationId)) return true;
        if (d.clubId && orgIds.includes(d.clubId)) return true;
        return false;
      });

      const ranked = filtered.map(d => {
        const rankingInput = {
          upvotes: d.upvotes.length,
          downvotes: d.downvotes.length,
          comments: d.comments.length,
          timeSinceCreation: Date.now() - d.createdAt.getTime(),
          userRanking: 0,
        };
        const ml = MLService.calculateRanking(rankingInput);
        return { ...d, score: ml.score };
      });
      ranked.sort((a, b) => b.score - a.score);
      const top = ranked.slice(0, 12);

      const labels: Record<string, string> = {};
      const courses = await DatabaseService.getCourses(universityId.trim());
      const orgs = await DatabaseService.getOrganizations();
      for (const d of top) {
        if (d.courseId) {
          const c = courses.find(x => x.id === d.courseId);
          labels[d.id] = c ? `Trending in ${c.code}` : 'Trending in your course';
        } else if (d.organizationId) {
          const o = orgs.find(x => x.id === d.organizationId);
          labels[d.id] = o ? `Trending in ${o.name}` : 'Trending in your organization';
        } else if (d.clubId) {
          const o = orgs.find(x => x.id === d.clubId);
          labels[d.id] = o ? `Trending in ${o.name}` : 'Trending in your club';
        } else {
          labels[d.id] = 'Trending discussion';
        }
      }

      setActivity(top);
      setActivityLabels(labels);
    } catch (e) {
      console.error(e);
      setActivity([]);
    } finally {
      setLoadingActivity(false);
    }
  }, [userData]);

  useFocusEffect(
    useCallback(() => {
      loadFollowRequests();
      loadActivity();
    }, [loadFollowRequests, loadActivity])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFollowRequests(), loadActivity()]);
    setRefreshing(false);
  };

  const onAcceptFollow = async (fr: FollowRequest) => {
    if (!user?.uid) return;
    setBusyRequestId(fr.id);
    try {
      await DatabaseService.acceptFollowRequest(fr.id, user.uid);
      await loadFollowRequests();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not accept request');
    } finally {
      setBusyRequestId(null);
    }
  };

  const onDeclineFollow = async (fr: FollowRequest) => {
    if (!user?.uid) return;
    setBusyRequestId(fr.id);
    try {
      await DatabaseService.declineFollowRequest(fr.id, user.uid);
      await loadFollowRequests();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not decline request');
    } finally {
      setBusyRequestId(null);
    }
  };

  const openDiscussionContext = (d: Discussion) => {
    const tabNav = navigation.getParent() || navigation;
    if (d.courseId) {
      tabNav.navigate('Course', {
        screen: 'CourseDetail',
        params: { courseId: d.courseId },
      });
    } else if (d.organizationId) {
      tabNav.navigate('Clubs', {
        screen: 'ClubDetail',
        params: { clubId: d.organizationId, organizationId: d.organizationId },
      });
    } else if (d.clubId) {
      tabNav.navigate('Clubs', {
        screen: 'ClubDetail',
        params: { clubId: d.clubId, organizationId: d.clubId },
      });
    } else {
      tabNav.navigate('Bulletin', { screen: 'BulletinMain' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setFollowExpanded(!followExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.collapsibleHeaderLeft}>
            <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.sectionHeading}>Follow requests</Text>
            {followRequests.length > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{followRequests.length}</Text>
              </View>
            ) : null}
          </View>
          <Ionicons
            name={followExpanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {followExpanded && (
          <View style={styles.followBlock}>
            {loadingFollow ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : followRequests.length === 0 ? (
              <Text style={styles.emptyHint}>No pending follow requests</Text>
            ) : (
              followRequests.map(fr => {
                const u = requestUsers[fr.fromUserId];
                const busy = busyRequestId === fr.id;
                return (
                  <View key={fr.id} style={styles.followRow}>
                    <View style={styles.followRowText}>
                      <Text style={styles.followName}>{u?.name || 'Someone'}</Text>
                      <Text style={styles.followSub}>wants to follow you</Text>
                    </View>
                    <View style={styles.followActions}>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.declineBtn]}
                        onPress={() => onDeclineFollow(fr)}
                        disabled={busy}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.acceptBtn]}
                        onPress={() => onAcceptFollow(fr)}
                        disabled={busy}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <Text style={styles.activitySectionTitle}>Discussion and activity</Text>
        <Text style={styles.activitySectionSubtitle}>
          Trending threads in your courses and organizations (by engagement).
        </Text>

        {loadingActivity ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
        ) : activity.length === 0 ? (
          <Text style={styles.emptyHint}>
            Join courses or organizations to see trending discussions here.
          </Text>
        ) : (
          activity.map(d => (
            <TouchableOpacity key={d.id} style={styles.activityCard} onPress={() => openDiscussionContext(d)}>
              <Text style={styles.activityLabel}>{activityLabels[d.id] || 'Trending'}</Text>
              <Text style={styles.activityTitle} numberOfLines={2}>
                {d.title}
              </Text>
              <Text style={styles.activityMeta}>
                {d.comments.length} {d.comments.length === 1 ? 'comment' : 'comments'} · {d.upvotes.length}{' '}
                upvotes
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    collapsibleHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionHeading: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
    },
    countPill: {
      backgroundColor: theme.colors.primary + '22',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    followBlock: {
      marginBottom: 8,
    },
    emptyHint: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    followRow: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followRowText: {
      marginBottom: 12,
    },
    followName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    followSub: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    followActions: {
      flexDirection: 'row',
      gap: 10,
    },
    smallBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
    },
    declineBtn: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    declineBtnText: {
      fontWeight: '600',
      color: theme.colors.text,
    },
    acceptBtn: {
      backgroundColor: theme.colors.primary,
    },
    acceptBtnText: {
      fontWeight: '600',
      color: '#fff',
    },
    activitySectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 20,
      marginBottom: 4,
    },
    activitySectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    activityCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activityLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 6,
    },
    activityTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 6,
    },
    activityMeta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
  });
