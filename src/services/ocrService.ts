/**
 * OCR Service
 * Extracts text from images using Google Cloud Vision API
 * 
 * Note: For production, this should be done via a backend API to keep the API key secure.
 * For development, you can use the API key directly (not recommended for production).
 */

// Google Cloud Vision API configuration
// Get API key from: https://console.cloud.google.com/apis/credentials
const GOOGLE_VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY || '';
const GOOGLE_VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

export interface OCRResult {
  fullText: string;
  name?: string;
  universityName?: string;
  confidence?: number;
}

export class OCRService {
  /**
   * Convert image URI to base64 (React Native compatible)
   */
  private static async imageUriToBase64(uri: string): Promise<string> {
    // For React Native, use XMLHttpRequest to convert local file URI to base64
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            // Remove data URL prefix if present
            const base64String = reader.result.includes(',') 
              ? reader.result.split(',')[1] 
              : reader.result;
            resolve(base64String);
          } else {
            reject(new Error('Failed to convert image to base64'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log(e);
        reject(new TypeError('Network request failed'));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }

  /**
   * Extract text from image using Google Cloud Vision API
   */
  static async extractText(imageUri: string): Promise<OCRResult> {
    try {
      if (!GOOGLE_VISION_API_KEY) {
        throw new Error('Google Cloud Vision API key not configured. Please set EXPO_PUBLIC_GOOGLE_VISION_API_KEY in your environment variables.');
      }

      // Convert image to base64
      const base64Image = await this.imageUriToBase64(imageUri);

      // Call Google Cloud Vision API
      const response = await fetch(GOOGLE_VISION_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 10,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          `Google Vision API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const textAnnotations = data.responses?.[0]?.textAnnotations || [];

      if (textAnnotations.length === 0) {
        return {
          fullText: '',
        };
      }

      // First annotation contains the full text
      const fullText = textAnnotations[0].description || '';

      // Extract potential name and university name from text
      // This is a simple heuristic - can be improved with ML/NLP
      const extractedName = this.extractName(fullText);
      const extractedUniversity = this.extractUniversityName(fullText);

      return {
        fullText,
        name: extractedName,
        universityName: extractedUniversity,
        confidence: 0.8, // Google Vision doesn't provide confidence for full text, estimate
      };
    } catch (error: any) {
      console.error('OCR extraction error:', error);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  /**
   * Extract name from OCR text (heuristic approach)
   * Looks for patterns like "Name:", "Student:", "ID:", etc.
   */
  private static extractName(text: string): string | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Common patterns for name on ID cards
    const namePatterns = [
      /name[:]\s*(.+)/i,
      /student[:]\s*(.+)/i,
      /id[:]\s*(.+)/i,
      /holder[:]\s*(.+)/i,
    ];

    for (const line of lines) {
      for (const pattern of namePatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    // If no pattern found, try to find the longest line that looks like a name
    // (typically 2-4 words, capital letters)
    const nameLikeLines = lines.filter(line => {
      const words = line.split(/\s+/);
      return words.length >= 2 && 
             words.length <= 4 && 
             /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(line);
    });

    if (nameLikeLines.length > 0) {
      // Return the first name-like line
      return nameLikeLines[0];
    }

    return undefined;
  }

  /**
   * Extract university name from OCR text (heuristic approach)
   * Looks for patterns like "University", "College", etc.
   */
  private static extractUniversityName(text: string): string | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Common patterns for university on ID cards
    const universityPatterns = [
      /university[:]\s*(.+)/i,
      /college[:]\s*(.+)/i,
      /school[:]\s*(.+)/i,
      /institution[:]\s*(.+)/i,
    ];

    for (const line of lines) {
      for (const pattern of universityPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    // Look for lines containing "University", "College", "U of", etc.
    const universityKeywords = ['university', 'college', 'u of', 'uc ', 'state', 'tech'];
    const universityLines = lines.filter(line => 
      universityKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    if (universityLines.length > 0) {
      return universityLines[0];
    }

    return undefined;
  }
}
