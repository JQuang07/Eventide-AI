# Fix: Gemini API 403 Forbidden Error

The error "Method doesn't allow unregistered callers" means the Gemini API key isn't being recognized.

---

## 🔧 Quick Fix

### Step 1: Restart Backend Server

**The backend server must be restarted to load the .env file!**

1. **Stop the backend** (in the terminal where it's running):
   - Press `Ctrl+C`

2. **Start it again**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Verify it loaded the key**:
   - Check the console output for any errors
   - The server should start without errors

### Step 2: Verify API Key

Make sure the key in `.env` is correct:

```bash
cd backend
grep "GEMINI_API_KEY" .env
```

Should show: `GEMINI_API_KEY=AIzaSy...` (your actual key)

### Step 3: Test Again

- Reload app in Expo Go
- Try taking a picture again

---

## 🚨 Common Causes

### 1. Backend Not Restarted
- **Problem**: Server started before API key was added
- **Fix**: Restart backend server

### 2. Invalid API Key
- **Problem**: Key is wrong or expired
- **Fix**: Get a new key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 3. API Key Not in .env
- **Problem**: Key is missing from `.env` file
- **Fix**: Add it: `GEMINI_API_KEY=your-key-here`

### 4. Wrong Project
- **Problem**: API key is for a different project
- **Fix**: Make sure key matches your Google Cloud project

---

## ✅ Verification Steps

1. **Check .env file has the key**:
   ```bash
   cd backend
   grep "GEMINI_API_KEY" .env
   ```

2. **Restart backend**:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. **Test from backend** (optional):
   ```bash
   # Test if Gemini API works
   node -e "require('dotenv').config(); console.log('Key:', process.env.GEMINI_API_KEY ? 'Set' : 'Missing')"
   ```

---

## 🎯 Most Likely Fix

**Just restart the backend server!**

The `.env` file is only loaded when the server starts. If you added the API key after starting the server, it won't be loaded until you restart.

---

**After restarting, try taking a picture again!** 🚀

