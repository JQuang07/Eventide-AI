# Enable Generative Language API

The "model not found" error means the Generative Language API isn't enabled in your Google Cloud project.

---

## 🔧 Quick Fix

### Step 1: Enable the API

1. Go to [Google Cloud Console - API Library](https://console.cloud.google.com/apis/library)
2. Make sure you're in the correct project (`aiatlcal`)
3. Search for: **"Generative Language API"**
4. Click on **"Generative Language API"**
5. Click the big blue **"ENABLE"** button
6. Wait a few seconds for it to enable (you'll see a green checkmark)

### Step 2: Verify It's Enabled

1. Go to **"APIs & Services"** → **"Enabled APIs"**
2. Search for "Generative Language"
3. You should see **"Generative Language API"** listed as "Enabled"

### Step 3: Restart Backend

```bash
cd backend
# Stop server (Ctrl+C)
npm run dev
```

### Step 4: Test

- Reload app in Expo Go
- Take a picture
- Should work now!

---

## ✅ Checklist

- [ ] Billing enabled ✅ (you did this)
- [ ] Generative Language API enabled ⚠️ (do this now)
- [ ] API key is valid ✅ (format looks good)
- [ ] Backend restarted (after enabling API)

---

## 🎯 Why This Happens

Even with billing enabled, you need to explicitly enable each API you want to use. The Generative Language API is separate from billing setup.

---

**After enabling the API and restarting, it should work!** 🚀

