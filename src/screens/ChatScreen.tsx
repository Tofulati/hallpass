import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { ImageService } from '../services/imageService';
import { Message, User } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';

type ChatRouteParams = {
  conversationId?: string;
  messageRequestId?: string;
  title?: string;
  otherUserId?: string;
  isGroup?: boolean;
  isMessageRequest?: boolean;
  incomingRequest?: boolean;
};

export default function ChatScreen({ route, navigation }: any) {
  const params = route.params as ChatRouteParams;
  const {
    conversationId,
    messageRequestId,
    title: titleParam,
    otherUserId: otherParam,
    isGroup: isGroupParam,
    isMessageRequest,
    incomingRequest,
  } = params;

  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [headerTitle, setHeaderTitle] = useState(titleParam || 'Chat');
  const [isGroup, setIsGroup] = useState(!!isGroupParam);
  const [otherUserId, setOtherUserId] = useState(otherParam || '');
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, User>>({});
  const flatListRef = useRef<FlatList>(null);

  const isRequestThread = !!messageRequestId;
  const readOnlyRequest = isRequestThread && !!incomingRequest;

  useEffect(() => {
    if (!user?.uid) return;
    if (messageRequestId) {
      const unsub = DatabaseService.subscribeToRequestMessages(messageRequestId, setMessages);
      return unsub;
    }
    if (!conversationId) return;
    const unsub = DatabaseService.subscribeToMessages(conversationId, list => {
      setMessages(list);
      DatabaseService.markConversationRead(conversationId, user.uid);
    });
    return unsub;
  }, [conversationId, messageRequestId, user?.uid]);

  useEffect(() => {
    if (messageRequestId || !conversationId) return;
    let cancelled = false;
    (async () => {
      const c = await DatabaseService.getConversation(conversationId);
      if (cancelled || !c) return;
      setIsGroup(!!c.isGroup || c.participants.length > 2);
      const others = c.participants.filter(p => p !== user?.uid);
      if (!otherParam && others.length === 1) {
        setOtherUserId(others[0]);
        const u = await DatabaseService.getUser(others[0]);
        if (!cancelled && u) setHeaderTitle(u.name);
      } else if (c.title) {
        setHeaderTitle(c.title);
      } else if (others.length > 0) {
        const names = await Promise.all(
          others.map(async id => {
            const u = await DatabaseService.getUser(id);
            return u?.name || '…';
          })
        );
        const shown = names.slice(0, 3);
        const remaining = names.length - shown.length;
        const title = remaining > 0 ? `${shown.join(', ')} +${remaining}` : shown.join(', ');
        if (!cancelled) setHeaderTitle(title);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, messageRequestId, user?.uid, otherParam]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      messages.forEach(m => {
        if (m.senderId) ids.add(m.senderId);
      });
      if (conversationId) {
        const c = await DatabaseService.getConversation(conversationId);
        (c?.participants || []).forEach(id => ids.add(id));
      } else if (otherUserId) {
        ids.add(otherUserId);
      }

      const missing = [...ids].filter(id => id && !participantProfiles[id]);
      if (missing.length === 0) return;
      const batch: Record<string, User> = {};
      for (const id of missing) {
        const u = await DatabaseService.getUser(id);
        if (u) batch[id] = u;
      }
      if (!cancelled && Object.keys(batch).length > 0) {
        setParticipantProfiles(prev => ({ ...prev, ...batch }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, conversationId, otherUserId, user?.uid, participantProfiles]);

  useLayoutEffect(() => {
    if (isRequestThread) {
      navigation.setOptions({
        title: headerTitle,
        headerRight: () =>
          incomingRequest ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Delete request', 'Remove this message request?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await DatabaseService.deleteMessageRequest(messageRequestId!);
                          navigation.goBack();
                        } catch (e: any) {
                          Alert.alert('Error', e?.message || 'Could not delete');
                        }
                      },
                    },
                  ]);
                }}
                style={{ paddingHorizontal: 10 }}
              >
                <Ionicons name="trash-outline" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const convId = await DatabaseService.acceptMessageRequest(messageRequestId!);
                    const from = otherUserId
                      ? await DatabaseService.getUser(otherUserId)
                      : null;
                    navigation.replace('Chat', {
                      conversationId: convId,
                      title: from?.name || headerTitle,
                      otherUserId: otherUserId || undefined,
                      isGroup: false,
                    });
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Could not accept');
                  }
                }}
                style={{ paddingHorizontal: 12 }}
              >
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 16 }}>
                  Accept
                </Text>
              </TouchableOpacity>
            </View>
          ) : null,
      });
      return;
    }

    navigation.setOptions({
      title: headerTitle,
      headerRight: () =>
        conversationId ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('ChatSettings', { conversationId })}
            style={{ paddingHorizontal: 12 }}
          >
            <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        ) : null,
    });
  }, [
    navigation,
    headerTitle,
    conversationId,
    messageRequestId,
    theme.colors.primary,
    theme.colors.textSecondary,
    incomingRequest,
    isRequestThread,
    otherUserId,
  ]);

  const resolvedReceiverId = isGroup ? 'group' : otherUserId;

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !user) return;

    if (messageRequestId) {
      if (!otherUserId) return;
      setSending(true);
      try {
        await DatabaseService.sendMessageOnRequest(messageRequestId, {
          senderId: user.uid,
          receiverId: otherUserId,
          content: text,
          images: [],
          read: false,
        });
        setMessageText('');
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Message could not be sent.');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!conversationId) return;
    if (!isGroup && !otherUserId) return;

    setSending(true);
    try {
      await DatabaseService.sendMessage(conversationId, {
        senderId: user.uid,
        receiverId: resolvedReceiverId || 'group',
        content: text,
        images: [],
        read: false,
      });
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const pickAndSendImage = useCallback(async () => {
    if (!user?.uid) return;
    if (readOnlyRequest) return;
    if (messageRequestId) {
      if (!otherUserId) {
        Alert.alert('Please wait', 'Chat is still loading.');
        return;
      }
      try {
        const asset = await ImageService.pickImage(true, 0.85);
        if (!asset?.uri) return;
        setUploading(true);
        const { url } = await ImageService.uploadImage(
          asset.uri,
          `messages/requests/${messageRequestId}`
        );
        await DatabaseService.sendMessageOnRequest(messageRequestId, {
          senderId: user.uid,
          receiverId: otherUserId,
          content: '',
          images: [url],
          read: false,
        });
      } catch (e: any) {
        Alert.alert('Image', e?.message || 'Could not send photo');
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!conversationId) return;
    if (!isGroup && !otherUserId) {
      Alert.alert('Please wait', 'Chat is still loading.');
      return;
    }
    try {
      const asset = await ImageService.pickImage(true, 0.85);
      if (!asset?.uri) return;
      setUploading(true);
      const { url } = await ImageService.uploadImage(asset.uri, `messages/${conversationId}`);
      await DatabaseService.sendMessage(conversationId, {
        senderId: user.uid,
        receiverId: resolvedReceiverId || 'group',
        content: '',
        images: [url],
        read: false,
      });
    } catch (e: any) {
      Alert.alert('Image', e?.message || 'Could not send photo');
    } finally {
      setUploading(false);
    }
  }, [
    user?.uid,
    conversationId,
    messageRequestId,
    resolvedReceiverId,
    isGroup,
    otherUserId,
    readOnlyRequest,
  ]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.uid;
    const previous = index > 0 ? messages[index - 1] : null;
    const showSenderMeta = isGroup && (!previous || previous.senderId !== item.senderId);
    const sender = participantProfiles[item.senderId];
    const senderName = isOwn ? 'You' : sender?.name || 'Member';

    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {isGroup && !isOwn ? (
          <View style={styles.senderColumn}>
            {showSenderMeta ? (
              <>
                <Text style={styles.senderName} numberOfLines={1}>
                  {senderName}
                </Text>
                {sender?.profileImage ? (
                  <Image source={{ uri: sender.profileImage }} style={styles.senderAvatar} contentFit="cover" />
                ) : (
                  <View style={styles.senderAvatarPlaceholder}>
                    <Ionicons name="person" size={14} color={theme.colors.textSecondary} />
                  </View>
                )}
              </>
            ) : (
              <View style={styles.senderSpacer} />
            )}
          </View>
        ) : null}

        <View style={styles.messageBody}>
          {isGroup && isOwn && showSenderMeta ? (
            <Text style={[styles.senderName, styles.senderNameOwn]}>You</Text>
          ) : null}
          <View
            style={[
              styles.messageContainer,
              isOwn ? styles.ownMessage : styles.otherMessage,
            ]}
          >
            {item.images && item.images.length > 0 && (
              <View style={styles.imageStack}>
                {item.images.map((uri, i) => (
                  <Image
                    key={`${item.id}-img-${i}`}
                    source={{ uri }}
                    style={styles.msgImage}
                    contentFit="cover"
                  />
                ))}
              </View>
            )}
            {!!item.content && (
              <Text
                style={[
                  styles.messageText,
                  isOwn ? styles.ownMessageText : styles.otherMessageText,
                ]}
              >
                {item.content}
              </Text>
            )}
            <Text
              style={[
                styles.messageTime,
                isOwn ? styles.ownMessageTime : styles.otherMessageTime,
              ]}
            >
              {formatDistanceToNow(item.createdAt, { addSuffix: true })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {readOnlyRequest && (
        <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.bannerText, { color: theme.colors.textSecondary }]}>
            Message request — accept to move this chat to your inbox and reply here.
          </Text>
        </View>
      )}
      {isRequestThread && !incomingRequest && (
        <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.bannerText, { color: theme.colors.textSecondary }]}>
            Waiting for them to accept your request.
          </Text>
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      {!readOnlyRequest && (
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={pickAndSendImage}
            disabled={uploading || sending}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={26} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={theme.colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            <Ionicons
              name="send"
              size={20}
              color={messageText.trim() && !sending ? '#FFFFFF' : theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    banner: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    bannerText: {
      fontSize: 13,
      textAlign: 'center',
    },
    messagesList: {
      padding: 12,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 6,
    },
    messageRowOwn: {
      justifyContent: 'flex-end',
    },
    senderColumn: {
      width: 56,
      alignItems: 'center',
      marginRight: 6,
    },
    senderName: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      maxWidth: 56,
    },
    senderNameOwn: {
      alignSelf: 'flex-end',
      marginBottom: 4,
    },
    senderAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    senderAvatarPlaceholder: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    senderSpacer: {
      width: 28,
      height: 28,
    },
    messageBody: {
      maxWidth: '82%',
    },
    messageContainer: {
      maxWidth: '100%',
      padding: 12,
      borderRadius: 16,
    },
    ownMessage: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 4,
    },
    otherMessage: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    imageStack: { marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
    msgImage: {
      width: 220,
      height: 180,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
    },
    messageText: {
      fontSize: 16,
      marginBottom: 4,
    },
    ownMessageText: {
      color: '#FFFFFF',
    },
    otherMessageText: {
      color: theme.colors.text,
    },
    messageTime: {
      fontSize: 10,
    },
    ownMessageTime: {
      color: '#FFFFFF80',
    },
    otherMessageTime: {
      color: theme.colors.textSecondary,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    attachBtn: {
      paddingBottom: 10,
      paddingRight: 8,
      justifyContent: 'center',
      minWidth: 36,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.colors.text,
      maxHeight: 120,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.border,
    },
  });
