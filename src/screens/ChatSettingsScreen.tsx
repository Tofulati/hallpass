import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { ImageService } from '../services/imageService';
import { Conversation, Message, User } from '../types';

type ChatSettingsRouteParams = {
  conversationId: string;
};

type HistoryTab = 'images' | 'links';

function extractLinks(text: string): string[] {
  const urls: string[] = [];
  if (!text) return urls;

  // Keep it simple: supports https://... and bare www....
  const regex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const matches = text.match(regex) || [];
  for (const raw of matches) {
    // Trim common trailing punctuation.
    const cleaned = raw.replace(/[)\],.!?]+$/g, '');
    if (!cleaned) continue;
    const normalized =
      cleaned.startsWith('http://') || cleaned.startsWith('https://') ? cleaned : `https://${cleaned}`;
    urls.push(normalized);
  }

  return urls;
}

function autoConversationTitle(conv: Conversation, myId: string, profiles: Record<string, User>): string {
  if (conv.title && conv.title.trim()) return conv.title.trim();
  const others = (conv.participants || []).filter(p => p !== myId);
  if (others.length === 0) return 'Chat';
  if (others.length === 1) return profiles[others[0]]?.name || 'Chat';
  const names = others.map(id => profiles[id]?.name || '…');
  const shown = names.slice(0, 3);
  const remaining = names.length - shown.length;
  return remaining > 0 ? `${shown.join(', ')} +${remaining}` : shown.join(', ');
}

export default function ChatSettingsScreen({ route, navigation }: any) {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { conversationId } = route.params as ChatSettingsRouteParams;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);

  const [nameDraft, setNameDraft] = useState('');
  const [editNameMode, setEditNameMode] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  const [uploadingIcon, setUploadingIcon] = useState(false);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('images');
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);

  const myId = user?.uid || '';
  const isMuted = !!conversation?.mutedBy?.includes(myId);

  const loadConversation = useCallback(async () => {
    if (!myId) return;
    setLoading(true);
    try {
      const c = await DatabaseService.getConversation(conversationId);
      setConversation(c);
      setNameDraft(c?.title || '');
      setEditNameMode(false);

      const ids = c?.participants || [];
      const batch: Record<string, User> = {};
      for (const id of ids) {
        const u = await DatabaseService.getUser(id);
        if (u) batch[id] = u;
      }
      setParticipantProfiles(batch);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load chat');
    } finally {
      setLoading(false);
    }
  }, [conversationId, myId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Chat Info' });
  }, [navigation]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Refresh when returning from "Add people".
  useEffect(() => {
    const unsub = navigation.addListener?.('focus', loadConversation);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [navigation, loadConversation]);

  useEffect(() => {
    const unsub = DatabaseService.subscribeToMessages(conversationId, setMessages);
    return () => unsub();
  }, [conversationId]);

  const uniqueImages = useMemo(() => {
    const set = new Set<string>();
    const list: string[] = [];
    const max = 60;
    for (const m of messages) {
      const imgs = m.images || [];
      for (const uri of imgs) {
        if (!uri) continue;
        if (set.has(uri)) continue;
        set.add(uri);
        list.push(uri);
        if (list.length >= max) return list;
      }
    }
    return list;
  }, [messages]);

  const uniqueLinks = useMemo(() => {
    const set = new Set<string>();
    const list: string[] = [];
    const max = 60;
    for (const m of messages) {
      const content = m.content || '';
      const links = extractLinks(content);
      for (const link of links) {
        if (!link) continue;
        if (set.has(link)) continue;
        set.add(link);
        list.push(link);
        if (list.length >= max) return list;
      }
    }
    return list;
  }, [messages]);

  const filteredImages = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return uniqueImages;
    return uniqueImages.filter(uri => uri.toLowerCase().includes(q));
  }, [historySearchQuery, uniqueImages]);

  const filteredLinks = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return uniqueLinks;
    return uniqueLinks.filter(l => l.toLowerCase().includes(q));
  }, [historySearchQuery, uniqueLinks]);

  const displayTitle = useMemo(() => {
    if (!conversation) return 'Chat';
    return autoConversationTitle(conversation, myId, participantProfiles);
  }, [conversation, myId, participantProfiles]);

  const updateName = async () => {
    if (!myId) return;
    if (updatingName) return;
    const next = (nameDraft || '').trim();
    if (next.length > 80) {
      Alert.alert('Too long', 'Chat name can be up to 80 characters.');
      return;
    }

    setUpdatingName(true);
    try {
      await DatabaseService.setConversationTitle(conversationId, myId, next);
      await loadConversation();
      Alert.alert('Updated', 'Chat name updated.');
      setEditNameMode(false);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Try again');
    } finally {
      setUpdatingName(false);
    }
  };

  const pickAndUploadIcon = async () => {
    if (!myId) return;
    if (uploadingIcon) return;
    setUploadingIcon(true);
    try {
      const asset = await ImageService.pickImage(true, 0.85);
      if (!asset?.uri) return;

      const { url } = await ImageService.uploadImage(asset.uri, `conversations/${conversationId}/icon`);
      await DatabaseService.setConversationIconImage(conversationId, myId, url);
      await loadConversation();
      setOptionsOpen(false);
    } catch (e: any) {
      Alert.alert('Image', e?.message || 'Could not upload icon');
    } finally {
      setUploadingIcon(false);
    }
  };

  const [muting, setMuting] = useState(false);
  const toggleMute = async () => {
    if (!myId || !conversation) return;
    if (muting) return;
    setMuting(true);
    try {
      await DatabaseService.setConversationMuted(conversationId, myId, !isMuted);
      await loadConversation();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Try again');
    } finally {
      setMuting(false);
    }
  };

  const kickUser = async (userIdToKick: string) => {
    if (!myId) return;
    const ids = conversation?.participants || [];
    const willDelete = ids.length <= 2; // kicking last other participant deletes the chat

    Alert.alert(
      'Kick from chat',
      willDelete ? 'This will delete the chat.' : 'The user will no longer be able to access this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.kickParticipantFromConversation(conversationId, myId, userIdToKick);
              if (willDelete) navigation.navigate('MessageMain');
              else await loadConversation();
            } catch (e: any) {
              Alert.alert('Could not kick', e?.message || 'Try again');
            }
          },
        },
      ]
    );
  };

  const deleteChat = async () => {
    if (!myId) return;
    Alert.alert(
      'Delete chat',
      'This removes the chat for everyone in this conversation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteConversation(conversationId, myId);
              navigation.navigate('MessageMain');
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message || 'Try again');
            }
          },
        },
      ]
    );
  };

  const openUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Link', 'Cannot open this link.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link', 'Could not open link.');
    }
  };

  const participants = conversation?.participants || [];
  const kickableParticipants = participants.filter(id => id !== myId);
  const showKickButtons = kickableParticipants.length > 1;
  const myFollowing = userData?.following || [];
  const isFollowingAnyParticipant = kickableParticipants.some(id => myFollowing.includes(id));

  const [followingSubmitting, setFollowingSubmitting] = useState(false);

  const followNonFollowingParticipants = async () => {
    if (!myId) return;
    if (followingSubmitting) return;
    const targets = kickableParticipants.filter(id => !myFollowing.includes(id));
    if (targets.length === 0) return;

    setFollowingSubmitting(true);
    try {
      await Promise.all(
        targets.map(otherId => DatabaseService.createOrEnsurePendingFollowRequest(myId, otherId))
      );
      Alert.alert('Follow request sent', 'Your follow request(s) are pending.');
      await loadConversation();
    } catch (e: any) {
      Alert.alert('Could not follow', e?.message || 'Try again');
    } finally {
      setFollowingSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : !conversation ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Chat not found</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollPad}>
            {/* Instagram-like header */}
            <View style={styles.header}>
              {conversation.iconImage ? (
                <Image source={{ uri: conversation.iconImage }} style={styles.chatIcon} />
              ) : (
                <View style={[styles.chatIcon, styles.chatIconPlaceholder]}>
                  <Ionicons name="person-circle-outline" size={52} color={theme.colors.textSecondary} />
                </View>
              )}

              <View style={styles.nameBlock}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {displayTitle}
                </Text>

                {editNameMode ? (
                  <View style={styles.renameRow}>
                    <TextInput
                      style={styles.renameInput}
                      value={nameDraft}
                      onChangeText={setNameDraft}
                      autoCorrect={false}
                      placeholder="Chat name"
                      placeholderTextColor={theme.colors.textSecondary}
                      maxLength={80}
                    />
                    <TouchableOpacity
                      style={[styles.primaryBtn, updatingName && styles.btnDisabled]}
                      onPress={updateName}
                      disabled={updatingName}
                    >
                      <View style={styles.primaryBtnInner}>
                        {updatingName ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                            <Text style={styles.primaryBtnText}>Save</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryMiniBtn}
                      onPress={() => {
                        setEditNameMode(false);
                        setNameDraft(conversation.title || '');
                      }}
                    >
                      <Text style={styles.secondaryMiniBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.changeNameBtn}
                    onPress={() => {
                      setEditNameMode(true);
                      setNameDraft(conversation.title || '');
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.changeNameBtnText}>Change name</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action buttons row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('AddChatParticipants', { conversationId })}
              >
                <Ionicons name="person-add-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Add user</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, historySearchOpen && styles.actionBtnActive]}
                onPress={() => setHistorySearchOpen(v => !v)}
              >
                <Ionicons name="search-outline" size={18} color={historySearchOpen ? theme.colors.text : theme.colors.primary} />
                <Text style={[styles.actionBtnText, historySearchOpen ? { color: theme.colors.text } : { color: theme.colors.primary }]}>
                  Search
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
                onPress={toggleMute}
                disabled={muting}
              >
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={18}
                  color={isMuted ? theme.colors.primary : theme.colors.primary}
                />
                <Text style={[styles.actionBtnText]}>Mute</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, optionsOpen && styles.actionBtnActive]}
                onPress={() => setOptionsOpen(v => !v)}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.primary} />
                <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Options</Text>
              </TouchableOpacity>
            </View>

            {historySearchOpen && (
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={`Search ${historyTab === 'images' ? 'images' : 'links'}...`}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={historySearchQuery}
                  onChangeText={setHistorySearchQuery}
                  autoCorrect={false}
                />
                {historySearchQuery.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => setHistorySearchQuery('')}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Options expansion */}
            {optionsOpen && (
              <View style={styles.optionsSection}>
                <Text style={styles.sectionTitle}>More</Text>

                {!isFollowingAnyParticipant && kickableParticipants.length > 0 ? (
                  <TouchableOpacity
                    style={[styles.followTextBtn]}
                    onPress={followNonFollowingParticipants}
                    disabled={followingSubmitting}
                  >
                    <Ionicons name="person-add-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.followTextBtnText]}>
                      {followingSubmitting ? 'Sending...' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.secondaryBtn, uploadingIcon && styles.btnDisabled]}
                  onPress={pickAndUploadIcon}
                  disabled={uploadingIcon}
                >
                  <Ionicons name="image-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.secondaryBtnText}>Change icon image</Text>
                </TouchableOpacity>

                <View style={styles.hr} />

                <Text style={styles.subTitle}>People</Text>
                {kickableParticipants.length === 0 ? (
                  <Text style={styles.mutedText}>No other participants.</Text>
                ) : (
                  <FlatList
                    data={kickableParticipants}
                    keyExtractor={id => id}
                    scrollEnabled={false}
                    renderItem={({ item }) => {
                      const u = participantProfiles[item];
                      return (
                        <View style={styles.kickRow}>
                          <TouchableOpacity
                            style={styles.kickLeft}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('Profile', { userId: item })}
                          >
                            {u?.profileImage ? (
                              <Image source={{ uri: u.profileImage }} style={styles.kickAvatar} />
                            ) : (
                              <View style={[styles.kickAvatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={16} color={theme.colors.textSecondary} />
                              </View>
                            )}
                            <Text style={styles.kickName} numberOfLines={1}>
                              {u?.name || 'Member'}
                            </Text>
                          </TouchableOpacity>

                          {showKickButtons ? (
                            <TouchableOpacity style={styles.kickBtn} onPress={() => kickUser(item)}>
                              <Ionicons name="person-remove-outline" size={18} color={theme.colors.error} />
                              <Text style={styles.kickBtnText}>Kick</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    }}
                  />
                )}

                <TouchableOpacity style={styles.dangerBtn} onPress={deleteChat}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.dangerBtnText}>Delete chat</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Two tabs side by side */}
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, historyTab === 'images' && styles.segmentBtnActive]}
                onPress={() => setHistoryTab('images')}
              >
                <Ionicons name="image-outline" size={18} color={historyTab === 'images' ? theme.colors.primary : theme.colors.textSecondary} />
                <Text style={[styles.segmentText, historyTab === 'images' && { color: theme.colors.primary }]}>
                  Images ({filteredImages.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, historyTab === 'links' && styles.segmentBtnActive]}
                onPress={() => setHistoryTab('links')}
              >
                <Ionicons name="link-outline" size={18} color={historyTab === 'links' ? theme.colors.primary : theme.colors.textSecondary} />
                <Text style={[styles.segmentText, historyTab === 'links' && { color: theme.colors.primary }]}>
                  Links ({filteredLinks.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* History content */}
            {historyTab === 'images' ? (
              filteredImages.length === 0 ? (
                <View style={styles.emptyHistoryWrap}>
                  <Ionicons name="image-outline" size={40} color={theme.colors.textSecondary} />
                  <Text style={styles.emptyHistoryText}>No images found.</Text>
                </View>
              ) : (
                <View style={styles.imageGrid}>
                  {filteredImages.map(uri => (
                    <TouchableOpacity key={uri} style={styles.imageThumbWrap} onPress={() => openUrl(uri)}>
                      <Image source={{ uri }} style={styles.imageThumb} />
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : filteredLinks.length === 0 ? (
              <View style={styles.emptyHistoryWrap}>
                <Ionicons name="link-outline" size={40} color={theme.colors.textSecondary} />
                <Text style={styles.emptyHistoryText}>No links found.</Text>
              </View>
            ) : (
              <View style={{ gap: 10, paddingTop: 4 }}>
                {filteredLinks.map(link => (
                  <TouchableOpacity
                    key={link}
                    onPress={() => openUrl(link)}
                    style={styles.linkRow}
                  >
                    <Ionicons name="link-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.linkText} numberOfLines={1}>
                      {link.replace(/^https?:\/\//, '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 12, textAlign: 'center' },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      minHeight: 42,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 14,
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    primaryBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    btnDisabled: { opacity: 0.6 },

    scrollPad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },

    header: { alignItems: 'center' },
    chatIcon: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
    chatIconPlaceholder: { alignItems: 'center', justifyContent: 'center' },

    nameBlock: { marginTop: 12, width: '100%', alignItems: 'center' },
    chatName: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 8, textAlign: 'center' },

    changeNameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    changeNameBtnText: { fontWeight: '900', color: theme.colors.primary },

    renameRow: { width: '100%', gap: 10, paddingHorizontal: 2, alignItems: 'center' },
    renameInput: {
      width: '100%',
      height: 44,
      backgroundColor: theme.colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      color: theme.colors.text,
      fontSize: 15,
    },

    secondaryMiniBtn: {
      alignSelf: 'flex-end',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    secondaryMiniBtnText: { fontWeight: '900', color: theme.colors.textSecondary, fontSize: 13 },

    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 12,
      marginBottom: 10,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    actionBtnText: { fontWeight: '900', fontSize: 12, marginTop: 4, color: theme.colors.primary },
    actionBtnActive: { opacity: 0.85 },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, color: theme.colors.text, fontSize: 15 },
    clearBtn: { padding: 6, borderRadius: 10, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },

    optionsSection: {
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 12,
    },
    sectionTitle: { fontWeight: '900', color: theme.colors.text, fontSize: 15, marginBottom: 12 },
    subTitle: { fontWeight: '900', color: theme.colors.text, fontSize: 13, marginTop: 6, marginBottom: 10 },
    mutedText: { color: theme.colors.textSecondary, fontWeight: '700' },
    hr: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },

    followTextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
      marginBottom: 10,
    },
    followTextBtnText: { fontWeight: '900', color: theme.colors.primary, fontSize: 14 },

    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    secondaryBtnText: { color: theme.colors.primary, fontWeight: '900', fontSize: 14 },

    kickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingVertical: 10,
      gap: 12,
    },
    kickLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    kickAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    kickName: { flex: 1, fontWeight: '900', color: theme.colors.text, fontSize: 14, maxWidth: 200 },
    kickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
    kickBtnText: { color: theme.colors.error, fontWeight: '900', fontSize: 13 },

    dangerBtn: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.colors.error,
      borderRadius: 14,
      paddingVertical: 12,
    },
    dangerBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    segmentRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
      marginBottom: 12,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    segmentBtnActive: { borderColor: theme.colors.primary },
    segmentText: { fontWeight: '900', fontSize: 14, color: theme.colors.textSecondary },

    emptyHistoryWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 26 },
    emptyHistoryText: { color: theme.colors.textSecondary, fontWeight: '900', marginTop: 10 },

    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    imageThumbWrap: { width: '30%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
    imageThumb: { width: '100%', height: '100%' },

    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.background,
    },
    linkText: { flex: 1, color: theme.colors.text, fontWeight: '900', fontSize: 14 },
  });

