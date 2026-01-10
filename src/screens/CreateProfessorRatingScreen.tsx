import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DatabaseService } from '../services/databaseService';
import { Professor } from '../types';

export default function CreateProfessorRatingScreen({ route, navigation }: any) {
  const { professorId } = route.params;
  const { userData } = useAuth();
  const { theme } = useTheme();
  
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [enjoyment, setEnjoyment] = useState<number | null>(null);
  const [understandability, setUnderstandability] = useState<number | null>(null);
  const [retake, setRetake] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  useEffect(() => {
    loadProfessor();
    loadUserCourses();
  }, [professorId]);

  const loadProfessor = async () => {
    try {
      const prof = await DatabaseService.getProfessor(professorId);
      setProfessor(prof);
    } catch (error) {
      console.error('Error loading professor:', error);
      Alert.alert('Error', 'Failed to load professor information');
    }
  };

  const loadUserCourses = async () => {
    if (!userData?.university) return;
    
    try {
      const universityId = typeof userData.university === 'string' 
        ? userData.university 
        : userData.university.id;
      
      const allCourses = await DatabaseService.getCourses(universityId);
      
      // Try to filter courses taught by this professor
      let profCourses = allCourses.filter(course => 
        course.professors.some(prof => prof.id === professorId || prof.name === professor?.name)
      );
      
      // If no courses found for this professor, show all courses (professor might be new)
      if (profCourses.length === 0) {
        profCourses = allCourses;
      }
      
      setCourses(profCourses.map(c => ({ id: c.id, code: c.code, name: c.name })));
      
      if (profCourses.length === 1) {
        setSelectedCourseId(profCourses[0].id);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const handleSubmit = async () => {
    if (!userData?.id) {
      Alert.alert('Error', 'You must be logged in to rate a professor');
      return;
    }

    if (!selectedCourseId) {
      Alert.alert('Error', 'Please select a course');
      return;
    }

    // Validate all required fields
    if (difficulty === null || difficulty < 1 || difficulty > 5) {
      Alert.alert('Error', 'Please provide a difficulty rating (1-5)');
      return;
    }

    if (enjoyment === null || enjoyment < 1 || enjoyment > 5) {
      Alert.alert('Error', 'Please provide an enjoyment rating (1-5)');
      return;
    }

    if (understandability === null || understandability < 1 || understandability > 5) {
      Alert.alert('Error', 'Please provide an understandability rating (1-5)');
      return;
    }

    if (retake === null) {
      Alert.alert('Error', 'Please indicate whether you would retake this course');
      return;
    }

    if (!text.trim()) {
      Alert.alert('Error', 'Please provide a review');
      return;
    }

    // Calculate overall rating from: inverted difficulty (low is good), enjoyment, understandability, retake
    // Invert difficulty: (6 - difficulty) / 5 * 5 = 6 - difficulty, then normalize to 1-5
    const invertedDifficulty = 6 - difficulty; // 1 becomes 5, 5 becomes 1
    const retakeScore = retake ? 5 : 1; // true = 5, false = 1
    
    // Average all four metrics
    const totalRating = (invertedDifficulty + enjoyment + understandability + retakeScore) / 4;

    setSubmitting(true);
    try {
      await DatabaseService.createProfessorRating(professorId, {
        userId: anonymous ? undefined : userData.id,
        courseId: selectedCourseId,
        totalRating,
        difficulty,
        enjoyment,
        retake,
        understandability,
        text: text.trim(),
        anonymous,
        upvotes: [],
        downvotes: [],
      });
      
      Alert.alert('Success', 'Rating submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', error.message || 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRatingSelector = (
    label: string,
    value: number,
    setValue: (value: number) => void,
    reverseColor?: boolean
  ) => {
    const isRequired = true; // All rating fields are required
    const getColor = (rating: number) => {
      const adjustedRating = reverseColor ? (5 - rating + 1) : rating;
      if (adjustedRating >= 4) return '#10b981'; // Green
      if (adjustedRating >= 3) return '#f59e0b'; // Orange
      return '#ef4444'; // Red
    };

    return (
      <View style={styles.ratingSelector}>
        <Text style={[styles.ratingLabel, { color: theme.colors.text }]}>
          {label} {isRequired && '*'}
        </Text>
        <View style={styles.ratingRow}>
          <View style={styles.ratingButtons}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                style={[
                  styles.ratingButton,
                  value === rating && {
                    backgroundColor: getColor(rating),
                    borderColor: getColor(rating),
                  },
                  { borderColor: theme.colors.border },
                ]}
                onPress={() => setValue(rating)}
              >
                <Text
                  style={[
                    styles.ratingButtonText,
                    { color: value === rating ? '#FFFFFF' : theme.colors.text },
                  ]}
                >
                  {rating}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.ratingValue, { color: getColor(value) }]}>
            {value}/5
          </Text>
        </View>
      </View>
    );
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={true}
      >
        {professor && (
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Rate {professor.name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Help other students by sharing your experience
            </Text>
          </View>
        )}

        {/* Course Selection */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Course *</Text>
          <Text style={[styles.requiredLabel, { color: theme.colors.textSecondary }]}>
            Required
          </Text>
          {courses.length === 0 ? (
            <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
              No courses found for this professor. You can still submit a rating.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[
                    styles.courseButton,
                    selectedCourseId === course.id && styles.courseButtonSelected,
                    { borderColor: theme.colors.border },
                    selectedCourseId === course.id && { borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setSelectedCourseId(course.id)}
                >
                  <Text
                    style={[
                      styles.courseButtonText,
                      { color: theme.colors.text },
                      selectedCourseId === course.id && { color: theme.colors.primary },
                    ]}
                  >
                    {course.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {courses.length > 0 && !selectedCourseId && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              Please select a course
            </Text>
          )}
        </View>

        {/* Rating Selectors */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ratings *</Text>
          <Text style={[styles.requiredLabel, { color: theme.colors.textSecondary }]}>
            All fields are required
          </Text>
          
          {renderRatingSelector('Difficulty', difficulty ?? 3, (val) => setDifficulty(val), true)}
          {renderRatingSelector('Enjoyment', enjoyment ?? 3, (val) => setEnjoyment(val))}
          {renderRatingSelector('Understandability', understandability ?? 3, (val) => setUnderstandability(val))}
        </View>

        {/* Retake Toggle */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Would Retake *</Text>
          <Text style={[styles.requiredLabel, { color: theme.colors.textSecondary }]}>
            Required
          </Text>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
            Would you take another course with this professor?
          </Text>
          <View style={styles.retakeButtons}>
            <TouchableOpacity
              style={[
                styles.retakeButton,
                retake === true && { borderColor: '#10b981', backgroundColor: '#10b981' },
                { borderColor: theme.colors.border },
              ]}
              onPress={() => setRetake(true)}
            >
              <Text style={[
                styles.retakeButtonText,
                { color: retake === true ? '#FFFFFF' : theme.colors.text },
              ]}>
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.retakeButton,
                retake === false && { borderColor: '#ef4444', backgroundColor: '#ef4444' },
                { borderColor: theme.colors.border },
              ]}
              onPress={() => setRetake(false)}
            >
              <Text style={[
                styles.retakeButtonText,
                { color: retake === false ? '#FFFFFF' : theme.colors.text },
              ]}>
                No
              </Text>
            </TouchableOpacity>
          </View>
          {retake === null && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              Please select Yes or No
            </Text>
          )}
        </View>

        {/* Review Text */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Review *</Text>
            <View style={styles.anonymousRow}>
              <Text style={[styles.anonymousLabel, { color: theme.colors.text }]}>Post Anonymously</Text>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          <Text style={[styles.requiredLabel, { color: theme.colors.textSecondary }]}>
            Required
          </Text>
          <TextInput
            style={[styles.textInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Share your experience with this professor..."
            placeholderTextColor={theme.colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          {!text.trim() && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              Please provide a review
            </Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.colors.primary },
            (submitting || !selectedCourseId || difficulty === null || enjoyment === null || understandability === null || retake === null || !text.trim()) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={submitting || !selectedCourseId || difficulty === null || enjoyment === null || understandability === null || retake === null || !text.trim()}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    headerSection: {
      marginBottom: 24,
      paddingTop: 40,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
    },
    section: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    anonymousRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    anonymousLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    requiredLabel: {
      fontSize: 12,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    ratingSelector: {
      marginBottom: 20,
    },
    ratingLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 12,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ratingButtons: {
      flexDirection: 'row',
      gap: 8,
      flex: 1,
    },
    ratingButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ratingButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    ratingValue: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 12,
    },
    courseButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: 8,
      backgroundColor: theme.colors.background,
    },
    courseButtonSelected: {
      backgroundColor: theme.colors.primary + '20',
    },
    courseButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    retakeButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    retakeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 20,
      borderWidth: 2,
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    retakeButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    helperText: {
      fontSize: 12,
      marginTop: 4,
    },
    errorText: {
      fontSize: 12,
      marginTop: 8,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    submitButton: {
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
