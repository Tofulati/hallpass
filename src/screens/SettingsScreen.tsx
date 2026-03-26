import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { AuthService } from '../services/authService';
import { DatabaseService } from '../services/databaseService';

WebBrowser.maybeCompleteAuthSession();

export default function SettingsScreen({ navigation }: any) {
  const { signOut, userData, user, refreshUserData } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const pendingGoogleDeleteRef = useRef(false);

  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID';
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || WEB_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (!response || !pendingGoogleDeleteRef.current) return;
    if (response.type === 'success') {
      pendingGoogleDeleteRef.current = false;
      const { id_token, access_token } = response.params;
      (async () => {
        setDeleteBusy(true);
        try {
          await AuthService.deleteAccountWithGoogle(id_token, access_token);
          setDeleteModalVisible(false);
          setDeletePassword('');
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Could not delete account');
        } finally {
          setDeleteBusy(false);
        }
      })();
    } else if (response.type === 'error') {
      pendingGoogleDeleteRef.current = false;
      Alert.alert('Error', 'Google sign-in was cancelled or failed');
      setDeleteBusy(false);
    } else if (response.type === 'dismiss') {
      pendingGoogleDeleteRef.current = false;
      setDeleteBusy(false);
    }
  }, [response]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const openDeleteAccountFlow = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your Hallpass profile and related data stored in our database (including ID verification and message requests). This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setDeleteModalVisible(true);
          },
        },
      ]
    );
  };

  const closeDeleteModal = () => {
    if (deleteBusy) return;
    setDeleteModalVisible(false);
    setDeletePassword('');
  };

  const handleConfirmDeleteWithPassword = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Error', 'Enter your password to confirm.');
      return;
    }
    setDeleteBusy(true);
    try {
      await AuthService.deleteAccountWithPassword(deletePassword);
      setDeleteModalVisible(false);
      setDeletePassword('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not delete account');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleConfirmDeleteWithGoogle = async () => {
    if (!request) {
      Alert.alert('Error', 'Google sign-in is not ready. Try again in a moment.');
      return;
    }
    pendingGoogleDeleteRef.current = true;
    setDeleteBusy(true);
    try {
      await promptAsync();
    } catch {
      pendingGoogleDeleteRef.current = false;
      setDeleteBusy(false);
    }
  };

  const hasPassword = AuthService.hasPasswordProvider(user);
  const styles = createStyles(theme);

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Theme Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Theme</Text>
          <View style={styles.themeOptions}>
            {(['light', 'dark', 'auto'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.themeOption,
                  themeMode === mode && styles.themeOptionSelected,
                ]}
                onPress={() => setThemeMode(mode)}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    themeMode === mode && styles.themeOptionTextSelected,
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLabel}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLabel}>Privacy Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Private account</Text>
          <Switch
            value={userData?.isPrivate || false}
            disabled={!user?.uid || privacySaving}
            onValueChange={async value => {
              if (!user?.uid) return;
              setPrivacySaving(true);
              try {
                await DatabaseService.updateUser(user.uid, { isPrivate: value });
                await refreshUserData();
              } catch (e: any) {
                Alert.alert('Error', e?.message || 'Could not update privacy setting');
              } finally {
                setPrivacySaving(false);
              }
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Text style={styles.privacyHint}>
          Public (default): anyone at your school can view your courses and organizations and message you
          directly. Private: others see your name only until you accept their follow request; messaging uses a
          request until you follow each other.
        </Text>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Version</Text>
          <Text style={styles.settingValue}>1.0.0</Text>
        </View>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLabel}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Delete account */}
      <TouchableOpacity style={styles.deleteAccountButton} onPress={openDeleteAccountFlow}>
        <Text style={styles.deleteAccountText}>Delete account</Text>
      </TouchableOpacity>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>

    <Modal
      visible={deleteModalVisible}
      animationType="fade"
      transparent
      onRequestClose={closeDeleteModal}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.modalBackdropTouchable}
          activeOpacity={1}
          onPress={closeDeleteModal}
        />
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Confirm deletion</Text>
          <Text style={[styles.modalBody, { color: theme.colors.textSecondary }]}>
            {hasPassword
              ? 'Enter your password to permanently delete your account and related data.'
              : 'You signed up with Google. Sign in with Google once more to confirm deletion.'}
          </Text>
          {hasPassword ? (
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.background,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              editable={!deleteBusy}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButtonSecondary, { borderColor: theme.colors.border }]}
              onPress={closeDeleteModal}
              disabled={deleteBusy}
            >
              <Text style={[styles.modalButtonSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            {hasPassword ? (
              <TouchableOpacity
                style={[styles.modalButtonDanger, { backgroundColor: theme.colors.error }]}
                onPress={handleConfirmDeleteWithPassword}
                disabled={deleteBusy}
              >
                {deleteBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonDangerText}>Delete account</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.modalButtonDanger, { backgroundColor: theme.colors.error }]}
                onPress={handleConfirmDeleteWithGoogle}
                disabled={deleteBusy || !request}
              >
                {deleteBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonDangerText}>Continue with Google</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    settingLabel: {
      fontSize: 16,
      color: theme.colors.text,
    },
    privacyHint: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      marginTop: 4,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    settingValue: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    themeOptions: {
      flexDirection: 'row',
      gap: 8,
    },
    themeOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    themeOptionSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    themeOptionText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    themeOptionTextSelected: {
      color: '#FFFFFF',
    },
    deleteAccountButton: {
      backgroundColor: theme.colors.error + '12',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
      borderWidth: 1,
      borderColor: theme.colors.error + '80',
    },
    deleteAccountText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.error,
    },
    signOutButton: {
      backgroundColor: theme.colors.error + '20',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    signOutText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.error,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalBackdropTouchable: {
      ...StyleSheet.absoluteFillObject,
    },
    modalCard: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    modalBody: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 16,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 20,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButtonSecondary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonSecondaryText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonDanger: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    modalButtonDangerText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
