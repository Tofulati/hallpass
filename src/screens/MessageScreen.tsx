import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Conversation, MessageRequest, User } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';

function conversationTitle(conv: Conversation, myId: string, profiles: Record<string, User>): string {
  if (conv.title) return conv.title;
  const others = conv.participants.filter(p => p !== myId);
  if (others.length === 0) return 'Chat';
  if (others.length === 1) {
    return profiles[others[0]]?.name || 'Chat';
  }
  return others
    .map(id => profiles[id]?.name || '…')
    .join(', ')
    .slice(0, 42);
}

function isUnread(conv: Conversation, myId: string): boolean {
  const lm = conv.lastMessage;
  if (!lm || lm.senderId === myId) return false;
  const t = lm.createdAt instanceof Date ? lm.createdAt.getTime() : new Date(lm.createdAt as any).getTime();
  const readAt = conv.lastReadAt?.[myId]?.getTime?.() ?? 0;
  return t > readAt;
}

export default function MessageScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [requestsCollapsed, setRequestsCollapsed] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, User>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  useEffect(() => {
    if (!user?.uid) return;
    const unsubConv = DatabaseService.subscribeToConversations(user.uid, setConversations);
    const unsubReq = DatabaseService.subscribeToIncomingMessageRequests(user.uid, setRequests);
    return () => {
      unsubConv();
      unsubReq();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const ids = new Set<string>();
    conversations.forEach(c => {
      if (c.hiddenFor?.includes(user.uid)) return;
      c.participants.forEach(p => {
        if (p !== user.uid) ids.add(p);
      });
    });
    requests.forEach(r => ids.add(r.fromUserId));

    let cancelled = false;
    (async () => {
      const prev = profilesRef.current;
      const toFetch = [...ids].filter(id => !prev[id]);
      if (toFetch.length === 0) return;
      const batch: Record<string, User> = {};
      for (const id of toFetch) {
        const u = await DatabaseService.getUser(id);
        if (cancelled || !u) continue;
        batch[id] = u;
      }
      if (!cancelled && Object.keys(batch).length > 0) {
        setProfiles(p => ({ ...p, ...batch }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, requests, user?.uid]);

  const visibleConversations = useMemo(() => {
    if (!user?.uid) return [];
    return conversations.filter(c => !c.hiddenFor?.includes(user.uid));
  }, [conversations, user?.uid]);

  const filteredConversations = useMemo(() => {
    let list = visibleConversations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(conv => {
        const title = conversationTitle(conv, user!.uid, profiles).toLowerCase();
        const preview = conv.lastMessage?.content?.toLowerCase() || '';
        return title.includes(q) || preview.includes(q);
      });
    }
    return list;
  }, [visibleConversations, searchQuery, user?.uid, profiles]);

  const openNewMessage = () => navigation.navigate('NewMessage');

  const confirmHide = (conv: Conversation) => {
    if (!user?.uid) return;
    Alert.alert('Delete chat', 'This conversation will be hidden for you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => DatabaseService.hideConversationForUser(conv.id, user.uid),
      },
    ]);
  };

  const toggleMute = useCallback(async (conv: Conversation) => {
    if (!user?.uid) return;
    const muted = conv.mutedBy?.includes(user.uid);
    await DatabaseService.setConversationMuted(conv.id, user.uid, !muted);
  }, [user?.uid]);

  const openChat = (item: Conversation) => {
    if (!user?.uid) return;
    const others = item.participants.filter(p => p !== user.uid);
    navigation.navigate('Chat', {
      conversationId: item.id,
      title: conversationTitle(item, user.uid, profiles),
      otherUserId: !item.isGroup && others.length === 1 ? others[0] : undefined,
      isGroup: !!item.isGroup || others.length > 1,
    });
  };

  const openRequestThread = (req: MessageRequest) => {
    const from = profiles[req.fromUserId];
    navigation.navigate('Chat', {
      messageRequestId: req.id,
      title: from?.name || 'Message request',
      otherUserId: req.fromUserId,
      isMessageRequest: true,
      incomingRequest: true,
      isGroup: false,
    });
  };

  const acceptReq = async (req: MessageRequest) => {
    try {
      const convId = await DatabaseService.acceptMessageRequest(req.id);
      const from = profiles[req.fromUserId];
      navigation.navigate('Chat', {
        conversationId: convId,
        title: from?.name || 'Chat',
        otherUserId: req.fromUserId,
        isGroup: false,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not accept');
    }
  };

  const confirmDeleteRequest = (req: MessageRequest) => {
    Alert.alert('Delete request', 'Remove this conversation from message requests?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => DatabaseService.deleteMessageRequest(req.id).catch(console.error),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.newMessageButton} onPress={openNewMessage}>
          <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {requests.length > 0 && (
        <View style={styles.requestsSection}>
          <TouchableOpacity
            style={styles.requestsHeaderRow}
            onPress={() => setRequestsCollapsed(v => !v)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.requestsHeading}>Message requests</Text>
              <View style={styles.requestsCountPill}>
                <Text style={styles.requestsCountText}>{requests.length}</Text>
              </View>
            </View>
            <Ionicons
              name={requestsCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          {!requestsCollapsed &&
            requests.map(req => {
              const from = profiles[req.fromUserId];
              const preview = req.lastMessage?.content || 'Tap to view';
              return (
                <View key={req.id} style={styles.requestRow}>
                  <TouchableOpacity
                    style={styles.requestMain}
                    onPress={() => openRequestThread(req)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatarContainer}>
                      {from?.profileImage ? (
                        <Image source={{ uri: from.profileImage }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons
                          name="person-circle"
                          size={48}
                          color={theme.colors.textSecondary}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.conversationName}>{from?.name || 'Someone'}</Text>
                      <Text style={styles.requestPreview} numberOfLines={2}>
                        {preview}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => acceptReq(req)} style={styles.reqAccept}>
                    <Text style={styles.reqAcceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeleteRequest(req)}
                    style={styles.reqDecline}
                  >
                    <Ionicons name="trash-outline" size={22} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>
      )}

      {visibleConversations.length === 0 && requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Tap the compose button to start a chat.</Text>
        </View>
      ) : visibleConversations.length > 0 && filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={56} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No results</Text>
          <Text style={styles.emptySubtext}>Try a different search.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            if (!user?.uid) return null;
            const title = conversationTitle(item, user.uid, profiles);
            const mutedRow = item.mutedBy?.includes(user.uid);
            const otherIds = item.participants.filter(p => p !== user.uid);
            const avatarId = otherIds[0];
            const prof = profiles[avatarId];
            return (
              <Swipeable
                overshootRight={false}
                renderRightActions={() => (
                  <View style={styles.swipeActions}>
                    <TouchableOpacity
                      style={[styles.swipeBtn, styles.swipeMute]}
                      onPress={() => toggleMute(item)}
                    >
                      <Ionicons
                        name={mutedRow ? 'volume-high' : 'volume-mute'}
                        size={22}
                        color="#fff"
                      />
                      <Text style={styles.swipeBtnText}>{mutedRow ? 'Unmute' : 'Mute'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.swipeBtn, styles.swipeDel]}
                      onPress={() => confirmHide(item)}
                    >
                      <Ionicons name="trash-outline" size={22} color="#fff" />
                      <Text style={styles.swipeBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              >
                <TouchableOpacity style={styles.conversationCard} onPress={() => openChat(item)}>
                  <View style={styles.avatarContainer}>
                    {prof?.profileImage ? (
                      <Image source={{ uri: prof.profileImage }} style={styles.avatarImg} />
                    ) : (
                      <Ionicons name="person-circle" size={50} color={theme.colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={styles.conversationName} numberOfLines={1}>
                          {title}
                        </Text>
                        {mutedRow && (
                          <Ionicons
                            name="volume-mute"
                            size={16}
                            color={theme.colors.textSecondary}
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </View>
                      {item.lastMessage && (
                        <Text style={styles.conversationTime}>
                          {formatDistanceToNow(item.lastMessage.createdAt, { addSuffix: true })}
                        </Text>
                      )}
                    </View>
                    {item.lastMessage && (
                      <Text style={styles.conversationPreview} numberOfLines={2}>
                        {item.lastMessage.senderId === user.uid ? 'You: ' : ''}
                        {item.lastMessage.content}
                      </Text>
                    )}
                  </View>
                  {isUnread(item, user.uid) && <View style={styles.unreadBadge} />}
                </TouchableOpacity>
              </Swipeable>
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          extraData={profiles}
        />
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
      marginTop: 8,
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
    newMessageButton: {
      padding: 4,
      marginLeft: 8,
    },
    requestsSection: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    requestsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    requestsHeading: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    requestsCountPill: {
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.colors.border,
    },
    requestsCountText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      paddingVertical: 8,
      paddingLeft: 10,
      paddingRight: 4,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    requestMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    requestPreview: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    reqAccept: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 4,
    },
    reqAcceptText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    reqDecline: { padding: 8 },
    listContent: {
      paddingHorizontal: 16,
    },
    conversationCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    avatarContainer: {
      marginRight: 12,
    },
    avatarImg: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    conversationContent: {
      flex: 1,
    },
    conversationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    conversationName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    conversationTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    conversationPreview: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    unreadBadge: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      marginLeft: 8,
    },
    swipeActions: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    swipeBtn: {
      width: 88,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      marginLeft: 8,
    },
    swipeMute: {
      backgroundColor: theme.colors.textSecondary,
    },
    swipeDel: {
      backgroundColor: '#c0392b',
    },
    swipeBtnText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
  });
