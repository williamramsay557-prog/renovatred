# Supabase Storage Setup Guide

## Overview
Your app requires a Supabase Storage bucket to store user-uploaded photos (room photos, chat images, etc.). This guide will help you set it up in under 5 minutes.

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard
- Open your [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project

### 2. Create Storage Bucket
1. Click on **Storage** in the left sidebar
2. Click **New Bucket** button
3. Enter bucket name: `images`
4. **Privacy**: Select **Public bucket** (allows public read access)
5. Click **Create bucket**

### 3. Configure Storage Policies
Your app uses user-scoped folders (e.g., `public/{userId}/filename.jpg`) for security. The backend handles all uploads server-side with proper authentication.

**No additional policies needed** - the backend uses the service role key which bypasses RLS policies.

### 4. Verify Setup
To test if it's working:
1. Go to your app
2. Navigate to **Room Progress**
3. Try uploading a photo to a room
4. If successful, you should see the photo appear immediately

## Troubleshooting

### "Failed to upload photo" error
**Cause**: The `images` bucket doesn't exist  
**Solution**: Complete steps 1-2 above to create the bucket

### Photos upload but don't display
**Cause**: Bucket is private instead of public  
**Solution**: 
1. Go to Storage → images bucket
2. Click Settings icon
3. Change to **Public bucket**
4. Save changes

### "Permission denied" errors
**Cause**: Missing service role key  
**Solution**: Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Replit Secrets

## Security Notes

✅ **Secure Upload Path**: All uploads go through authenticated server API  
✅ **User-Scoped Folders**: Files are stored in `public/{userId}/` folders  
✅ **Server-Side Validation**: File type, size, and format validated before upload  
✅ **JWT Authentication**: All upload requests require valid user tokens  

## File Storage Structure

```
images/
├── public/
│   ├── {userId1}/
│   │   ├── room_abc123_1234567890.jpg
│   │   ├── task_def456_1234567891.png
│   │   └── ...
│   ├── {userId2}/
│   │   ├── room_xyz789_1234567892.jpg
│   │   └── ...
```

Each user's photos are isolated in their own folder for organization and security.

## What's Already Done ✅

- ✅ Server-side upload endpoint configured (`/api/upload`)
- ✅ Image validation (MIME type, size, format)
- ✅ JWT authentication required
- ✅ User-scoped folder structure
- ✅ Error handling and user feedback

**All you need to do is create the bucket!** 🚀
