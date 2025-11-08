# Fix: Gemini API 403 "Unregistered Callers" Error

The error "Method doesn't allow unregistered callers" means your API key isn't being recognized by Google's API.

---

## 🔍 Root Cause

This error typically means:
1. **API key is invalid/expired** - Most common
2. **Gemini API not enabled** in Google Cloud project
3. **Billing not enabled** - Required even for free tier
4. **API key restrictions** - Key might be restricted

---

## ✅ Step-by-Step Fix

### Step 1: Verify API Key is Active

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Check if your API key is listed
3. If it's not there or shows as inactive, create a new one

### Step 2: Check Gemini API is Enabled

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (`aiatlcal`)
3. Go to **"APIs & Services"** → **"Enabled APIs"**
4. Search for **"Generative Language API"** or **"Gemini API"**
5. If not enabled, go to **"Library"** and enable it

### Step 3: Verify Billing is Enabled

1. In Google Cloud Console
2. Go to **"Billing"**
3. Make sure billing is enabled (even for free tier)
4. Gemini API requires billing to be enabled

### Step 4: Create New API Key (If Needed)

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **"Create API Key"**
3. Select your project (`aiatlcal`)
4. Copy the new key
5. Update `backend/.env`:
   ```
   GEMINI_API_KEY=your-new-key-here
   ```
6. **Restart backend server**

### Step 5: Check API Key Restrictions

1. In Google Cloud Console
2. Go to **"APIs & Services"** → **"Credentials"**
3. Click on your API key
4. Check **"API restrictions"**:
   - Should be **"Don't restrict key"** OR
   - Should include **"Generative Language API"**
5. If restricted incorrectly, update it

---

## 🧪 Test the Fix

After updating the API key:

1. **Restart backend**:
   ```bash
   cd backend
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Test in app**:
   - Reload Expo Go
   - Take a picture
   - Should work now!

---

## 🎯 Quick Checklist

- [ ] API key exists in Google AI Studio
- [ ] Gemini API is enabled in Google Cloud
- [ ] Billing is enabled (even for free tier)
- [ ] API key has no incorrect restrictions
- [ ] Updated `.env` with correct key
- [ ] Restarted backend server

---

## 💡 Most Likely Fix

**Create a new API key** - Sometimes keys expire or get invalidated.

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new key
3. Update `.env`
4. Restart backend

---

**After creating a new key and restarting, it should work!** 🚀

