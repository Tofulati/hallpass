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

export default function AddChatParticipantsScreen({ route, navigation }: any) {
  const { conversationId } = route.params as { conversationId: string };
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [existing, setExisting] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, User>>({});
  const [eligibility, setEligibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const c = await DatabaseService.getConversation(conversationId);
      setExisting(c?.participants || []);
    })();
  }, [conversationId]);

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
        const filtered = list.filter(u => u.id !== mine && !existing.includes(u.id));
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
  }, [debouncedQuery, userData, user?.uid, existing]);

  const toggleUser = (u: User) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = u;
      return next;
    });
  };

  const addPeople = async () => {
    if (!user?.uid) return;
    const ids = Object.keys(selected);
    if (ids.length === 0) {
      Alert.alert('Select people', 'Choose who to add to this chat.');
      return;
    }
    try {
      await DatabaseService.addParticipantsToConversation(conversationId, user.uid, ids);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not add', e?.message || 'Try again');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add people</Text>
        <TouchableOpacity onPress={addPeople} style={styles.headerBtn}>
          <Text style={styles.addLabel}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor={theme.colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {loading ||
      (query.trim().length > 0 && query.trim() !== debouncedQuery.trim()) ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            <Text style={styles.hint}>
              {query.trim() ? 'No matches — try another name.' : 'Search for people at your school.'}
            </Text>
          }
          renderItem={({ item }) => {
            const sel = !!selected[item.id];
            const ok = eligibility[item.id];
            return (
              <TouchableOpacity
                style={[styles.userRow, sel && styles.userRowSel]}
                onPress={() => {
                  if (ok === false) {
                    Alert.alert(
                      'Not connected',
                      'You can only add people you follow or who follow you.'
                    );
                    return;
                  }
                  toggleUser(item);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={22} color={theme.colors.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.name}</Text>
                  {ok === false && (
                    <Text style={styles.warn}>Follow each other to add to this chat</Text>
                  )}
                </View>
                <Ionicons
                  name={sel ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
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
      paddingHorizontal: 4,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBtn: { padding: 10, minWidth: 64 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
    cancel: { fontSize: 16, color: theme.colors.textSecondary },
    addLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.primary, textAlign: 'right' },
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
    listPad: { padding: 16, paddingBottom: 80 },
    hint: { textAlign: 'center', color: theme.colors.textSecondary, marginTop: 24 },
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
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    userName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
    warn: { fontSize: 12, color: theme.colors.primary, marginTop: 2 },
  });
