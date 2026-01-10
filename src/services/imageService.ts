/**
 * Image Upload Service
 * 
 * Free alternatives to Firebase Storage:
 * 1. AWS S3 (Recommended) - 5GB free storage, 20K GET requests/month
 * 2. Cloudinary - 25GB free storage, 25GB bandwidth/month
 * 3. Supabase Storage - 1GB free storage
 * 4. Base64 in Firestore - For small images only (1MB limit)
 * 
 * This service supports multiple providers. Choose one and configure it below.
 */

import * as ImagePicker from 'expo-image-picker';
import { ImageInfo } from 'expo-image-picker';
import { S3Service } from './s3Service';

export type ImageUploadProvider = 's3' | 'cloudinary' | 'supabase' | 'base64' | 'imgbb';

export interface ImageUploadResult {
  url: string;
  publicId?: string; // For Cloudinary
  width?: number;
  height?: number;
}

/**
 * AWS S3 Configuration
 * Free Tier: 5GB storage, 20K GET requests, 2K PUT requests/month
 * Sign up at https://aws.amazon.com/s3/
 * 
 * Option 1: Direct Upload (Less Secure - credentials in app)
 * Option 2: Presigned URLs (More Secure - requires backend API)
 */
const S3_CONFIG = {
  // Option 1: Direct upload (for development/testing)
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
  bucket: process.env.EXPO_PUBLIC_S3_BUCKET || 'your-bucket-name',
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '', // Not recommended for production
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '', // Not recommended for production
  
  // Option 2: Presigned URL endpoint (recommended for production)
  // Create a backend API endpoint that generates presigned URLs
  presignedUrlEndpoint: process.env.EXPO_PUBLIC_PRESIGNED_URL_API || '', 
  // Example: 'https://your-api.com/api/upload/presigned-url'
};

/**
 * Cloudinary Configuration
 * Sign up at https://cloudinary.com (free tier available)
 * Get your credentials from Dashboard
 */
const CLOUDINARY_CONFIG = {
  cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME',
  uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'YOUR_UPLOAD_PRESET',
  apiKey: process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY || 'YOUR_API_KEY', // Optional, for signed uploads
};

/**
 * Supabase Configuration
 * Sign up at https://supabase.com (free tier available)
 */
const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY',
  bucket: 'images', // Create this bucket in Supabase Storage
};

/**
 * ImgBB Configuration (No signup required, but has limits)
 * Get API key from https://api.imgbb.com
 */
const IMGBB_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_IMGBB_API_KEY || 'YOUR_IMGBB_API_KEY',
};

// Current provider (change this to switch providers)
const CURRENT_PROVIDER: ImageUploadProvider = 's3';

export class ImageService {
  /**
   * Request permissions to access camera/photo library
   */
  static async requestPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      return cameraStatus.status === 'granted';
    }
    return true;
  }

  /**
   * Pick an image from the device
   */
  static async pickImage(
    allowsEditing: boolean = true,
    quality: number = 0.8
  ): Promise<ImageInfo | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Permission to access camera roll is required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing,
      aspect: [4, 3],
      quality,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  }

  /**
   * Take a photo with the camera
   */
  static async takePhoto(
    allowsEditing: boolean = true,
    quality: number = 0.8
  ): Promise<ImageInfo | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Permission to access camera is required');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing,
      aspect: [4, 3],
      quality,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  }

  /**
   * Upload image using the configured provider
   */
  static async uploadImage(
    imageUri: string,
    folder?: string,
    provider?: ImageUploadProvider
  ): Promise<ImageUploadResult> {
    const selectedProvider = provider || CURRENT_PROVIDER;

    switch (selectedProvider) {
      case 's3':
        return this.uploadToS3(imageUri, folder);
      case 'cloudinary':
        return this.uploadToCloudinary(imageUri, folder);
      case 'supabase':
        return this.uploadToSupabase(imageUri, folder);
      case 'imgbb':
        return this.uploadToImgBB(imageUri);
      case 'base64':
        return this.uploadToBase64(imageUri);
      default:
        throw new Error(`Unknown image provider: ${selectedProvider}`);
    }
  }

  /**
   * Upload to AWS S3 (Recommended - Free tier: 5GB storage, 20K GET requests/month)
   * Supports both direct upload and presigned URL methods
   */
  private static async uploadToS3(
    imageUri: string,
    folder?: string
  ): Promise<ImageUploadResult> {
    // Method 1: Use presigned URL (recommended for production)
    if (S3_CONFIG.presignedUrlEndpoint) {
      return this.uploadToS3WithPresignedUrl(imageUri, folder);
    }

    // Method 2: Direct upload (for development/testing)
    if (!S3_CONFIG.accessKeyId || !S3_CONFIG.secretAccessKey) {
      throw new Error(
        'AWS S3 credentials not configured. Set EXPO_PUBLIC_AWS_ACCESS_KEY_ID and EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY, or configure presigned URL endpoint.'
      );
    }

    return this.uploadToS3Direct(imageUri, folder);
  }

  /**
   * Upload to S3 using presigned URL (Secure - recommended)
   * Option 1: Use backend API endpoint (most secure)
   * Option 2: Generate presigned URL client-side (requires AWS credentials)
   */
  private static async uploadToS3WithPresignedUrl(
    imageUri: string,
    folder?: string
  ): Promise<ImageUploadResult> {
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = folder ? `${folder}/${fileName}` : fileName;

    let presignedUrl: string;
    let publicUrl: string;

    // Option 1: Get presigned URL from backend API (recommended)
    if (S3_CONFIG.presignedUrlEndpoint) {
      const presignedResponse = await fetch(S3_CONFIG.presignedUrlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          contentType: 'image/jpeg',
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get presigned URL from backend');
      }

      const data = await presignedResponse.json();
      presignedUrl = data.presignedUrl;
      publicUrl = data.url || presignedUrl.split('?')[0];
    } else {
      // Option 2: Generate presigned URL client-side (requires AWS credentials)
      if (!S3_CONFIG.accessKeyId || !S3_CONFIG.secretAccessKey) {
        throw new Error(
          'AWS credentials not configured. Set credentials or configure presigned URL endpoint.'
        );
      }

      const result = await S3Service.generatePresignedUploadUrl(key, 'image/jpeg');
      presignedUrl = result.presignedUrl;
      publicUrl = result.url;
    }

    // Upload image to S3 using presigned URL
    await S3Service.uploadWithPresignedUrl(imageUri, presignedUrl);

    return { url: publicUrl };
  }

  /**
   * Upload to S3 directly (Less secure - credentials in app)
   * Only use for development/testing
   */
  private static async uploadToS3Direct(
    imageUri: string,
    folder?: string
  ): Promise<ImageUploadResult> {
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const key = folder ? `${folder}/${fileName}` : fileName;

    try {
      const url = await S3Service.uploadDirect(imageUri, key, 'image/jpeg');
      return { url };
    } catch (error: any) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Upload to Cloudinary (Recommended - Free tier: 25GB storage, 25GB bandwidth/month)
   */
  private static async uploadToCloudinary(
    imageUri: string,
    folder?: string
  ): Promise<ImageUploadResult> {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    if (folder) {
      formData.append('folder', folder);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload image to Cloudinary');
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
    };
  }

  /**
   * Upload to Supabase Storage (Free tier: 1GB storage)
   */
  private static async uploadToSupabase(
    imageUri: string,
    folder?: string
  ): Promise<ImageUploadResult> {
    // Read image as blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const fileName = `${Date.now()}.jpg`;
    const path = folder ? `${folder}/${fileName}` : fileName;

    const uploadResponse = await fetch(
      `${SUPABASE_CONFIG.url}/storage/v1/object/${SUPABASE_CONFIG.bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': blob.type,
        },
        body: blob,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image to Supabase');
    }

    const url = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.bucket}/${path}`;
    return { url };
  }

  /**
   * Upload to ImgBB (Free, no signup, but has rate limits)
   */
  private static async uploadToImgBB(imageUri: string): Promise<ImageUploadResult> {
    const formData = new FormData();
    formData.append('key', IMGBB_CONFIG.apiKey);
    
    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    formData.append('image', base64);

    const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image to ImgBB');
    }

    const data = await uploadResponse.json();
    return {
      url: data.data.url,
      width: data.data.width,
      height: data.data.height,
    };
  }

  /**
   * Convert to Base64 and store in Firestore (For small images only, <1MB)
   * Not recommended for production, but free and simple
   */
  private static async uploadToBase64(imageUri: string): Promise<ImageUploadResult> {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    if (blob.size > 1000000) { // 1MB limit
      throw new Error('Image too large for Base64. Use Cloudinary or Supabase instead.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          url: reader.result as string, // Base64 data URL
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Delete image (supports S3 and Cloudinary)
   */
  static async deleteImage(identifier: string): Promise<void> {
    if (CURRENT_PROVIDER === 's3') {
      // identifier should be the S3 key
      await S3Service.deleteImage(identifier);
    } else if (CURRENT_PROVIDER === 'cloudinary') {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public_id: identifier,
            api_key: CLOUDINARY_CONFIG.apiKey,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
    } else {
      console.warn(`Delete not supported for provider: ${CURRENT_PROVIDER}`);
    }
  }
}
