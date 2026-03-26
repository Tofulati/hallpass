import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/databaseService';
import { Discussion, DiscussionComment } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ImageService } from '../services/imageService';

type DisplayUser = {
  id: string;
  name: string;
  username?: string;
  profileImage?: string;
};

type FlattenedNode = {
  comment: DiscussionComment;
  depth: number;
  childCount: number;
  hiddenByAncestor: boolean;
};

function getInitials(name?: string) {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join('') || '?';
}

export default function DiscussionDetailScreen({ route, navigation }: any) {
  const { discussionId } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();

  const navigateToUserProfile = (userIdToNavigate?: string) => {
    if (!userIdToNavigate?.trim()) return;
    // Route through the `User` tab so `ProfileScreen` is always available.
    navigation
      ?.getParent?.()
      ?.navigate?.('User', { screen: 'Profile', params: { userId: userIdToNavigate } });
  };

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersById, setUsersById] = useState<Record<string, DisplayUser>>({});

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [composerText, setComposerText] = useState('');
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const [d, c] = await Promise.all([
          DatabaseService.getDiscussion(discussionId),
          DatabaseService.getDiscussionComments(discussionId),
        ]);
        if (!mounted) return;
        setDiscussion(d);
        setComments(c);
      } catch (e) {
        console.error('Failed to load discussion detail:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (!discussionId) {
      setLoading(false);
      return;
    }

    load();
    return () => {
      mounted = false;
    };
  }, [discussionId]);

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      try {
        const ids = new Set<string>();
        if (discussion?.userId) ids.add(discussion.userId);
        for (const c of comments) if (c.userId) ids.add(c.userId);
        if (ids.size === 0) return;

        // Only fetch missing ids
        const missing = [...ids].filter(id => usersById[id] == null);
        if (missing.length === 0) return;

        const results = await Promise.all(missing.map(id => DatabaseService.getUser(id)));
        if (!mounted) return;
        setUsersById(prev => {
          const next = { ...prev };
          for (let i = 0; i < missing.length; i++) {
            const u: any = results[i];
            if (!u) continue;
            next[missing[i]] = {
              id: u.id,
              name: u.name || 'Unknown',
              username: u.username,
              profileImage: u.profileImage,
            };
          }
          return next;
        });
      } catch (e) {
        console.error('Failed to load users for thread:', e);
      }
    };

    loadUsers();
    return () => {
      mounted = false;
    };
    // Intentionally omit usersById to avoid refetch loops; we diff against it inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussion?.userId, comments]);

  const { flat, byId } = useMemo(() => {
    const byIdLocal = new Map<string, DiscussionComment>();
    const children = new Map<string | null, DiscussionComment[]>();

    for (const c of comments) {
      byIdLocal.set(c.id, c);
      const parentKey = (c.parentId ?? null) as string | null;
      if (!children.has(parentKey)) children.set(parentKey, []);
      children.get(parentKey)!.push(c);
    }

    // Stable-ish ordering: oldest-first within each sibling group
    for (const [, arr] of children) {
      arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    const flatLocal: FlattenedNode[] = [];

    const dfs = (parentId: string | null, depth: number, hiddenByAncestor: boolean) => {
      const kids = children.get(parentId) || [];
      for (const child of kids) {
        const isCollapsed = collapsed.has(child.id);
        const childKids = children.get(child.id) || [];
        flatLocal.push({
          comment: child,
          depth,
          childCount: childKids.length,
          hiddenByAncestor,
        });
        const nextHidden = hiddenByAncestor || isCollapsed;
        dfs(child.id, depth + 1, nextHidden);
      }
    };

    dfs(null, 0, false);

    return { flat: flatLocal, byId: byIdLocal };
  }, [comments, collapsed]);

  const toggleCollapse = (commentId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const MAX_COMMENT_IMAGES = 5;

  const showImageOptionsForComment = () => {
    if (commentImages.length >= MAX_COMMENT_IMAGES) return;
    Alert.alert('Select Image', 'Choose an option', [
      { text: 'Camera', onPress: () => pickCommentImage('camera') },
      { text: 'Photo Library', onPress: () => pickCommentImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickCommentImage = async (source: 'camera' | 'library') => {
    if (commentImages.length >= MAX_COMMENT_IMAGES) return;
    try {
      setUploadingCommentImage(true);
      const picked =
        source === 'camera'
          ? await ImageService.takePhoto(true, 0.8)
          : await ImageService.pickImage(true, 0.8);
      if (!picked?.uri) return;

      const result = await ImageService.uploadImage(picked.uri, 'discussion-comments');
      setCommentImages(prev => (prev.length < MAX_COMMENT_IMAGES ? [...prev, result.url] : prev));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to upload image');
    } finally {
      setUploadingCommentImage(false);
    }
  };

  const handleVoteComment = async (comment: DiscussionComment, type: 'upvote' | 'downvote') => {
    if (!user) return;
    const currentUp = comment.upvotes.includes(user.uid);
    const currentDown = comment.downvotes.includes(user.uid);
    let voteType: 'upvote' | 'downvote' | 'remove' = type;
    if (type === 'upvote') voteType = currentUp ? 'remove' : 'upvote';
    if (type === 'downvote') voteType = currentDown ? 'remove' : 'downvote';

    // Optimistic update
    setComments(prev =>
      prev.map(c => {
        if (c.id !== comment.id) return c;
        const up = c.upvotes.filter(id => id !== user.uid);
        const down = c.downvotes.filter(id => id !== user.uid);
        if (voteType === 'upvote') up.push(user.uid);
        if (voteType === 'downvote') down.push(user.uid);
        return { ...c, upvotes: up, downvotes: down };
      })
    );

    try {
      await DatabaseService.voteDiscussionComment({
        discussionId,
        commentId: comment.id,
        userId: user.uid,
        voteType,
      });
    } catch (e) {
      console.error('Error voting on comment:', e);
      // Reload authoritative state on failure
      try {
        const c = await DatabaseService.getDiscussionComments(discussionId);
        setComments(c);
      } catch {}
    }
  };

  const submitComment = async () => {
    if (!user) {
      Alert.alert('Login required', 'Please log in to comment.');
      return;
    }
    const text = composerText.trim();
    // Allow image-only comments/replies.
    if (!text && commentImages.length === 0) return;

    setSubmitting(true);
    try {
      await DatabaseService.addDiscussionComment({
        discussionId,
        userId: user.uid,
        content: text,
        parentId: replyTo?.id ?? null,
        images: commentImages.length > 0 ? commentImages : undefined,
      });
      setComposerText('');
      setReplyTo(null);
      setCommentImages([]);
      const c = await DatabaseService.getDiscussionComments(discussionId);
      setComments(c);
      const d = await DatabaseService.getDiscussion(discussionId);
      setDiscussion(d);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = createStyles(theme);

  const renderDiscussionHeader = () => {
    if (!discussion) return null;
    const author = usersById[discussion.userId];
    return (
      <View style={styles.discussionCard}>
        <View style={styles.postHeaderRow}>
          <TouchableOpacity
            style={styles.authorClickableRow}
            onPress={() => navigateToUserProfile(discussion.userId)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrap}>
              {author?.profileImage ? (
                <Image source={{ uri: author.profileImage }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{getInitials(author?.name)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.authorName} numberOfLines={1}>
              {author?.name || 'Unknown'}
            </Text>
          </TouchableOpacity>
          <View style={styles.postHeaderText}>
            <Text style={styles.discussionMeta}>
              {formatDistanceToNow(discussion.createdAt, { addSuffix: true })} •{' '}
              {(discussion.commentCount ?? discussion.comments.length) || 0} comments
            </Text>
          </View>
        </View>
        <Text style={styles.discussionTitle}>{discussion.title}</Text>
        <Text style={styles.discussionContent}>{discussion.content}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: FlattenedNode }) => {
    const { comment, depth, childCount, hiddenByAncestor } = item;
    if (hiddenByAncestor) return null;

    const upCount = comment.upvotes.length;
    const downCount = comment.downvotes.length;
    const score = upCount - downCount;

    const isCollapsed = collapsed.has(comment.id);
    const indent = Math.min(depth, 12) * 14;

    const currentUp = user ? comment.upvotes.includes(user.uid) : false;
    const currentDown = user ? comment.downvotes.includes(user.uid) : false;

    const author = usersById[comment.userId];

    return (
      <View style={[styles.commentRow, { marginLeft: indent }]}>
        <View style={styles.threadGutter}>
          <View style={styles.threadLine} />
        </View>

        <View style={styles.commentBubble}>
          <View style={styles.commentHeaderRow}>
            <TouchableOpacity
              style={styles.authorClickableRow}
              onPress={() => navigateToUserProfile(comment.userId)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                {author?.profileImage ? (
                  <Image source={{ uri: author.profileImage }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{getInitials(author?.name)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.authorNameSmall} numberOfLines={1}>
                {author?.name || 'Unknown'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.commentTopRow}>
            <TouchableOpacity
              style={styles.collapseButton}
              onPress={() => (childCount > 0 ? toggleCollapse(comment.id) : undefined)}
              activeOpacity={childCount > 0 ? 0.7 : 1}
              disabled={childCount === 0}
            >
              {childCount > 0 ? (
                <Ionicons
                  name={isCollapsed ? 'add' : 'remove'}
                  size={16}
                  color={theme.colors.textSecondary}
                />
              ) : (
                <View style={{ width: 16, height: 16 }} />
              )}
            </TouchableOpacity>

            <Text style={styles.commentMeta}>
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
              {childCount > 0 ? ` • ${childCount} repl${childCount === 1 ? 'y' : 'ies'}` : ''}
            </Text>
          </View>

          <Text style={styles.commentText}>{comment.content}</Text>

          {comment.images && comment.images.length > 0 ? (
            <Image
              source={{ uri: comment.images[0] }}
              style={styles.commentImage}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.commentActions}>
            <View style={styles.votePill}>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  currentUp && { backgroundColor: theme.colors.upvote + '20' },
                ]}
                onPress={() => handleVoteComment(comment, 'upvote')}
              >
                <Text style={[styles.voteLetter, currentUp && { color: theme.colors.upvote }]}>
                  A
                </Text>
              </TouchableOpacity>
              <Text style={styles.voteScore}>{score}</Text>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  currentDown && { backgroundColor: theme.colors.downvote + '20' },
                ]}
                onPress={() => handleVoteComment(comment, 'downvote')}
              >
                <Text style={[styles.voteLetter, currentDown && { color: theme.colors.downvote }]}>
                  F
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.replyButton}
              onPress={() => setReplyTo(byId.get(comment.id) || comment)}
            >
              <Ionicons name="return-down-back-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.replyText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!discussionId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Missing discussion id.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discussion</Text>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          data={flat}
          keyExtractor={n => n.comment.id}
          renderItem={renderItem}
          ListHeaderComponent={renderDiscussionHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No comments yet. Be the first to reply.</Text>
            </View>
          }
        />

        <View style={styles.composer}>
          {replyTo ? (
            <View style={styles.replyingToRow}>
              <Text style={styles.replyingToText} numberOfLines={1}>
                Replying…
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyingToClose}>
                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          {commentImages.length > 0 ? (
            <View style={styles.imageStrip}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageStripInner}
              >
                {commentImages.map((url, idx) => (
                  <View key={url + idx} style={styles.thumbWrap}>
                    <Image source={{ uri: url }} style={styles.thumbImg} />
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => setCommentImages(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close" size={14} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={showImageOptionsForComment}
              disabled={uploadingCommentImage || commentImages.length >= MAX_COMMENT_IMAGES}
            >
              {uploadingCommentImage ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="image-outline" size={26} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'}
              placeholderTextColor={theme.colors.textSecondary}
              value={composerText}
              onChangeText={setComposerText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (submitting || (composerText.trim().length === 0 && commentImages.length === 0)) &&
                  styles.sendBtnDisabled,
              ]}
              onPress={submitComment}
              disabled={submitting || (composerText.trim().length === 0 && commentImages.length === 0)}
            >
              <Ionicons
                name="send"
                size={20}
                color={
                  (composerText.trim().length > 0 || commentImages.length > 0) && !submitting
                    ? '#FFFFFF'
                    : theme.colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    headerIconBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 14,
      paddingBottom: 120,
    },
    discussionCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      marginBottom: 10,
    },
    postHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    postHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    authorClickableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    authorName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2,
    },
    discussionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 6,
    },
    discussionMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    discussionContent: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.text,
    },
    emptyContainer: {
      paddingVertical: 22,
      alignItems: 'center',
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginBottom: 10,
    },
    authorNameSmall: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      flex: 1,
      maxWidth: 88,
      textAlign: 'left',
    },
    commentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    threadGutter: {
      width: 12,
      alignItems: 'center',
    },
    threadLine: {
      flex: 1,
      width: 2,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
    },
    commentBubble: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      padding: 12,
    },
    avatarWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      overflow: 'hidden',
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    avatarFallback: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary + '25',
    },
    avatarFallbackText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    commentTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    collapseButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    commentMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.text,
      marginBottom: 10,
    },
    commentImage: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 10,
      backgroundColor: theme.colors.border,
    },
    commentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    votePill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 999,
      overflow: 'hidden',
    },
    voteBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    voteLetter: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.textSecondary,
    },
    voteScore: {
      paddingHorizontal: 10,
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    replyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    replyText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    composer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    replyingToRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    replyingToText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      flex: 1,
    },
    replyingToClose: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageStrip: {
      marginBottom: 8,
    },
    imageStripInner: {
      alignItems: 'center',
      gap: 10,
    },
    thumbWrap: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: theme.colors.border,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    thumbImg: {
      width: 56,
      height: 56,
    },
    thumbRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      elevation: 2,
    },
    composerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 0,
    },
    attachBtn: {
      paddingBottom: 10,
      paddingRight: 8,
      justifyContent: 'center',
      minWidth: 36,
      alignItems: 'center',
    },
    composerInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      fontSize: 16,
      marginRight: 8,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    sendBtnDisabled: {
      backgroundColor: theme.colors.border,
    },
  });

