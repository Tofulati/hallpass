import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Club } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function ClubsScreen({ navigation }: any) {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filteredClubs, setFilteredClubs] = useState<Club[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadClubs();
  }, [userData]);

  useEffect(() => {
    filterClubs();
  }, [clubs, searchQuery]);

  const loadClubs = async () => {
    if (!userData?.university) return;
    
    try {
      const allClubs = await DatabaseService.getClubs(userData.university);
      setClubs(allClubs);
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  };

  const filterClubs = () => {
    let filtered = [...clubs];

    if (searchQuery) {
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredClubs(filtered);
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Clubs List */}
      <FlatList
        data={filteredClubs}
        keyExtractor={item => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.clubCard}
            onPress={() => navigation.navigate('ClubDetail', { clubId: item.id })}
          >
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.clubImage} />
            )}
            <View style={styles.clubContent}>
              <Text style={styles.clubName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={styles.clubDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.clubFooter}>
                <Ionicons name="people" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.clubMembers}>
                  {item.members?.length || 0} members
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No clubs found</Text>
          </View>
        }
      />
    </View>
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
    listContent: {
      padding: 8,
    },
    clubCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      margin: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    clubImage: {
      width: '100%',
      height: 120,
      backgroundColor: theme.colors.border,
    },
    clubContent: {
      padding: 12,
    },
    clubName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    clubDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    clubFooter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    clubMembers: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
