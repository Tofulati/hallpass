import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AuthService } from '../services/authService';
import { DatabaseService } from '../services/databaseService';
import { University, Course, Club, Organization } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingScreen({ navigation }: any) {
  const { user, refreshUserData } = useAuth();
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // University state
  const [universities, setUniversities] = useState<University[]>([]);
  const [filteredUniversities, setFilteredUniversities] = useState<University[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [showUniversityForm, setShowUniversityForm] = useState(false);
  const [universityFormData, setUniversityFormData] = useState({
    name: '',
    logo: '',
    image: '',
    primaryColor: '#6366f1',
    secondaryColor: '#8b92a7',
  });
  const [submittingUniversity, setSubmittingUniversity] = useState(false);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());

  // Course state
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseFormData, setCourseFormData] = useState({
    code: '',
    name: '',
    description: '',
    professors: [] as string[],
  });
  const [professorInput, setProfessorInput] = useState('');
  const [submittingCourse, setSubmittingCourse] = useState(false);

  // Organization state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [organizationSearchQuery, setOrganizationSearchQuery] = useState('');
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [failedOrgLogos, setFailedOrgLogos] = useState<Set<string>>(new Set());
  const [showOrganizationForm, setShowOrganizationForm] = useState(false);
  const [organizationFormData, setOrganizationFormData] = useState({
    name: '',
    logo: '',
    description: '',
    primaryColor: '#6366f1',
    secondaryColor: '#8b92a7',
  });
  const [submittingOrganization, setSubmittingOrganization] = useState(false);

  // Load universities from Firestore
  useEffect(() => {
    loadUniversities();
  }, []);

  const loadUniversities = async () => {
    try {
      setLoadingUniversities(true);
      const loadedUniversities = await DatabaseService.getUniversities();
      // Sort alphabetically by name (case-insensitive) as a fallback
      const sorted = loadedUniversities.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      // Debug: log universities to check logo URLs
      console.log('Loaded universities:', sorted.map(u => ({ name: u.name, logo: u.logo })));
      
      // Test if logo URLs are accessible
      for (const uni of sorted) {
        if (uni.logo && uni.logo.trim()) {
          try {
            const response = await fetch(uni.logo, { method: 'HEAD' });
            console.log(`Logo URL test for ${uni.name}:`, {
              url: uni.logo,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
            });
            if (!response.ok) {
              console.warn(`Logo URL returned ${response.status} for ${uni.name}`);
            }
          } catch (fetchError) {
            console.error(`Failed to fetch logo for ${uni.name}:`, fetchError);
          }
        }
      }
      
      setUniversities(sorted);
      setFilteredUniversities(sorted);
    } catch (error) {
      console.error('Error loading universities:', error);
      Alert.alert('Error', 'Failed to load universities');
    } finally {
      setLoadingUniversities(false);
    }
  };

  // Filter universities based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUniversities(universities);
    } else {
      const filtered = universities.filter(uni =>
        uni.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
      setFilteredUniversities(filtered);
    }
  }, [searchQuery, universities]);

  // Load courses when university is selected and step is 2
  useEffect(() => {
    if (selectedUniversity && step === 2) {
      loadCourses();
    }
  }, [selectedUniversity, step]);

  // Load organizations when step is 3
  useEffect(() => {
    if (step === 3) {
      loadOrganizations();
    }
  }, [step]);

  // Filter courses based on search query
  useEffect(() => {
    if (!courseSearchQuery.trim()) {
      setFilteredCourses(courses);
    } else {
      const filtered = courses.filter(course =>
        course.name.toLowerCase().includes(courseSearchQuery.toLowerCase().trim()) ||
        course.code.toLowerCase().includes(courseSearchQuery.toLowerCase().trim())
      );
      setFilteredCourses(filtered);
    }
  }, [courseSearchQuery, courses]);

  // Filter organizations based on search query
  useEffect(() => {
    if (!organizationSearchQuery.trim()) {
      setFilteredOrganizations(organizations);
    } else {
      const filtered = organizations.filter(org =>
        org.name.toLowerCase().includes(organizationSearchQuery.toLowerCase().trim()) ||
        org.description.toLowerCase().includes(organizationSearchQuery.toLowerCase().trim())
      );
      setFilteredOrganizations(filtered);
    }
  }, [organizationSearchQuery, organizations]);

  const loadCourses = async () => {
    if (!selectedUniversity) return;
    
    try {
      setLoadingCourses(true);
      const loadedCourses = await DatabaseService.getCourses(selectedUniversity.id);
      // Sort alphabetically by code
      const sorted = loadedCourses.sort((a, b) => 
        a.code.toLowerCase().localeCompare(b.code.toLowerCase())
      );
      setCourses(sorted);
      setFilteredCourses(sorted);
    } catch (error) {
      console.error('Error loading courses:', error);
      Alert.alert('Error', 'Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      setLoadingOrganizations(true);
      const loadedOrganizations = await DatabaseService.getOrganizations();
      // Sort alphabetically by name
      const sorted = loadedOrganizations.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setOrganizations(sorted);
      setFilteredOrganizations(sorted);
    } catch (error) {
      console.error('Error loading organizations:', error);
      Alert.alert('Error', 'Failed to load organizations');
    } finally {
      setLoadingOrganizations(false);
    }
  };

  const handleComplete = async () => {
    if (!user || !selectedUniversity) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    setLoading(true);
    try {
      await AuthService.completeOnboarding(user.uid, {
        name: user.displayName || '',
        universityId: selectedUniversity.id,
        courses: selectedCourses,
        clubs: selectedClubs,
      });
      await refreshUserData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const toggleClub = (clubId: string) => {
    setSelectedClubs(prev =>
      prev.includes(clubId)
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId]
    );
  };

  // Helper function to optimize Wikimedia Commons URLs
  // Converts large thumbnails to smaller ones (better for mobile)
  const optimizeImageUrl = (url: string): string => {
    if (!url || !url.includes('wikimedia.org')) return url;
    
    // If it's a thumbnail URL with a size, try to reduce it
    // Example: .../1200px-UC_San_Diego_logo.svg.png -> .../200px-UC_San_Diego_logo.svg.png
    const thumbnailMatch = url.match(/(\d+px)-([^/]+\.(?:png|jpg|jpeg|svg))/);
    if (thumbnailMatch && parseInt(thumbnailMatch[1]) > 300) {
      // Use smaller thumbnail (300px max for mobile)
      return url.replace(thumbnailMatch[1], '300px');
    }
    
    return url;
  };

  const handleSubmitUniversity = async () => {
    if (!universityFormData.name.trim()) {
      Alert.alert('Error', 'Please enter a university name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a university request');
      return;
    }

    // Basic validation - check if it looks like a real university name
    if (universityFormData.name.length < 3) {
      Alert.alert('Error', 'University name must be at least 3 characters');
      return;
    }

    setSubmittingUniversity(true);
    try {
      await DatabaseService.requestUniversity(
        {
          name: universityFormData.name.trim(),
          logo: universityFormData.logo.trim() || '',
          image: universityFormData.image.trim() || '',
          colors: {
            primary: universityFormData.primaryColor,
            secondary: universityFormData.secondaryColor,
          },
        },
        user.uid
      );

      Alert.alert(
        'University Submitted',
        'Your university request has been submitted for verification. It will be reviewed before being added to the database. You can select an existing university or try again later.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowUniversityForm(false);
              setUniversityFormData({
                name: '',
                logo: '',
                image: '',
                primaryColor: '#6366f1',
                secondaryColor: '#8b92a7',
              });
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit university request');
    } finally {
      setSubmittingUniversity(false);
    }
  };

  const handleSubmitCourse = async () => {
    if (!courseFormData.code.trim() || !courseFormData.name.trim()) {
      Alert.alert('Error', 'Please enter both course code and name');
      return;
    }

    if (!user || !selectedUniversity) {
      Alert.alert('Error', 'You must be logged in and select a university to submit a course request');
      return;
    }

    // Basic validation
    if (courseFormData.code.length < 2) {
      Alert.alert('Error', 'Course code must be at least 2 characters');
      return;
    }

    if (courseFormData.name.length < 3) {
      Alert.alert('Error', 'Course name must be at least 3 characters');
      return;
    }

    setSubmittingCourse(true);
    try {
      await DatabaseService.requestCourse(
        {
          code: courseFormData.code.trim(),
          name: courseFormData.name.trim(),
          description: courseFormData.description.trim() || undefined,
          universityId: selectedUniversity.id,
          professors: courseFormData.professors,
        },
        user.uid
      );

      Alert.alert(
        'Course Submitted',
        'Your course request has been submitted for verification. It will be reviewed before being added to the database. You can select an existing course or try again later.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowCourseForm(false);
              setCourseFormData({
                code: '',
                name: '',
                description: '',
                professors: [],
              });
              setProfessorInput('');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit course request');
    } finally {
      setSubmittingCourse(false);
    }
  };

  const handleAddProfessor = () => {
    if (!professorInput.trim()) {
      Alert.alert('Error', 'Please enter a professor name');
      return;
    }

    // Format professor name: Capitalize first letter of each word (normal upper case)
    const formattedName = professorInput.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Check for duplicates (case-sensitive check since user wants case-sensitive uniqueness)
    if (courseFormData.professors.includes(formattedName)) {
      Alert.alert('Error', 'This professor has already been added');
      return;
    }

    // Add professor
    setCourseFormData({
      ...courseFormData,
      professors: [...courseFormData.professors, formattedName],
    });
    setProfessorInput('');
  };

  const handleRemoveProfessor = (professor: string) => {
    setCourseFormData({
      ...courseFormData,
      professors: courseFormData.professors.filter(p => p !== professor),
    });
  };

  const handleSubmitOrganization = async () => {
    if (!organizationFormData.name.trim()) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit an organization request');
      return;
    }

    // Basic validation
    if (organizationFormData.name.length < 3) {
      Alert.alert('Error', 'Organization name must be at least 3 characters');
      return;
    }

    if (organizationFormData.description.length < 5) {
      Alert.alert('Error', 'Organization description must be at least 5 characters');
      return;
    }

    setSubmittingOrganization(true);
    try {
      await DatabaseService.requestOrganization(
        {
          name: organizationFormData.name.trim(),
          logo: organizationFormData.logo.trim() || '',
          description: organizationFormData.description.trim(),
          colors: {
            primary: organizationFormData.primaryColor,
            secondary: organizationFormData.secondaryColor,
          },
        },
        user.uid
      );

      Alert.alert(
        'Organization Submitted',
        'Your organization request has been submitted for verification. It will be reviewed before being added to the database. You can select an existing organization or try again later.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowOrganizationForm(false);
              setOrganizationFormData({
                name: '',
                logo: '',
                description: '',
                primaryColor: '#6366f1',
                secondaryColor: '#8b92a7',
              });
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit organization request');
    } finally {
      setSubmittingOrganization(false);
    }
  };

  const styles = createStyles(theme);

  // Render step 1: University Selection
  const renderUniversityStep = () => (
    <View style={styles.stepContainer}>
      {/* Header with search bar */}
      <View style={styles.headerSection}>
        <Text style={styles.stepTitle}>Select Your University</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search universities..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Options in middle - centered and scrollable */}
      <ScrollView
        style={styles.optionsScrollView}
        contentContainerStyle={styles.optionsSection}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {loadingUniversities ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading universities...</Text>
          </View>
        ) : filteredUniversities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery.trim() ? 'No universities found' : 'No universities found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery.trim() 
                ? 'Try a different search term' 
                : 'You can request to add your university'}
            </Text>
          </View>
        ) : (
          <View style={styles.universityList}>
            {Array.from({ length: Math.ceil(filteredUniversities.length / 3) }, (_, rowIndex) => {
              const startIndex = rowIndex * 3;
              const rowItems = filteredUniversities.slice(startIndex, startIndex + 3);
              return (
                <View key={`row-${rowIndex}`} style={styles.universityRow}>
                  {rowItems.map((university) => (
                    <TouchableOpacity
                      key={university.id}
                      style={styles.universityCard}
                      onPress={() => setSelectedUniversity(university)}
                    >
                      <View style={[
                        styles.logoContainer,
                        selectedUniversity?.id === university.id && styles.logoContainerSelected,
                      ]}>
                        {university.logo && university.logo.trim() && university.logo !== '' && !failedLogos.has(university.id) ? (
                          <Image
                            source={{ 
                              uri: optimizeImageUrl(university.logo),
                              headers: {
                                'Accept': 'image/*',
                              },
                            }}
                            style={styles.universityLogo}
                            contentFit="contain"
                            transition={200}
                            cachePolicy="memory-disk"
                            priority="normal"
                            recyclingKey={university.id}
                            allowDownscaling={true}
                            placeholderContentFit="contain"
                            onError={(error: any) => {
                              console.error('❌ Image loading error for', university.name, ':', {
                                originalUrl: university.logo,
                                optimizedUrl: optimizeImageUrl(university.logo),
                                error: error,
                                errorType: typeof error,
                                errorKeys: error ? Object.keys(error) : 'no error object',
                                errorMessage: error?.message || error?.toString() || 'Unknown error',
                              });
                              // Mark this logo as failed so we show the fallback icon
                              setFailedLogos(prev => new Set(prev).add(university.id));
                            }}
                            onLoad={() => {
                              console.log('✓ Logo loaded successfully for:', university.name, 'URL:', optimizeImageUrl(university.logo));
                            }}
                            onLoadStart={() => {
                              console.log('→ Starting to load logo for:', university.name);
                            }}
                          />
                        ) : (
                          <Ionicons name="school-outline" size={40} color={theme.colors.textSecondary} />
                        )}
                        {selectedUniversity?.id === university.id && (
                          <View style={styles.checkIconContainer}>
                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.universityName} numberOfLines={2}>
                        {university.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {/* Fill empty spaces if row doesn't have 3 items */}
                  {Array.from({ length: 3 - rowItems.length }, (_, emptyIndex) => (
                    <View key={`empty-${emptyIndex}`} style={styles.universityCardEmpty} />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Buttons at bottom - fixed */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowUniversityForm(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.addButtonText}>Request to Add University</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !selectedUniversity && styles.buttonDisabled]}
          onPress={() => selectedUniversity && setStep(2)}
          disabled={!selectedUniversity}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render step 2: Course Selection
  const renderCourseStep = () => (
    <View style={styles.stepContainer}>
      {/* Header with search bar */}
      <View style={styles.headerSection}>
        <Text style={styles.stepTitle}>Select Your Courses</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses..."
            placeholderTextColor={theme.colors.textSecondary}
            value={courseSearchQuery}
            onChangeText={setCourseSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {courseSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setCourseSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Options in middle - centered and scrollable */}
      <ScrollView
        style={styles.optionsScrollView}
        contentContainerStyle={styles.optionsSection}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {loadingCourses ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              {courseSearchQuery.trim() ? 'No courses found' : 'No courses found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {courseSearchQuery.trim() 
                ? 'Try a different search term' 
                : 'Courses will appear here once they are added'}
            </Text>
          </View>
        ) : (
          <View style={styles.courseList}>
            {Array.from({ length: Math.ceil(filteredCourses.length / 3) }, (_, rowIndex) => {
              const startIndex = rowIndex * 3;
              const rowItems = filteredCourses.slice(startIndex, startIndex + 3);
              return (
                <View key={`row-${rowIndex}`} style={styles.courseRow}>
                  {rowItems.map((course) => {
                    const isSelected = selectedCourses.includes(course.id);
                    return (
                      <TouchableOpacity
                        key={course.id}
                        style={styles.courseCard}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedCourses(selectedCourses.filter(id => id !== course.id));
                          } else {
                            setSelectedCourses([...selectedCourses, course.id]);
                          }
                        }}
                      >
                        <View style={[
                          styles.courseContainer,
                          isSelected && styles.courseContainerSelected,
                        ]}>
                          <Text style={styles.courseCode}>{course.code}</Text>
                          <Text style={styles.courseName} numberOfLines={2}>
                            {course.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkIconContainer}>
                              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Fill empty spaces if row doesn't have 3 items */}
                  {Array.from({ length: 3 - rowItems.length }, (_, emptyIndex) => (
                    <View key={`empty-${emptyIndex}`} style={styles.courseCardEmpty} />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Buttons at bottom - fixed */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCourseForm(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.addButtonText}>Request to Add Course</Text>
        </TouchableOpacity>

        <View style={styles.buttonSectionInlineNested}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setStep(1)}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonNext, selectedCourses.length === 0 && styles.buttonDisabled]}
            onPress={() => {
              if (selectedCourses.length === 0) {
                Alert.alert('Error', 'Please select at least one course to continue');
                return;
              }
              setStep(3);
            }}
            disabled={selectedCourses.length === 0}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render step 3: Organizations Selection
  const renderOrganizationsStep = () => (
    <View style={styles.stepContainer}>
      {/* Header with search bar */}
      <View style={styles.headerSection}>
        <Text style={styles.stepTitle}>Select Your Clubs/Organizations</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search organizations..."
            placeholderTextColor={theme.colors.textSecondary}
            value={organizationSearchQuery}
            onChangeText={setOrganizationSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {organizationSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setOrganizationSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Options in middle - centered and scrollable */}
      <ScrollView
        style={styles.optionsScrollView}
        contentContainerStyle={styles.optionsSection}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {loadingOrganizations ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading organizations...</Text>
          </View>
        ) : filteredOrganizations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              {organizationSearchQuery.trim() ? 'No organizations found' : 'No organizations found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {organizationSearchQuery.trim() 
                ? 'Try a different search term' 
                : 'Organizations will appear here once they are added'}
            </Text>
          </View>
        ) : (
          <View style={styles.organizationList}>
            {Array.from({ length: Math.ceil(filteredOrganizations.length / 2) }, (_, rowIndex) => {
              const startIndex = rowIndex * 2;
              const rowItems = filteredOrganizations.slice(startIndex, startIndex + 2);
              return (
                <View key={`row-${rowIndex}`} style={styles.organizationRow}>
                  {rowItems.map((org) => {
                    const isSelected = selectedClubs.includes(org.id);
                    return (
                      <TouchableOpacity
                        key={org.id}
                        style={styles.organizationCard}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedClubs(selectedClubs.filter(id => id !== org.id));
                          } else {
                            setSelectedClubs([...selectedClubs, org.id]);
                          }
                        }}
                      >
                        <View style={[
                          styles.organizationContainer,
                          isSelected && styles.organizationContainerSelected,
                        ]}>
                          {org.logo && org.logo.trim() && org.logo !== '' && !failedOrgLogos.has(org.id) ? (
                            <Image
                              source={{ 
                                uri: optimizeImageUrl(org.logo),
                                headers: {
                                  'Accept': 'image/*',
                                },
                              }}
                              style={styles.organizationLogo}
                              contentFit="contain"
                              transition={200}
                              cachePolicy="memory-disk"
                              priority="normal"
                              recyclingKey={org.id}
                              allowDownscaling={true}
                              placeholderContentFit="contain"
                              onError={(error: any) => {
                                console.error('❌ Image loading error for', org.name, ':', error);
                                setFailedOrgLogos(prev => new Set(prev).add(org.id));
                              }}
                              onLoad={() => {
                                console.log('✓ Logo loaded successfully for:', org.name);
                              }}
                            />
                          ) : (
                            <View style={styles.organizationLogoPlaceholder}>
                              <Ionicons name="people" size={32} color={theme.colors.textSecondary} />
                            </View>
                          )}
                          <Text style={styles.organizationName} numberOfLines={1}>
                            {org.name}
                          </Text>
                          <Text style={styles.organizationDescription} numberOfLines={3}>
                            {org.description}
                          </Text>
                          <View style={styles.memberCountContainer}>
                            <Ionicons name="people" size={14} color={theme.colors.textSecondary} />
                            <Text style={styles.memberCount}>
                              {org.members?.length || 0} {org.members?.length === 1 ? 'member' : 'members'}
                            </Text>
                          </View>
                          {isSelected && (
                            <View style={styles.checkIconContainer}>
                              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Fill empty space if row doesn't have 2 items */}
                  {rowItems.length === 1 && <View style={styles.organizationCardEmpty} />}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Buttons at bottom - fixed */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowOrganizationForm(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.addButtonText}>Request to Add Organization</Text>
        </TouchableOpacity>

        <View style={styles.buttonSectionInlineNested}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setStep(2)}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonNext]}
            onPress={() => setStep(4)}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {step === 1 && renderUniversityStep()}

          {step === 2 && renderCourseStep()}

          {step === 3 && renderOrganizationsStep()}

          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>You're All Set!</Text>
              <Text style={styles.stepDescription}>
                You can now start exploring and engaging with your university community.
              </Text>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleComplete}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Setting up...' : 'Get Started'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* University Form Modal */}
        <Modal
          visible={showUniversityForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowUniversityForm(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView
              style={styles.modalKeyboardView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add University</Text>
                <TouchableOpacity
                  onPress={() => setShowUniversityForm(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={styles.formDescription}>
                  Request to add your university. Your submission will be reviewed before being added to ensure accuracy and prevent duplicates.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>University Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., Stanford University"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={universityFormData.name}
                    onChangeText={(text) => setUniversityFormData({ ...universityFormData, name: text })}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Logo URL (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="https://example.com/logo.png"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={universityFormData.logo}
                    onChangeText={(text) => setUniversityFormData({ ...universityFormData, logo: text })}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Image URL (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="https://example.com/image.png"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={universityFormData.image}
                    onChangeText={(text) => setUniversityFormData({ ...universityFormData, image: text })}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Primary Color</Text>
                  <View style={styles.colorInputContainer}>
                    <View style={[styles.colorPreview, { backgroundColor: universityFormData.primaryColor }]} />
                    <TextInput
                      style={styles.colorInput}
                      placeholder="#6366f1"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={universityFormData.primaryColor}
                      onChangeText={(text) => setUniversityFormData({ ...universityFormData, primaryColor: text })}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Secondary Color</Text>
                  <View style={styles.colorInputContainer}>
                    <View style={[styles.colorPreview, { backgroundColor: universityFormData.secondaryColor }]} />
                    <TextInput
                      style={styles.colorInput}
                      placeholder="#8b92a7"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={universityFormData.secondaryColor}
                      onChangeText={(text) => setUniversityFormData({ ...universityFormData, secondaryColor: text })}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, submittingUniversity && styles.buttonDisabled]}
                  onPress={handleSubmitUniversity}
                  disabled={submittingUniversity}
                >
                  <Text style={styles.buttonText}>
                    {submittingUniversity ? 'Submitting...' : 'Submit Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Course Form Modal */}
        <Modal
          visible={showCourseForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCourseForm(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView
              style={styles.modalKeyboardView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request to Add Course</Text>
                <TouchableOpacity
                  onPress={() => setShowCourseForm(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalFormScroll}>
                <Text style={styles.formDescription}>
                  Request to add a course for your university. Your submission will be reviewed before being added to ensure accuracy and prevent duplicates.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Course Code *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., CSE 101"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={courseFormData.code}
                    onChangeText={(text) => setCourseFormData({ ...courseFormData, code: text })}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Course Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., Introduction to Computer Science"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={courseFormData.name}
                    onChangeText={(text) => setCourseFormData({ ...courseFormData, name: text })}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description (Optional)</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder="Brief description of the course..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={courseFormData.description}
                    onChangeText={(text) => setCourseFormData({ ...courseFormData, description: text })}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Professors (Optional)</Text>
                  <Text style={styles.formSubLabel}>
                    Add professors who teach this course. Names will be formatted with proper capitalization (e.g., "John Smith").
                  </Text>
                  <View style={styles.professorInputContainer}>
                    <TextInput
                      style={[styles.formInput, styles.professorInput]}
                      placeholder="e.g., John Smith"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={professorInput}
                      onChangeText={setProfessorInput}
                      autoCapitalize="words"
                      onSubmitEditing={handleAddProfessor}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.addProfessorButton}
                      onPress={handleAddProfessor}
                    >
                      <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                  
                  {courseFormData.professors.length > 0 && (
                    <View style={styles.professorsList}>
                      {courseFormData.professors.map((professor, index) => (
                        <View key={index} style={styles.professorTag}>
                          <Text style={styles.professorTagText}>{professor}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveProfessor(professor)}
                            style={styles.removeProfessorButton}
                          >
                            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.button, submittingCourse && styles.buttonDisabled]}
                  onPress={handleSubmitCourse}
                  disabled={submittingCourse}
                >
                  <Text style={styles.buttonText}>
                    {submittingCourse ? 'Submitting...' : 'Submit Request'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Organization Form Modal */}
        <Modal
          visible={showOrganizationForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowOrganizationForm(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView
              style={styles.modalKeyboardView}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request to Add Organization</Text>
                <TouchableOpacity
                  onPress={() => setShowOrganizationForm(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalFormScroll}>
                <Text style={styles.formDescription}>
                  Request to add an organization or club. Your submission will be reviewed before being added to ensure accuracy and prevent duplicates.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Organization Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., Computer Science Club"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={organizationFormData.name}
                    onChangeText={(text) => setOrganizationFormData({ ...organizationFormData, name: text })}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Logo URL (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="https://example.com/logo.png"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={organizationFormData.logo}
                    onChangeText={(text) => setOrganizationFormData({ ...organizationFormData, logo: text })}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description *</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder="Brief description of the organization..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={organizationFormData.description}
                    onChangeText={(text) => setOrganizationFormData({ ...organizationFormData, description: text })}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Primary Color</Text>
                  <View style={styles.colorInputContainer}>
                    <View style={[styles.colorPreview, { backgroundColor: organizationFormData.primaryColor }]} />
                    <TextInput
                      style={styles.colorInput}
                      placeholder="#6366f1"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={organizationFormData.primaryColor}
                      onChangeText={(text) => setOrganizationFormData({ ...organizationFormData, primaryColor: text })}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Secondary Color</Text>
                  <View style={styles.colorInputContainer}>
                    <View style={[styles.colorPreview, { backgroundColor: organizationFormData.secondaryColor }]} />
                    <TextInput
                      style={styles.colorInput}
                      placeholder="#8b92a7"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={organizationFormData.secondaryColor}
                      onChangeText={(text) => setOrganizationFormData({ ...organizationFormData, secondaryColor: text })}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, submittingOrganization && styles.buttonDisabled]}
                  onPress={handleSubmitOrganization}
                  disabled={submittingOrganization}
                >
                  <Text style={styles.buttonText}>
                    {submittingOrganization ? 'Submitting...' : 'Submit Request'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'space-between',
    },
    headerSection: {
      marginBottom: 24,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    stepDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      textAlign: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      height: 50,
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      height: '100%',
      color: theme.colors.text,
      fontSize: 16,
    },
    clearButton: {
      marginLeft: 8,
      padding: 4,
    },
    optionsScrollView: {
      flex: 1,
    },
    optionsSection: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingVertical: 20,
      paddingHorizontal: 0,
      flexGrow: 1,
    },
    buttonSection: {
      marginTop: 'auto',
      paddingTop: 16,
    },
    buttonSectionInline: {
      marginTop: 'auto',
      paddingTop: 16,
      flexDirection: 'row',
      paddingHorizontal: 0,
    },
    buttonSectionInlineNested: {
      flexDirection: 'row',
      paddingHorizontal: 0,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    universityList: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-start',
      alignSelf: 'center',
      paddingHorizontal: 12,
    },
    universityRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginBottom: 16,
      width: '100%',
      paddingHorizontal: 12,
    },
    universityCard: {
      width: 100,
      backgroundColor: 'transparent',
      borderRadius: 0,
      padding: 0,
      marginHorizontal: 6,
      borderWidth: 0,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: 180,
      position: 'relative',
      overflow: 'visible',
    },
    logoContainer: {
      width: 100,
      height: 100,
      marginBottom: 8,
      alignSelf: 'center',
      flexShrink: 0,
      flexGrow: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      overflow: 'visible',
      position: 'relative',
    },
    logoContainerSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.primary + '15',
    },
    universityLogo: {
      width: 84,
      height: 84,
      flexShrink: 0,
      flexGrow: 0,
    },
    checkIconContainer: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 10,
    },
    universityCardEmpty: {
      width: 100,
      marginHorizontal: 6,
      backgroundColor: 'transparent',
      height: 180,
    },
    universityName: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: 4,
      width: '100%',
    },
    courseList: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-start',
      alignSelf: 'center',
      paddingHorizontal: 12,
    },
    courseRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginBottom: 16,
      width: '100%',
      paddingHorizontal: 12,
    },
    courseCard: {
      width: 100,
      backgroundColor: 'transparent',
      borderRadius: 0,
      padding: 0,
      marginHorizontal: 6,
      borderWidth: 0,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: 120,
      position: 'relative',
      overflow: 'visible',
    },
    courseContainer: {
      width: 100,
      height: 100,
      marginBottom: 8,
      alignSelf: 'center',
      flexShrink: 0,
      flexGrow: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: 'visible',
      position: 'relative',
    },
    courseContainerSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.primary + '15',
    },
    courseCode: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    courseName: {
      fontSize: 10,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      width: '100%',
    },
    courseCardEmpty: {
      width: 100,
      marginHorizontal: 6,
      backgroundColor: 'transparent',
      height: 120,
    },
    organizationList: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-start',
      alignSelf: 'center',
      paddingHorizontal: 12,
    },
    organizationRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginBottom: 16,
      width: '100%',
      paddingHorizontal: 12,
    },
    organizationCard: {
      width: '48%',
      backgroundColor: 'transparent',
      borderRadius: 0,
      padding: 0,
      marginHorizontal: '1%',
      borderWidth: 0,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: 150,
      position: 'relative',
      overflow: 'visible',
    },
    organizationContainer: {
      width: '100%',
      height: 150,
      marginBottom: 8,
      alignSelf: 'center',
      flexShrink: 0,
      flexGrow: 0,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: 'visible',
      position: 'relative',
    },
    organizationContainerSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.primary + '15',
    },
    organizationLogo: {
      width: 40,
      height: 40,
      marginBottom: 4,
      flexShrink: 0,
      flexGrow: 0,
    },
    organizationLogoPlaceholder: {
      width: 40,
      height: 40,
      marginBottom: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.border + '40',
      borderRadius: 8,
    },
    organizationName: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 3,
      width: '100%',
    },
    organizationDescription: {
      fontSize: 10,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 0,
      width: '100%',
      lineHeight: 12,
      flex: 1,
      minHeight: 36,
    },
    memberCountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberCount: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    organizationCardEmpty: {
      width: '48%',
      marginHorizontal: '1%',
      backgroundColor: 'transparent',
      height: 150,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
    },
    addButtonText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '600',
      marginLeft: 8,
    },
    placeholderText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: 24,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      flex: 1,
      marginRight: 12,
    },
    buttonNext: {
      flex: 1,
      marginLeft: 0,
      width: 'auto',
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalKeyboardView: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
    closeButton: {
      padding: 4,
    },
    modalContent: {
      flex: 1,
      padding: 20,
    },
    formDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    formSubLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      lineHeight: 16,
    },
    formInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 16,
    },
    modalFormScroll: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    colorInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    colorPreview: {
      width: 40,
      height: 40,
      borderRadius: 8,
      marginRight: 12,
    },
    colorInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      padding: 12,
    },
    professorInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    professorInput: {
      flex: 1,
      marginBottom: 0,
    },
    addProfessorButton: {
      padding: 4,
    },
    professorsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    professorTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    professorTagText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    removeProfessorButton: {
      padding: 2,
    },
  });
