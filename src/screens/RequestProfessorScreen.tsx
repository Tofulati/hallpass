import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { ImageUploadResult } from '../services/imageService';
import ImagePickerButton from '../components/ImagePickerButton';
import { Ionicons } from '@expo/vector-icons';

export default function RequestProfessorScreen({ route, navigation }: any) {
  const { courseId } = route.params || {};
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [courses, setCourses] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(courseId ? [courseId] : []);
  const [university, setUniversity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    loadUniversity();
    loadCourses();
  }, [userData]);

  const loadUniversity = async () => {
    if (!userData?.university) return;
    
    try {
      const universityId = typeof userData.university === 'string' 
        ? userData.university 
        : userData.university.id;
      
      const uni = await DatabaseService.getUniversity(universityId);
      setUniversity(uni);
    } catch (error) {
      console.error('Error loading university:', error);
    }
  };

  const loadCourses = async () => {
    if (!userData?.university) return;
    
    setLoadingCourses(true);
    try {
      const universityId = typeof userData.university === 'string' 
        ? userData.university 
        : userData.university.id;
      
      const allCourses = await DatabaseService.getCourses(universityId);
      setCourses(allCourses.map(c => ({ id: c.id, code: c.code, name: c.name })));
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    if (selectedCourses.includes(courseId)) {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
    } else {
      setSelectedCourses([...selectedCourses, courseId]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter the professor\'s name');
      return;
    }

    if (!user || !userData?.university) {
      Alert.alert('Error', 'You must be logged in and enrolled in a university');
      return;
    }

    const universityId = typeof userData.university === 'string' 
      ? userData.university 
      : userData.university.id;

    setLoading(true);
    try {
      await DatabaseService.requestProfessor({
        name: name.trim(),
        email: email.trim() || undefined,
        image: image || undefined,
        universityId,
        courseIds: selectedCourses.length > 0 ? selectedCourses : undefined,
      }, user.uid);

      Alert.alert('Success', 'Professor request submitted! It will be added when 100 requests are received.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit professor request');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: 40, paddingHorizontal: 16 }]}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Request Add Professor
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Help build the database by requesting to add a professor
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Professor Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Enter professor's full name"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
            maxLength={200}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Email (Optional)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Enter professor's email"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={200}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Image (Optional)
          </Text>
          <ImagePickerButton
            existingImageUrl={image || undefined}
            onImageSelected={(result: ImageUploadResult) => {
              setImage(result.url);
            }}
            onImageRemoved={() => {
              setImage(null);
            }}
            folder="professors"
            label="Add Professor Image"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            University
          </Text>
          <View style={[styles.input, styles.readOnlyInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]}>
              {university?.name || 'Loading...'}
            </Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Courses (Optional)
          </Text>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
            Select courses this professor teaches
          </Text>
          {loadingCourses ? (
            <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
              Loading courses...
            </Text>
          ) : courses.length === 0 ? (
            <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
              No courses available
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursesScroll}>
              {courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[
                    styles.courseButton,
                    selectedCourses.includes(course.id) && styles.courseButtonSelected,
                    { borderColor: theme.colors.border },
                    selectedCourses.includes(course.id) && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                  ]}
                  onPress={() => toggleCourse(course.id)}
                >
                  <Text
                    style={[
                      styles.courseButtonText,
                      { color: theme.colors.text },
                      selectedCourses.includes(course.id) && { color: theme.colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {course.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Professors are added automatically when 100 requests are received. Duplicate requests (same name, same university) are merged.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.colors.primary },
            (!name.trim() || loading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!name.trim() || loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: 100,
    },
    headerSection: {
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 22,
    },
    inputContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    required: {
      color: theme.colors.error || '#ff4444',
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.cardBackground || theme.colors.background,
    },
    infoText: {
      flex: 1,
      marginLeft: 12,
      fontSize: 14,
      lineHeight: 20,
    },
    submitButton: {
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    readOnlyInput: {
      justifyContent: 'center',
      paddingVertical: 16,
    },
    readOnlyText: {
      fontSize: 16,
    },
    helperText: {
      fontSize: 14,
      marginTop: 4,
    },
    coursesScroll: {
      marginTop: 8,
    },
    courseButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      marginRight: 8,
    },
    courseButtonSelected: {
      borderWidth: 2,
    },
    courseButtonText: {
      fontSize: 14,
    },
  });
}
