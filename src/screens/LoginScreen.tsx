import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AuthService } from '../services/authService';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, register, user, hasCompletedOnboarding, loading: authLoading } = useAuth();
  const { theme } = useTheme();

  // Navigate to Onboarding if user is logged in but hasn't completed onboarding
  // Clear loading state when navigation happens
  useEffect(() => {
    if (!authLoading && user && !hasCompletedOnboarding) {
      setLoading(false);
      // Small delay to ensure navigation is ready
      const timer = setTimeout(() => {
        navigation.navigate('Onboarding');
      }, 100);
      return () => clearTimeout(timer);
    } else if (!authLoading && !user) {
      // User logged out, clear loading
      setLoading(false);
    }
  }, [user, hasCompletedOnboarding, authLoading, navigation]);

  // Google Sign-In configuration
  // For Expo Go development, you can use the Web client ID for all platforms
  // Get this from Firebase Console → Authentication → Sign-in method → Google → Web client ID
  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID';
  
  const [request, response, promptAsync] = Google.useAuthRequest({
    // For Expo Go, use Web client ID for all platforms
    // For production builds, you'll want platform-specific IDs
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || WEB_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token, access_token } = response.params;
      handleGoogleSignIn(id_token, access_token);
    } else if (response?.type === 'error') {
      Alert.alert('Error', 'Google sign in failed');
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken: string, accessToken: string) => {
    try {
      setGoogleLoading(true);
      await AuthService.signInWithGoogle(idToken, accessToken);
      // Navigation will be handled by useEffect watching auth state
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Google sign in failed');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        // Navigation will be handled by useEffect watching auth state
      } else {
        // Register new user
        await register(email, password, name);
        // After registration, user is automatically signed in
        // Navigation to Onboarding will be handled by useEffect
      }
      // Don't clear loading immediately - let useEffect handle it when auth state updates
      // This prevents flickering and ensures navigation happens properly
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>HallPass</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
          </Text>

          {!isLogin && (
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchTextBold}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
            onPress={() => {
              setGoogleLoading(true);
              promptAsync();
            }}
            disabled={googleLoading || !request}
          >
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.googleButtonText}>
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logoText: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    formContainer: {
      width: '100%',
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 32,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      height: 50,
      color: theme.colors.text,
      fontSize: 16,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    switchButton: {
      marginTop: 24,
      alignItems: 'center',
    },
    switchText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    switchTextBold: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4285F4',
      borderRadius: 12,
      height: 50,
      marginTop: 8,
    },
    googleButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });
