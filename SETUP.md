# HallPass Setup Guide

Complete setup and build instructions for HallPass.

## Prerequisites

- Node.js (v16 or higher) - [Download](https://nodejs.org/)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- Firebase account ([firebase.google.com](https://firebase.google.com))
- AWS account ([aws.amazon.com](https://aws.amazon.com)) - for S3 image storage
- Expo account ([expo.dev](https://expo.dev)) - for production builds

For mobile development:
- **iOS**: Xcode (Mac only)
- **Android**: Android Studio

## Step 1: Install Dependencies

```bash
cd /Users/albert/Documents/hallpass
npm install
```

If you encounter permission errors:
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

**Note**: You may see vulnerability warnings after installation. These are common in React Native projects and are typically safe for development. You can optionally run `npm audit fix` to address non-breaking updates, but this is not required to proceed.

## Step 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name (e.g., "HallPass")
4. Follow the setup wizard
5. Click "Create Project"

### 2.2 Enable Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Google** provider:
   - Click on "Google"
   - Toggle "Enable"
   - Enter your project support email
   - Click "Save"
3. (Optional) Enable **Email/Password** provider if you want both options
4. Click "Save"

**Note**: For Google Sign-In, you'll need to configure OAuth consent screen in Google Cloud Console if not already done.

### 2.3 Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (we'll add security rules)
4. Choose a location close to your users
5. Click "Enable"

### 2.4 Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register app with nickname (e.g., "HallPass Web")
5. Copy the `firebaseConfig` object

### 2.5 Get Google OAuth Client IDs

For Google Sign-In, you need OAuth client IDs. **For Expo Go development, you only need the Web client ID.**

1. In Firebase Console → **Authentication** → **Sign-in method** → **Google**
2. Note the **Web client ID** (you'll need this - it looks like: `xxxxx.apps.googleusercontent.com`)

**Note**: iOS/Android client IDs are only needed when building standalone apps (not for Expo Go). You can skip these for now and add them later when you're ready to build for production.

### 2.6 Configure Firebase (Using Environment Variables)

**Option A: Use Environment Variables (Recommended)**

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};
```

### 2.7 Configure Google OAuth Client IDs

**For Expo Go Development (Recommended for now):**

The code is already set up to use the Web client ID for all platforms when iOS/Android IDs aren't provided. Just do one of the following:

**Option A: Update LoginScreen.tsx directly (Easiest)**

1. Open `src/screens/LoginScreen.tsx`
2. Find line with `const WEB_CLIENT_ID = ...`
3. Replace `'YOUR_WEB_CLIENT_ID'` with your actual Web client ID from Firebase Console

**Option B: Use environment variable (Recommended)**

1. Create a `.env` file in project root:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

2. The code will automatically use this for all platforms in Expo Go

**That's it!** No need to set up iOS/Android client IDs for Expo Go development.

**For Production Builds (Later):**

When you're ready to build standalone apps (not Expo Go), you'll need:
1. Add iOS app in Firebase Console → Copy iOS client ID
2. Add Android app in Firebase Console → Copy Android client ID
3. Use platform-specific IDs in your code

But for now, **just use the Web client ID for everything** - it works fine with Expo Go!

### 2.6 Set Up Firestore Security Rules

1. In Firebase Console, go to **Firestore Database** > **Rules**
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /discussions/{discussionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    
    match /professors/{professorId} {
      allow read: if request.auth != null;
      match /ratings/{ratingId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
      }
    }
    
    match /clubs/{clubId} {
      allow read: if request.auth != null;
      match /ratings/{ratingId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
      }
    }
    
    match /messages/{messageId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.senderId || 
         request.auth.uid == resource.data.receiverId);
    }
    
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Universities collection - public read for authenticated users
    match /universities/{universityId} {
      allow read: if request.auth != null;
      // Only admins can write (add this later with custom claims)
      // For now, create universities manually in Firebase Console
      allow write: if false;
    }
    
    // University requests - users can submit and read for duplicate checking
    match /university_requests/{requestId} {
      // Users can create and read requests (needed for duplicate checking)
      allow read, create: if request.auth != null;
      // Only admins can update/delete (add custom claim check later)
      // For now, review requests in Firebase Console and manually move to universities collection
      allow update, delete: if false;
    }
    
    // Courses collection - authenticated users can read and update members array
    match /courses/{courseId} {
      allow read: if request.auth != null;
      // Allow users to add themselves to the members array during onboarding
      // This allows updates that only modify the members array and include the user's ID
      allow update: if request.auth != null && 
        // Only allow updating the members field (no other fields can change)
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']) &&
        // The new members array must contain the user's ID
        request.auth.uid in request.resource.data.members &&
        // The new members array must be a superset of the old one (only additions allowed)
        request.resource.data.members.hasAll(resource.data.members);
      // Only admins can create/delete (add this later with custom claims)
      allow create, delete: if false;
    }
    
    // Course requests - users can submit and read for duplicate checking
    match /course_requests/{requestId} {
      // Users can create and read requests (needed for duplicate checking)
      allow read, create: if request.auth != null;
      // Only admins can update/delete (add custom claim check later)
      allow update, delete: if false;
    }
    
    // Organizations collection - authenticated users can read and update members array
    match /organizations/{organizationId} {
      allow read: if request.auth != null;
      // Allow users to add themselves to the members array during onboarding
      // This allows updates that only modify the members array and include the user's ID
      allow update: if request.auth != null && 
        // Only allow updating the members field (no other fields can change)
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']) &&
        // The new members array must contain the user's ID
        request.auth.uid in request.resource.data.members &&
        // The new members array must be a superset of the old one (only additions allowed)
        request.resource.data.members.hasAll(resource.data.members);
      // Only admins can create/delete (add this later with custom claims)
      allow create, delete: if false;
    }
    
    // Organization requests - users can submit and read for duplicate checking
    match /organization_requests/{requestId} {
      // Users can create and read requests (needed for duplicate checking)
      allow read, create: if request.auth != null;
      // Only admins can update/delete (add custom claim check later)
      allow update, delete: if false;
    }
    
    // ID Verifications collection - users can create and read for duplicate checking
    match /id_verifications/{verificationId} {
      // Users can create their own verifications
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      // Users can read verifications for duplicate checking (need to check if nameOnCard already exists)
      // This is necessary to prevent duplicate accounts with the same ID card name
      allow read: if request.auth != null;
      // Only admins can update/delete (add custom claim check later)
      // For now, allow users to update their own pending verifications (e.g., if they made a mistake)
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.userId && 
        resource.data.verificationStatus == 'pending' &&
        // Only allow updating certain fields, not verified status
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nameOnCard', 'universityNameOnCard', 'verificationStatus', 'verified', 'updatedAt']);
      allow delete: if false;
    }
  }
}
```

**Important Notes:**
- `universities` collection: All authenticated users can **read** universities (needed for onboarding). Writes are disabled (you'll add universities manually in Firebase Console or via admin tools later).
- `university_requests` collection: Authenticated users can **create** and **read** requests (needed for duplicate checking). Updates/deletes are disabled (review in Firebase Console).
- `courses` collection: All authenticated users can **read** courses (needed for onboarding). Users can **update** the `members` array to add themselves during onboarding (only additions allowed, no deletions). Create/delete are disabled (courses are created via request processing).
- `course_requests` collection: Authenticated users can **create** and **read** requests (needed for duplicate checking). Updates/deletes are disabled (processed automatically when threshold of 100 is reached).
- `organizations` collection: All authenticated users can **read** organizations (needed for onboarding). Users can **update** the `members` array to add themselves during onboarding (only additions allowed, no deletions). Create/delete are disabled (organizations are created via request processing).
- `organization_requests` collection: Authenticated users can **create** and **read** requests (needed for duplicate checking). Updates/deletes are disabled (processed automatically when threshold of 100 is reached).
- `id_verifications` collection: Authenticated users can **create** their own ID verification documents and **read** all verifications (needed for duplicate checking to prevent multiple accounts with the same ID card name). Users can **update** their own pending verifications (to correct mistakes). Only admins can update verified status (add custom claim check later).

3. Click **"Publish"**

### 2.6 Create Firestore Composite Indexes

Some queries require composite indexes. Firebase will automatically create these when you first run the queries, or you can create them manually:

1. **Conversations Index** (Required for messages):
   - Collection: `conversations`
   - Fields:
     - `participants` (Array-contains)
     - `updatedAt` (Descending)
   - Click the link in the error message when it appears, or manually create in Firebase Console:
     - Go to **Firestore Database** → **Indexes** → **Create Index**
     - Collection ID: `conversations`
     - Add field: `participants` → Type: **Array** → Query scope: **Array-contains**
     - Add field: `updatedAt` → Type: **Timestamp** → Order: **Descending**
     - Click **Create**

**Note**: The index creation may take a few minutes. You can still use the app while the index is being created, but the conversations query will fail until the index is ready.

**Note**: Organizations are queried by `universityId` only (without `orderBy`) to avoid requiring a composite index. The results are sorted client-side alphabetically by name. If you want to add an index for better performance, you can create:
   - Collection: `organizations`
   - Fields:
     - `universityId` (Ascending)
     - `name` (Ascending)
   This is optional and not required for the app to work.

## Step 3: AWS S3 Setup (Optional - For Other Images)

**Note:** ID card images are not stored. S3 is only needed if you want to store other images (profile pictures, discussion images, etc.). You can skip this step if you don't need image storage.

### 3.1 Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Complete registration (requires credit card but won't charge unless you exceed free tier)

### 3.2 Create S3 Bucket

1. Go to AWS Console → Search "S3"
2. Click "Create bucket"
3. **Bucket name**: `hallpass-images-[yourname]` (must be globally unique)
4. **Region**: Choose closest to you (e.g., `us-east-1`)
5. **Uncheck** "Block all public access"
6. Click "Create bucket"

### 3.3 Configure Bucket Permissions

1. Click on your bucket name
2. Go to **Permissions** tab
3. **Bucket Policy** → Edit → Add:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

Replace `your-bucket-name` with your actual bucket name.

4. Click "Save changes"

### 3.4 Create IAM User

1. AWS Console → **IAM** → **Users**
2. Click **"Add users"** or **"Create user"**
3. **User name**: `hallpass-uploader`
4. Click **"Next"**
5. **Permissions**: 
   - Select **"Attach policies directly"**
   - Search for and select `AmazonS3FullAccess`
   - Click **"Next"**
6. Review and click **"Create user"**
7. **After user is created**, click on the user name (`hallpass-uploader`)
8. Go to **"Security credentials"** tab
9. Scroll to **"Access keys"** section
10. Click **"Create access key"**
11. **Use case**: Select **"Application running outside AWS"** (or "Command Line Interface (CLI)" or "Third party")
12. Click **"Next"** → **"Create access key"**
13. **IMPORTANT**: Copy and save:
    - **Access Key ID**
    - **Secret Access Key** (shown only once - download the CSV file!)
    - ⚠️ You won't be able to see the secret key again after closing this page
14. Click **"Done"**

### 3.5 Configure S3 in App

**⚠️ Security Warning**: AWS credentials in client apps can be extracted. For production, use presigned URLs from a backend. For development, you can use environment variables.

**Option A: Use Environment Variables (Recommended for Dev)**

Add to your `.env` file (already created in Step 2.6):
```
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_S3_BUCKET=hallpass-images-yourname
EXPO_PUBLIC_AWS_ACCESS_KEY_ID=your-access-key
EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY=your-secret-key
```

The code in `src/services/imageService.ts` will automatically use these values.

**Option B: Update Code Directly (Not Recommended)**

Edit `src/services/imageService.ts` and update `S3_CONFIG` directly (only for development).

**Option C: Use Presigned URLs (Recommended for Production)**

Set up a backend API that generates presigned URLs, then add to `.env`:
```
EXPO_PUBLIC_PRESIGNED_URL_API=https://your-api.com/api/upload/presigned-url
```

## Step 4: Create Initial Data

### 4.1 Create University Document

1. In Firestore, create collection `universities`
2. Add a document with ID of your choice (e.g., "stanford")
3. Add fields:
   - `name` (string): "Stanford University"
   - `logo` (string): URL to logo image
   - `image` (string): URL to university image
   - `colors` (map):
     - `primary` (string): "#8C1515"
     - `secondary` (string): "#2E2D29"

### 4.2 (Optional) Add Sample Courses

1. Create collection `courses`
2. Add sample course documents with fields:
   - `code` (string): "CS101"
   - `name` (string): "Introduction to Computer Science"
   - `description` (string): Optional
   - `universityId` (string): Your university ID
   - `professors` (array): Empty array initially
   - `createdAt` (timestamp): Current time

## Step 5: Run the Application

### 5.1 Start Development Server

```bash
npm start
```

### 5.2 Run on Device/Simulator

**Option A: Physical Device (Easiest)**
1. Install Expo Go app:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Scan QR code with:
   - iOS: Camera app
   - Android: Expo Go app

**Option B: iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option C: Android Emulator**
1. Start Android Studio and emulator
2. Run:
```bash
npm run android
```

### 5.3 Test the App

1. **Register**: Create account with email/password
2. **Onboarding**: Complete survey (select university, courses, clubs)
3. **Create Discussion**: Try posting with an image
4. **Browse**: Check courses, clubs, search functionality

## Step 6: Build for Production

### 6.1 Install EAS CLI

```bash
npm install -g eas-cli
```

### 6.2 Login to Expo

```bash
eas login
```

Create account at [expo.dev](https://expo.dev) if needed.

### 6.3 Configure Build

```bash
eas build:configure
```

### 6.4 Update app.json

Make sure `app.json` has your bundle identifiers:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourname.hallpass"
    },
    "android": {
      "package": "com.yourname.hallpass"
    }
  }
}
```

### 6.5 Build iOS App

```bash
eas build --platform ios
```

**Steps**:
1. Choose "Let Expo handle credentials" (recommended)
2. Wait 15-30 minutes
3. Download `.ipa` file
4. Submit to App Store using Transporter app or Xcode

### 6.6 Build Android App

```bash
eas build --platform android
```

**Steps**:
1. Choose "Let Expo handle credentials"
2. Wait 15-30 minutes
3. Download `.apk` or `.aab` file
4. Upload to Google Play Console

## Troubleshooting

### Common Issues

**"Module not found"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**"Firebase connection error"**
- Check `src/config/firebase.ts` has correct values
- Verify Firestore is enabled
- Check internet connection

**"S3 upload fails"**
- Verify AWS credentials in `src/services/imageService.ts`
- Check bucket permissions allow public reads
- Verify bucket name and region are correct

**"Build fails"**
- Make sure logged in: `eas login`
- Check `app.json` configuration
- Verify all dependencies installed

**"App crashes on startup"**
- Clear cache: `npx expo start -c`
- Check console for errors
- Verify Firebase config is correct

## Next Steps

1. Customize university data and branding
2. Add more courses and clubs
3. Set up push notifications (optional)
4. Configure analytics (Firebase Analytics)
5. Set up error tracking (Sentry, etc.)
6. Prepare app store assets (screenshots, descriptions)

## Quick Reference Commands

```bash
# Development
npm start                    # Start dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator

# Building
eas build --platform ios     # Build iOS app
eas build --platform android # Build Android app
eas build --platform all     # Build both

# Utilities
npx expo start -c            # Clear cache
npm run lint                 # Run linter
npm run type-check           # TypeScript check
```

## Support Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [React Native Documentation](https://reactnative.dev/)
