import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Organization } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function ClubsScreen({ navigation }: any) {
  const { userData } = useAuth();
  const { theme } = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, [userData]);

  useEffect(() => {
    filterOrganizations();
  }, [organizations, searchQuery]);

  const loadOrganizations = async () => {
    if (!userData?.university || typeof userData.university !== 'string') {
      console.log('No university selected, cannot load organizations');
      setOrganizations([]);
      return;
    }
    
    setLoading(true);
    try {
      console.log('Loading organizations for university:', userData.university);
      const allOrgs = await DatabaseService.getOrganizations(userData.university);
      console.log('Loaded organizations:', allOrgs.length, allOrgs);
      setOrganizations(allOrgs);
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      console.error('Error details:', error.message, error.code);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const filterOrganizations = () => {
    let filtered = [...organizations];

    if (searchQuery) {
      filtered = filtered.filter(
        org =>
          org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          org.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredOrganizations(filtered);
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs & organizations..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Organizations List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading organizations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrganizations}
          keyExtractor={item => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.clubCard}
              onPress={() => navigation.navigate('Clubs', {
                screen: 'ClubDetail',
                params: { clubId: item.id },
              })}
            >
              {item.logo && item.logo.trim() ? (
                <ExpoImage
                  source={{ uri: item.logo }}
                  style={styles.clubImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.clubImagePlaceholder}>
                  <Ionicons name="people" size={32} color={theme.colors.textSecondary} />
                </View>
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
                    {item.members?.length || 0} {item.members?.length === 1 ? 'member' : 'members'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No organizations found</Text>
              {!searchQuery && (
                <Text style={styles.emptySubtext}>
                  {userData?.university ? 'No organizations available for your university yet' : 'Please select a university'}
                </Text>
              )}
              {searchQuery && (
                <Text style={styles.emptySubtext}>Try adjusting your search</Text>
              )}
            </View>
          }
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    listContent: {
      padding: 8,
      paddingBottom: 100, // Extra padding to prevent content from being hidden behind tabs
      flexGrow: 1,
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
    clubImagePlaceholder: {
      width: '100%',
      height: 120,
      backgroundColor: theme.colors.border + '40',
      justifyContent: 'center',
      alignItems: 'center',
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
      justifyContent: 'center',
      minHeight: 200,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
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
  });
