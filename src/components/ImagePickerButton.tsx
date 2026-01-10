import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
} from 'react-native';
import { ImageService, ImageUploadResult } from '../services/imageService';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface ImagePickerButtonProps {
  onImageSelected: (result: ImageUploadResult) => void;
  onImageRemoved?: () => void;
  existingImageUrl?: string;
  folder?: string;
  label?: string;
}

export default function ImagePickerButton({
  onImageSelected,
  onImageRemoved,
  existingImageUrl,
  folder,
  label = 'Add Image',
}: ImagePickerButtonProps) {
  const { theme } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(existingImageUrl || null);

  const handlePickImage = async () => {
    try {
      const image = await ImageService.pickImage(true, 0.8);
      if (!image) return;

      setUploading(true);
      const result = await ImageService.uploadImage(image.uri, folder);
      setSelectedImage(result.url);
      onImageSelected(result);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const image = await ImageService.takePhoto(true, 0.8);
      if (!image) return;

      setUploading(true);
      const result = await ImageService.uploadImage(image.uri, folder);
      setSelectedImage(result.url);
      onImageSelected(result);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    onImageRemoved?.();
  };

  const showImageOptions = () => {
    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        { text: 'Camera', onPress: handleTakePhoto },
        { text: 'Photo Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const styles = createStyles(theme);

  if (selectedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: selectedImage }} style={styles.image} />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemoveImage}
        >
          <Ionicons name="close-circle" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, uploading && styles.buttonDisabled]}
      onPress={showImageOptions}
      disabled={uploading}
    >
      {uploading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <Ionicons name="image-outline" size={24} color={theme.colors.primary} />
          <Text style={styles.buttonText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      marginBottom: 16,
    },
    image: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
    },
    removeButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      marginBottom: 16,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
  });
