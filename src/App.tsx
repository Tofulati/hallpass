import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import { useTheme } from './context/ThemeContext';

function AppContent() {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Show onboarding if user is logged in but hasn't completed onboarding
  if (user && !hasCompletedOnboarding) {
    return <AuthNavigator />;
  }

  // Show main app if user is logged in and has completed onboarding
  if (user) {
    return <AppNavigator />;
  }

  // Show auth screens if user is not logged in
  return <AuthNavigator />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
