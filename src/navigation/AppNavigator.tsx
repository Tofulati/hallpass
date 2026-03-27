import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useMessageTabBadgeCount } from '../hooks/useMessageTabBadgeCount';

// Screens
import BulletinScreen from '../screens/BulletinScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
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
import NewMessageScreen from '../screens/NewMessageScreen';
import AddChatParticipantsScreen from '../screens/AddChatParticipantsScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import ProfessorDetailScreen from '../screens/ProfessorDetailScreen';
import CreateProfessorRatingScreen from '../screens/CreateProfessorRatingScreen';
import RequestProfessorScreen from '../screens/RequestProfessorScreen';
import DiscussionDetailScreen from '../screens/DiscussionDetailScreen';

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
      name="DiscussionDetail"
      component={DiscussionDetailScreen}
      options={{ headerShown: false }}
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
      name="Notifications"
      component={NotificationsScreen}
      options={{ headerShown: false }}
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
      name="DiscussionDetail"
      component={DiscussionDetailScreen}
      options={{ headerShown: false }}
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
      name="DiscussionDetail"
      component={DiscussionDetailScreen}
      options={{ headerShown: false }}
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
      name="NewMessage"
      component={NewMessageScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="AddChatParticipants"
      component={AddChatParticipantsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="ChatSettings"
      component={ChatSettingsScreen}
      options={{ title: 'Chat Info' }}
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
  const messageBadgeCount = useMessageTabBadgeCount();
  const rootScreenByTab: Record<string, string> = {
    Bulletin: 'BulletinMain',
    Course: 'CourseMain',
    Clubs: 'ClubsMain',
    Message: 'MessageMain',
    Search: 'SearchMain',
    User: 'UserMain',
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarBadge:
              route.name === 'Message' && messageBadgeCount > 0
                ? messageBadgeCount > 99
                  ? '99+'
                  : messageBadgeCount
                : undefined,
            tabBarBadgeStyle:
              route.name === 'Message' && messageBadgeCount > 0
                ? {
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: '700' as const,
                  }
                : undefined,
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
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('Bulletin', { screen: rootScreenByTab.Bulletin });
            },
          })}
        />
        <Tab.Screen
          name="Course"
          component={CourseStack}
          options={{ headerShown: false }}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('Course', { screen: rootScreenByTab.Course });
            },
          })}
        />
        <Tab.Screen
          name="Clubs"
          component={ClubsStack}
          options={{ headerShown: false }}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('Clubs', { screen: rootScreenByTab.Clubs });
            },
          })}
        />
        <Tab.Screen
          name="Message"
          component={MessageStack}
          options={{ headerShown: false }}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('Message', { screen: rootScreenByTab.Message });
            },
          })}
        />
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={{ headerShown: false }}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('Search', { screen: rootScreenByTab.Search });
            },
          })}
        />
        <Tab.Screen
          name="User"
          component={UserStack}
          options={{ headerShown: false }}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('User', { screen: rootScreenByTab.User });
            },
          })}
        />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
