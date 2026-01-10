import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Conversation } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

export default function MessageScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, [user]);

  useEffect(() => {
    filterConversations();
  }, [conversations, searchQuery]);

  const loadConversations = async () => {
    if (!user) return;
    
    try {
      const allConversations = await DatabaseService.getConversations(user.uid);
      setConversations(allConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const filterConversations = () => {
    let filtered = [...conversations];

    if (searchQuery) {
      filtered = filtered.filter(conv => {
        const otherUserId = getOtherParticipant(conv);
        // Filter by user ID (partial match)
        return otherUserId.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    setFilteredConversations(filtered);
  };

  const getOtherParticipant = (conversation: Conversation): string => {
    if (!user) return '';
    return conversation.participants.find(id => id !== user.uid) || '';
  };

  const handleNewMessage = () => {
    // Navigate to search/users screen to start a new conversation
    // For now, we'll navigate to Search screen - can be updated later
    navigation.navigate('Search');
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={handleNewMessage}
        >
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      {filteredConversations.length > 0 ? (
        <FlatList
          data={filteredConversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const otherUserId = getOtherParticipant(item);
            return (
              <TouchableOpacity
                style={styles.conversationCard}
                onPress={() => navigation.navigate('Chat', { conversationId: item.id, otherUserId })}
              >
                <View style={styles.avatarContainer}>
                  <Ionicons name="person-circle" size={50} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationName}>
                      User {otherUserId.slice(0, 8)}
                    </Text>
                    {item.lastMessage && (
                      <Text style={styles.conversationTime}>
                        {formatDistanceToNow(item.lastMessage.createdAt, { addSuffix: true })}
                      </Text>
                    )}
                  </View>
                  {item.lastMessage && (
                    <Text style={styles.conversationPreview} numberOfLines={1}>
                      {item.lastMessage.content}
                    </Text>
                  )}
                </View>
                {item.lastMessage && !item.lastMessage.read && (
                  <View style={styles.unreadBadge} />
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Start a conversation with someone!</Text>
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
    listContent: {
      padding: 16,
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
