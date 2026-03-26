import React, { useState, useMemo, useEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { User } from '../types';
import { Image } from 'expo-image';

function universityIdOf(u: User | null): string {
  if (!u) return '';
  return typeof u.university === 'string' ? u.university : u.university?.id || '';
}

export default function NewMessageScreen({ navigation }: any) {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, User>>({});
  const [eligibility, setEligibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!userData || !q) {
      setResults([]);
      setEligibility({});
      setLoading(false);
      return;
    }
    const uni = universityIdOf(userData);
    if (!uni) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await DatabaseService.searchUsers(q, uni);
        const mine = user?.uid;
        const filtered = list.filter(u => u.id !== mine);
        const elig: Record<string, boolean> = {};
        await Promise.all(
          filtered.map(async u => {
            const full = (await DatabaseService.getUser(u.id)) || u;
            elig[u.id] = userData ? DatabaseService.messagingEligible(userData, u.id, full) : false;
          })
        );
        if (!cancelled) {
          setResults(filtered);
          setEligibility(elig);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setResults([]);
          setEligibility({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, userData, user?.uid]);

  const toggleUser = (u: User) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = u;
      return next;
    });
  };

  const startChat = async () => {
    if (!user?.uid || !userData) return;
    const picked = Object.values(selected);
    if (picked.length === 0) {
      Alert.alert('Select someone', 'Choose one or more people to message.');
      return;
    }

    if (picked.length === 1) {
      const other = picked[0];
      const fullOther = (await DatabaseService.getUser(other.id)) || other;
      const ok = DatabaseService.messagingEligible(userData, other.id, fullOther);
      try {
        if (ok) {
          const conversationId = await DatabaseService.getOrCreateConversation(user.uid, other.id);
          navigation.replace('Chat', {
            conversationId,
            title: other.name,
            otherUserId: other.id,
            isGroup: false,
          });
        } else {
          const messageRequestId = await DatabaseService.getOrCreatePendingMessageRequest(
            user.uid,
            other.id
          );
          navigation.replace('Chat', {
            messageRequestId,
            title: other.name,
            otherUserId: other.id,
            isMessageRequest: true,
            incomingRequest: false,
            isGroup: false,
          });
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Could not open chat');
      }
      return;
    }

    // Two or more people → group chat
    for (const p of picked) {
      const full = (await DatabaseService.getUser(p.id)) || p;
      if (!DatabaseService.messagingEligible(userData, p.id, full)) {
        Alert.alert(
          'Not connected',
          `You can only add people you follow or who follow you. Remove ${p.name} or send them a message request first.`
        );
        return;
      }
    }
    try {
      const ids = picked.map(p => p.id);
      const conversationId = await DatabaseService.createGroupConversation(user.uid, ids);
      const title = picked.map(p => p.name.split(' ')[0]).join(', ');
      navigation.replace('Chat', {
        conversationId,
        title: title.slice(0, 48) + (title.length > 48 ? '…' : ''),
        isGroup: true,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create group');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New message</Text>
        <TouchableOpacity onPress={startChat} style={styles.headerBtn}>
          <Text style={styles.nextLabel}>Next</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people at your school..."
          placeholderTextColor={theme.colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.selectHint}>Select one person to DM, or several for a group chat.</Text>

      {loading ||
      (query.trim().length > 0 && query.trim() !== debouncedQuery.trim()) ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={styles.hint}>No matches — try another name or email.</Text>
            ) : (
              <Text style={styles.hint}>Search by name or email to find people.</Text>
            )
          }
          renderItem={({ item }) => {
            const sel = !!selected[item.id];
            const ok = eligibility[item.id];
            return (
              <TouchableOpacity
                style={[styles.userRow, sel && styles.userRowSel]}
                onPress={() => toggleUser(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.username ? (
                    <Text style={styles.userSub}>@{item.username}</Text>
                  ) : null}
                  {ok === false && (
                    <Text style={styles.warn}>They’ll get this as a message request</Text>
                  )}
                </View>
                <Ionicons
                  name={sel ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={sel ? theme.colors.primary : theme.colors.textSecondary}
                />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBtn: { padding: 8, minWidth: 64 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
    nextLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.primary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: { flex: 1, marginLeft: 8, color: theme.colors.text, fontSize: 16 },
    selectHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    listPad: { padding: 16, paddingBottom: 120 },
    hint: { textAlign: 'center', color: theme.colors.textSecondary, marginTop: 32 },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    userRowSel: { borderColor: theme.colors.primary },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    userName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
    userSub: { fontSize: 13, color: theme.colors.textSecondary },
    warn: { fontSize: 12, color: theme.colors.primary, marginTop: 2 },
  });
