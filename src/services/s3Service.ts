/**
 * AWS S3 Service
 * Handles S3 uploads with proper AWS SDK integration
 * 
 * For production, use presigned URLs from a backend API.
 * For development, you can use direct uploads with credentials.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3_CONFIG = {
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
  bucket: process.env.EXPO_PUBLIC_S3_BUCKET || 'your-bucket-name',
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
};

// Initialize S3 client
const s3Client = new S3Client({
  region: S3_CONFIG.region,
  credentials: S3_CONFIG.accessKeyId && S3_CONFIG.secretAccessKey
    ? {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      }
    : undefined,
});

export class S3Service {
  /**
   * Generate a presigned URL for uploading
   * This can be done client-side or server-side (server-side recommended)
   */
  static async generatePresignedUploadUrl(
    key: string,
    contentType: string = 'image/jpeg',
    expiresIn: number = 3600
  ): Promise<{ presignedUrl: string; url: string }> {
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    const url = `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;

    return { presignedUrl, url };
  }

  /**
   * Upload image to S3 using presigned URL
   */
  static async uploadWithPresignedUrl(
    imageUri: string,
    presignedUrl: string
  ): Promise<void> {
    const response = await fetch(imageUri);
    const blob = await response.blob();

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to S3: ${uploadResponse.statusText}`);
    }
  }

  /**
   * Upload image directly to S3 (requires credentials)
   * Only use for development/testing
   * Note: Direct upload in React Native requires converting blob to ArrayBuffer
   */
  static async uploadDirect(
    imageUri: string,
    key: string,
    contentType: string = 'image/jpeg'
  ): Promise<string> {
    if (!S3_CONFIG.accessKeyId || !S3_CONFIG.secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    // Fetch image and convert to ArrayBuffer for React Native compatibility
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
      Body: arrayBuffer as any, // AWS SDK accepts ArrayBuffer in React Native
      ContentType: contentType,
    });

    await s3Client.send(command);

    return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
  }

  /**
   * Delete image from S3
   */
  static async deleteImage(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Get public URL for an S3 object
   */
  static getPublicUrl(key: string): string {
    return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
  }
}
