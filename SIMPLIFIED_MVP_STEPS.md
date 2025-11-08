# Simplified MVP: Camera → Calendar (Tonight!)

Simple flow: Take picture → Process → Auto-save → Confirm

---

## 🎯 What You Want

1. **Camera button** → Tap it
2. **Take picture** → Capture flyer
3. **Processing** → Extract event info (automatic)
4. **Auto-save** → Add to calendar (automatic, no review)
5. **Confirmation** → Show success screen

---

## ✅ What's Already Set Up

- ✅ Backend APIs (extract, save)
- ✅ Camera functionality
- ✅ Gemini extraction
- ✅ Calendar integration
- ✅ All API keys configured

---

## 🔧 What Needs to Change

### 1. Update API URL for Physical Device

The app is using `localhost:3000` which only works on simulator.

**For Expo Go on phone:**
- Need your computer's IP address
- Update `mobile/src/config/api.ts`

### 2. Simplify Flow (Skip Review Screen)

Currently: Camera → Extract → **Review** → Save → Success

You want: Camera → Extract → **Auto-save** → Success

---

## 📋 Next Steps (In Order)

### Step 1: Get Your Computer's IP

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Look for something like: `192.168.1.100`

### Step 2: Update API URL

Edit `mobile/src/config/api.ts`:
- Change `localhost:3000` to `http://YOUR_IP:3000`

### Step 3: Modify HomeScreen to Auto-Save

Change the flow to:
- Extract event
- Immediately save to calendar (skip review)
- Show success screen

### Step 4: Test

- Make sure backend is running
- Start mobile app
- Take a picture
- Should auto-save and show confirmation

---

## 🚀 Quick Fix Plan

1. **Update API URL** (for phone connection)
2. **Modify HomeScreen** (auto-save after extraction)
3. **Test end-to-end**

Let me make these changes now!

