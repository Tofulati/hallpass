import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Screens
import BulletinScreen from '../screens/BulletinScreen';
import CourseScreen from '../screens/CourseScreen';
import ClubsScreen from '../screens/ClubsScreen';
import MessageScreen from '../screens/MessageScreen';
import SearchScreen from '../screens/SearchScreen';
import UserScreen from '../screens/UserScreen';
import CreateDiscussionScreen from '../screens/CreateDiscussionScreen';
import CourseDetailScreen from '../screens/CourseDetailScreen';
import ClubDetailScreen from '../screens/ClubDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfessorDetailScreen from '../screens/ProfessorDetailScreen';
import CreateProfessorRatingScreen from '../screens/CreateProfessorRatingScreen';
import RequestProfessorScreen from '../screens/RequestProfessorScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const BulletinStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="BulletinMain" 
      component={BulletinScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="CreateDiscussion" 
      component={CreateDiscussionScreen}
      options={{ title: 'Create Discussion' }}
    />
    <Stack.Screen 
      name="ProfessorDetail" 
      component={ProfessorDetailScreen}
      options={{ title: 'Professor Profile' }}
    />
    <Stack.Screen 
      name="CreateProfessorRating" 
      component={CreateProfessorRatingScreen}
      options={{ title: 'Rate Professor' }}
    />
  </Stack.Navigator>
);

const CourseStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="CourseMain" 
      component={CourseScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="CourseDetail" 
      component={CourseDetailScreen}
      options={{ title: 'Course Details' }}
    />
    <Stack.Screen 
      name="CreateDiscussion" 
      component={CreateDiscussionScreen}
      options={{ title: 'Create Discussion' }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
    <Stack.Screen 
      name="ProfessorDetail" 
      component={ProfessorDetailScreen}
      options={{ title: 'Professor Profile' }}
    />
    <Stack.Screen 
      name="CreateProfessorRating" 
      component={CreateProfessorRatingScreen}
      options={{ title: 'Rate Professor' }}
    />
    <Stack.Screen 
      name="RequestProfessor" 
      component={RequestProfessorScreen}
      options={{ title: 'Request Add Professor' }}
    />
  </Stack.Navigator>
);

const ClubsStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="ClubsMain" 
      component={ClubsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="ClubDetail" 
      component={ClubDetailScreen}
      options={{ title: 'Club Details' }}
    />
    <Stack.Screen 
      name="CreateDiscussion" 
      component={CreateDiscussionScreen}
      options={{ title: 'Create Discussion' }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
  </Stack.Navigator>
);

const MessageStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="MessageMain" 
      component={MessageScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Chat" 
      component={ChatScreen}
      options={{ title: 'Chat' }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="SearchMain" 
      component={SearchScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
    <Stack.Screen 
      name="CourseDetail" 
      component={CourseDetailScreen}
      options={{ title: 'Course Details' }}
    />
    <Stack.Screen 
      name="ClubDetail" 
      component={ClubDetailScreen}
      options={{ title: 'Club Details' }}
    />
    <Stack.Screen 
      name="ProfessorDetail" 
      component={ProfessorDetailScreen}
      options={{ title: 'Professor Profile' }}
    />
    <Stack.Screen 
      name="CreateProfessorRating" 
      component={CreateProfessorRatingScreen}
      options={{ title: 'Rate Professor' }}
    />
  </Stack.Navigator>
);

const UserStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="UserMain" 
      component={UserScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
    <Stack.Screen 
      name="Settings" 
      component={SettingsScreen}
      options={{ title: 'Settings' }}
    />
  </Stack.Navigator>
);

export default function AppNavigator() {
  const { theme } = useTheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;

              if (route.name === 'Bulletin') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Course') {
                iconName = focused ? 'book' : 'book-outline';
              } else if (route.name === 'Clubs') {
                iconName = focused ? 'people' : 'people-outline';
              } else if (route.name === 'Message') {
                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              } else if (route.name === 'Search') {
                iconName = focused ? 'search' : 'search-outline';
              } else if (route.name === 'User') {
                iconName = focused ? 'person' : 'person-outline';
              } else {
                iconName = 'ellipse-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.textSecondary,
            tabBarShowLabel: false, // Remove text labels
            tabBarStyle: {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.background,
              borderTopWidth: 1,
              paddingBottom: 0,
              paddingTop: 0,
              height: 80,
              elevation: 0,
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
            },
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              color: theme.colors.text,
            },
          })}
        >
        <Tab.Screen 
          name="Bulletin" 
          component={BulletinStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="Course" 
          component={CourseStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="Clubs" 
          component={ClubsStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="Message" 
          component={MessageStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="Search" 
          component={SearchStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="User" 
          component={UserStack}
          options={{ headerShown: false }}
        />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
