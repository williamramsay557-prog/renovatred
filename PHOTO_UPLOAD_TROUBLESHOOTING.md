# Photo Upload Troubleshooting Guide

## Issue: Photos Not Uploading Despite Bucket Being Created

This guide will help you diagnose and fix photo upload issues.

---

## 🔍 **Step 1: Check Browser Console for Errors**

1. Open your browser's **Developer Tools** (F12 or Right-click → Inspect)
2. Go to the **Console** tab
3. Try to upload a photo
4. Look for any red error messages

**What to look for:**
- `"Bucket not found"` → Bucket name issue
- `"Row-level security policy violation"` → Storage policies not applied
- `"401 Unauthorized"` → Auth token issue
- `"new row violates row-level security policy"` → Storage policies issue

---

## ✅ **Step 2: Verify Bucket Configuration**

### Check Bucket Name
1. Go to **Supabase Dashboard → Storage**
2. Verify the bucket is named exactly: **`images`** (lowercase)
3. If it's named differently, either:
   - Rename it to `images`, OR
   - Update the code to use your bucket name

### Check Bucket Privacy
1. Click on the **`images`** bucket
2. Look at the bucket settings (gear icon or settings tab)
3. **Public bucket** should be **enabled**
4. If it says "Private bucket":
   - Click Edit
   - Toggle to **Public bucket**
   - Save

---

## 🔐 **Step 3: Apply Storage RLS Policies**

Your storage bucket needs RLS policies to allow uploads. Run this SQL in **Supabase SQL Editor**:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can upload to their own folder
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'public'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 2: Users can view all public images
CREATE POLICY "Authenticated users can view all images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- Policy 3: Users can update their own images
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'public'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 4: Users can delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'public'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
```

**Verify it worked:**
```sql
SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
-- Should show 4 policies for the images bucket
```

---

## 🧪 **Step 4: Test Upload**

### Test in Room Progress
1. Go to **Room Progress** page
2. Hover over any room card
3. Click the **camera icon** (top right)
4. Select an image file (< 5MB, JPG/PNG/WebP/GIF)
5. Watch for:
   - ✅ Photo appears in room → **Working!**
   - ❌ Error alert → Note the exact error message
   - ❌ Nothing happens → Check browser console

### Test in Chat
1. Open any task
2. Click the **image icon** in the chat input
3. Select an image
4. Try to send the message
5. Watch for:
   - ✅ Image uploads and AI responds → **Working!**
   - ❌ Error alert prevents sending → Note the exact error message
   - ❌ Message disappears → Upload failed silently

---

## 🐛 **Common Issues & Fixes**

### Issue 1: "Bucket not found" or "Object not found"
**Cause**: Bucket name mismatch  
**Fix**:
- Verify bucket is named `images` (lowercase)
- Or update code to match your bucket name

### Issue 2: "New row violates row-level security policy"
**Cause**: Storage RLS policies not applied  
**Fix**:
- Run the SQL from **Step 3** above
- Verify policies exist with the verification query

### Issue 3: "The resource already exists"
**Cause**: RLS policies already exist (this is good!)  
**Fix**:
- Drop old policies first:
```sql
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view all images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
```
- Then re-run the CREATE POLICY commands from Step 3

### Issue 4: "401 Unauthorized" in uploads
**Cause**: Service role key not set correctly  
**Fix**:
- Check Replit Secrets has `SUPABASE_SERVICE_ROLE_KEY`
- Get the key from **Supabase Dashboard → Settings → API**
- Copy the **service_role** key (NOT the anon key)
- Restart workflow after updating

### Issue 5: Uploads work but photos don't display
**Cause**: Bucket is private  
**Fix**:
- Go to Storage → images bucket → Settings
- Enable **Public bucket**
- Save and try again

---

## 📸 **Expected Behavior When Working**

### Room Photo Upload:
1. Click camera icon
2. Select image file
3. Brief loading state (< 2 seconds)
4. Photo appears in room card
5. No error messages

### Chat Image Upload:
1. Click image icon
2. Select image file
3. Image preview appears in chat input
4. Send message
5. Message sent with image
6. AI responds (may take 5-10 seconds)

---

## 🔧 **Quick Verification Checklist**

Run this in **Supabase SQL Editor** to check everything:

```sql
-- 1. Check bucket exists and is public
SELECT * FROM storage.buckets WHERE name = 'images';
-- Should return 1 row with public = true

-- 2. Check storage RLS policies exist
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%image%';
-- Should return 4 policies

-- 3. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename = 'objects';
-- rowsecurity should be 'true'
```

---

## 📞 **Still Not Working?**

If uploads still fail after all these steps, please provide:
1. **Exact error message** from browser console
2. **Which upload method** you're trying (room photo vs chat image)
3. **Screenshots** of:
   - Storage bucket settings
   - Error messages in console
   - Storage policies list in Supabase

This will help diagnose the specific issue!
