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
import { ImageService, ImageUploadResult } from '../services/imageService';
import ImagePickerButton from '../components/ImagePickerButton';
import { Ionicons } from '@expo/vector-icons';
import { Course, Organization } from '../types';

// Predefined tags (10 total)
const PREDEFINED_TAGS = [
  'Question',
  'General',
  'Professor',
  'Course',
  'Study',
  'Exam',
  'Assignment',
  'Organization',
  'Event',
  'Announcement',
];

export default function CreateDiscussionScreen({ route, navigation }: any) {
  const { courseId, organizationId, isPrivate } = route.params || {};
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Association state
  const [associationType, setAssociationType] = useState<'general' | 'course' | 'organization'>(
    courseId ? 'course' : organizationId ? 'organization' : 'general'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || '');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(organizationId || '');
  const [courses, setCourses] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);

  useEffect(() => {
    if (userData?.university) {
      if (associationType === 'course') {
        loadCourses();
      } else if (associationType === 'organization') {
        loadOrganizations();
      }
    }
  }, [associationType, userData]);

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

  const loadOrganizations = async () => {
    setLoadingOrganizations(true);
    try {
      const allOrganizations = await DatabaseService.getOrganizations();
      setOrganizations(allOrganizations.map(org => ({ id: org.id, name: org.name })));
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoadingOrganizations(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      if (selectedTags.length < 5) { // Limit to 5 tags
        setSelectedTags([...selectedTags, tag]);
      } else {
        Alert.alert('Limit Reached', 'You can select up to 5 tags');
      }
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter content');
      return;
    }

    if (selectedTags.length === 0) {
      Alert.alert('Error', 'Please select at least one tag');
      return;
    }

    // Only validate association if coming from bulletin (not already in course/club context)
    // If courseId or organizationId is provided in route params, use those directly (no validation needed)
    if (!courseId && !organizationId) {
      if (associationType === 'course' && !selectedCourseId) {
        Alert.alert('Error', 'Please select a course');
        return;
      }

      if (associationType === 'organization' && !selectedOrganizationId) {
        Alert.alert('Error', 'Please select an organization');
        return;
      }
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setLoading(true);
    try {
      // Use the association type to set courseId or organizationId
      // If courseId or organizationId is provided in route params (from course/club pages), use those directly
      // Otherwise, use the selected values from the association section
      let finalCourseId: string | undefined;
      let finalOrganizationId: string | undefined;
      
      if (courseId) {
        // Coming from course page - use the courseId from route params
        finalCourseId = courseId;
        finalOrganizationId = undefined;
      } else if (organizationId) {
        // Coming from club/organization page - use the organizationId from route params
        finalOrganizationId = organizationId;
        finalCourseId = undefined;
      } else {
        // Coming from bulletin page - use association type selection
        if (associationType === 'course') {
          finalCourseId = selectedCourseId;
          finalOrganizationId = undefined;
        } else if (associationType === 'organization') {
          finalOrganizationId = selectedOrganizationId;
          finalCourseId = undefined;
        } else {
          // General - no courseId or organizationId
          finalCourseId = undefined;
          finalOrganizationId = undefined;
        }
      }
      
      // isPrivate is only true if explicitly set from route params (for course private discussions)
      // General discussions are never private
      const finalIsPrivate = (isPrivate === true);

      // Normalize courseId and organizationId (trim to ensure consistency)
      const normalizedCourseId = finalCourseId?.trim() || undefined;
      const normalizedOrganizationId = finalOrganizationId?.trim() || undefined;
      
      const discussionId = await DatabaseService.createDiscussion({
        userId: user.uid,
        title: title.trim(),
        content: content.trim(),
        tags: selectedTags,
        images: images.length > 0 ? images : undefined,
        courseId: normalizedCourseId,
        organizationId: normalizedOrganizationId,
        isPrivate: finalIsPrivate || false,
        upvotes: [],
        downvotes: [],
        comments: [],
        score: 0,
        controversy: 0,
      });
      
      Alert.alert('Success', 'Discussion created!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create discussion');
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
            Create Discussion
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Share your thoughts with the community
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Enter discussion title"
            placeholderTextColor={theme.colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Content <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="What's on your mind?"
            placeholderTextColor={theme.colors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>

        {/* Association Section - Only show if not already in course/club context */}
        {!courseId && !organizationId && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Association <Text style={styles.required}>*</Text></Text>
            <Text style={[styles.requiredLabel, { color: theme.colors.textSecondary }]}>
              Select where this discussion belongs
            </Text>
            
            <View style={styles.associationButtons}>
              <TouchableOpacity
                style={[
                  styles.associationButton,
                  associationType === 'general' && styles.associationButtonSelected,
                  { borderColor: theme.colors.border },
                  associationType === 'general' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                ]}
                onPress={() => {
                  setAssociationType('general');
                  setSelectedCourseId('');
                  setSelectedOrganizationId('');
                }}
              >
                <Text style={[
                  styles.associationButtonText,
                  { color: theme.colors.text },
                  associationType === 'general' && { color: theme.colors.primary, fontWeight: '600' },
                ]}>
                  General
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.associationButton,
                  associationType === 'course' && styles.associationButtonSelected,
                  { borderColor: theme.colors.border },
                  associationType === 'course' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                ]}
                onPress={() => {
                  setAssociationType('course');
                  setSelectedOrganizationId('');
                  if (!courses.length && userData?.university) {
                    loadCourses();
                  }
                }}
              >
                <Text style={[
                  styles.associationButtonText,
                  { color: theme.colors.text },
                  associationType === 'course' && { color: theme.colors.primary, fontWeight: '600' },
                ]}>
                  Course
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.associationButton,
                  associationType === 'organization' && styles.associationButtonSelected,
                  { borderColor: theme.colors.border },
                  associationType === 'organization' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                ]}
                onPress={() => {
                  setAssociationType('organization');
                  setSelectedCourseId('');
                  if (!organizations.length) {
                    loadOrganizations();
                  }
                }}
              >
                <Text style={[
                  styles.associationButtonText,
                  { color: theme.colors.text },
                  associationType === 'organization' && { color: theme.colors.primary, fontWeight: '600' },
                ]}>
                  Organization
                </Text>
              </TouchableOpacity>
            </View>

            {/* Course Selection */}
            {associationType === 'course' && (
              <View style={styles.selectionContainer}>
                <Text style={[styles.selectionLabel, { color: theme.colors.text }]}>Select Course <Text style={styles.required}>*</Text></Text>
                {loadingCourses ? (
                  <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Loading courses...</Text>
                ) : courses.length === 0 ? (
                  <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>No courses available</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursesScroll}>
                    {courses.map((course) => (
                      <TouchableOpacity
                        key={course.id}
                        style={[
                          styles.courseButton,
                          selectedCourseId === course.id && styles.courseButtonSelected,
                          { borderColor: theme.colors.border },
                          selectedCourseId === course.id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                        ]}
                        onPress={() => setSelectedCourseId(course.id)}
                      >
                        <Text style={[
                          styles.courseButtonText,
                          { color: theme.colors.text },
                          selectedCourseId === course.id && { color: theme.colors.primary, fontWeight: '600' },
                        ]}>
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
            )}

            {/* Organization Selection */}
            {associationType === 'organization' && (
              <View style={styles.selectionContainer}>
                <Text style={[styles.selectionLabel, { color: theme.colors.text }]}>Select Organization <Text style={styles.required}>*</Text></Text>
                {loadingOrganizations ? (
                  <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Loading organizations...</Text>
                ) : organizations.length === 0 ? (
                  <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>No organizations available</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursesScroll}>
                    {organizations.map((org) => (
                      <TouchableOpacity
                        key={org.id}
                        style={[
                          styles.courseButton,
                          selectedOrganizationId === org.id && styles.courseButtonSelected,
                          { borderColor: theme.colors.border },
                          selectedOrganizationId === org.id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                        ]}
                        onPress={() => setSelectedOrganizationId(org.id)}
                      >
                        <Text style={[
                          styles.courseButtonText,
                          { color: theme.colors.text },
                          selectedOrganizationId === org.id && { color: theme.colors.primary, fontWeight: '600' },
                        ]}>
                          {org.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {organizations.length > 0 && !selectedOrganizationId && (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    Please select an organization
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Tags Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags <Text style={styles.required}>*</Text></Text>
          <Text style={[styles.requiredLabel, { color: theme.colors.textSecondary }]}>
            Select at least one tag (up to 5)
          </Text>
          <View style={styles.tagsContainer}>
            {PREDEFINED_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  selectedTags.includes(tag) && styles.tagSelected,
                  { borderColor: theme.colors.border },
                  selectedTags.includes(tag) && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[
                  styles.tagText,
                  { color: theme.colors.text },
                  selectedTags.includes(tag) && { color: theme.colors.primary, fontWeight: '600' },
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedTags.length === 0 && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              Please select at least one tag
            </Text>
          )}
        </View>

        {/* Images Section (Optional) - Only show if images exist */}
        {images.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Images (Optional)</Text>
            {images.map((imageUrl, index) => (
              <ImagePickerButton
                key={index}
                existingImageUrl={imageUrl}
                onImageSelected={(result) => {
                  const newImages = [...images];
                  newImages[index] = result.url;
                  setImages(newImages);
                }}
                onImageRemoved={() => {
                  setImages(images.filter((_, i) => i !== index));
                }}
                folder="discussions"
              />
            ))}
            {images.length < 5 && (
              <ImagePickerButton
                onImageSelected={(result) => {
                  setImages([...images, result.url]);
                }}
                folder="discussions"
                label="Add Image"
              />
            )}
          </View>
        )}
        
        {/* Simple button to add first image when no images exist (optional) */}
        {images.length === 0 && (
          <ImagePickerButton
            onImageSelected={(result) => {
              setImages([result.url]);
            }}
            folder="discussions"
            label="Add Image (Optional)"
          />
        )}


        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.colors.primary },
            (loading || !title.trim() || !content.trim() || selectedTags.length === 0 || 
             (!courseId && !organizationId && associationType === 'course' && !selectedCourseId) ||
             (!courseId && !organizationId && associationType === 'organization' && !selectedOrganizationId)) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={loading || !title.trim() || !content.trim() || selectedTags.length === 0 || 
                   (!courseId && !organizationId && associationType === 'course' && !selectedCourseId) ||
                   (!courseId && !organizationId && associationType === 'organization' && !selectedOrganizationId)}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Creating...' : 'Create Discussion'}
          </Text>
        </TouchableOpacity>
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
    required: {
      color: theme.colors.error || '#ff4444',
    },
    requiredLabel: {
      fontSize: 12,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
    },
    textArea: {
      minHeight: 150,
      paddingTop: 16,
      textAlignVertical: 'top',
    },
    associationButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    associationButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    associationButtonSelected: {
      borderWidth: 2,
    },
    associationButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    selectionContainer: {
      marginTop: 16,
    },
    selectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    helperText: {
      fontSize: 12,
      marginTop: 4,
    },
    errorText: {
      fontSize: 12,
      marginTop: 8,
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
      backgroundColor: theme.colors.background,
    },
    courseButtonSelected: {
      borderWidth: 2,
    },
    courseButtonText: {
      fontSize: 14,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
      gap: 8,
    },
    tag: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 8,
      backgroundColor: theme.colors.background,
    },
    tagSelected: {
      borderWidth: 2,
    },
    tagText: {
      fontSize: 14,
      fontWeight: '500',
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
  });
