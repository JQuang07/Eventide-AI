/**
 * Comprehensive test script to verify all Google APIs needed for Eventide AI
 * Run with: npx ts-node test-all-apis.ts
 */

import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

interface ApiTestResult {
  name: string;
  enabled: boolean;
  accessible: boolean;
  error?: string;
}

async function testAllAPIs() {
  console.log('🔍 Testing All Required Google APIs for Eventide AI...\n');
  console.log('=' .repeat(60) + '\n');

  const results: ApiTestResult[] = [];

  // Test 1: Calendar API
  console.log('📅 Test 1: Google Calendar API');
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    // Test by listing calendars instead of getting a specific one
    const calendarListResponse = await calendar.calendarList.list();
    console.log(`   ✅ Calendar API is enabled and accessible`);
    
    if (calendarListResponse.data.items && calendarListResponse.data.items.length > 0) {
      console.log(`   📋 Found ${calendarListResponse.data.items.length} calendar(s):`);
      calendarListResponse.data.items.slice(0, 3).forEach((cal, index) => {
        console.log(`      ${index + 1}. ${cal.summary || 'Untitled'} (ID: ${cal.id})`);
      });
      
      // Test reading events from primary calendar
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      const eventsResponse = await calendar.events.list({
        calendarId,
        timeMin: new Date().toISOString(),
        maxResults: 1
      });
      console.log(`   ✅ Can read events from calendar: ${calendarId}`);
    } else {
      console.log(`   ⚠️  No calendars found (service account may need calendar access)`);
    }
    
    results.push({
      name: 'Calendar API',
      enabled: true,
      accessible: true
    });
  } catch (error: any) {
    console.log(`   ❌ Calendar API error: ${error.message}`);
    if (error.message.includes('403')) {
      console.log(`   💡 Tip: Make sure Calendar API is enabled and service account has access`);
    }
    results.push({
      name: 'Calendar API',
      enabled: false,
      accessible: false,
      error: error.message
    });
  }

  console.log('');

  // Test 2: Tasks API
  console.log('📋 Test 2: Google Tasks API');
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/tasks']
    });

    const tasks = google.tasks({ version: 'v1', auth });
    const taskListsResponse = await tasks.tasklists.list({ maxResults: 1 });
    
    console.log(`   ✅ Tasks API is enabled and accessible`);
    if (taskListsResponse.data.items && taskListsResponse.data.items.length > 0) {
      console.log(`   📋 Default task list: ${taskListsResponse.data.items[0].title}`);
    }
    
    results.push({
      name: 'Tasks API',
      enabled: true,
      accessible: true
    });
  } catch (error: any) {
    console.log(`   ❌ Tasks API error: ${error.message}`);
    results.push({
      name: 'Tasks API',
      enabled: false,
      accessible: false,
      error: error.message
    });
  }

  console.log('');

  // Test 3: Gemini API (check via environment variable)
  console.log('🤖 Test 3: Google Gemini API');
  if (process.env.GEMINI_API_KEY) {
    console.log(`   ✅ GEMINI_API_KEY is set`);
    console.log(`   📝 Key: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);
    results.push({
      name: 'Gemini API',
      enabled: true,
      accessible: true
    });
  } else {
    console.log(`   ❌ GEMINI_API_KEY is not set`);
    results.push({
      name: 'Gemini API',
      enabled: false,
      accessible: false,
      error: 'GEMINI_API_KEY not found in environment'
    });
  }

  console.log('');

  // Test 4: Google Maps API (check via environment variable)
  console.log('🗺️  Test 4: Google Maps API');
  if (process.env.GOOGLE_MAPS_API_KEY) {
    console.log(`   ✅ GOOGLE_MAPS_API_KEY is set`);
    console.log(`   📝 Key: ${process.env.GOOGLE_MAPS_API_KEY.substring(0, 10)}...`);
    results.push({
      name: 'Google Maps API',
      enabled: true,
      accessible: true
    });
  } else {
    console.log(`   ❌ GOOGLE_MAPS_API_KEY is not set`);
    results.push({
      name: 'Google Maps API',
      enabled: false,
      accessible: false,
      error: 'GOOGLE_MAPS_API_KEY not found in environment'
    });
  }

  console.log('');

  // Test 5: Service Account
  console.log('🔐 Test 5: Service Account');
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fs = require('fs');
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(path)) {
      const keyData = JSON.parse(fs.readFileSync(path, 'utf8'));
      console.log(`   ✅ Service account key file exists`);
      console.log(`   📝 Service account email: ${keyData.client_email}`);
      console.log(`   📝 Project ID: ${keyData.project_id}`);
      results.push({
        name: 'Service Account',
        enabled: true,
        accessible: true
      });
    } else {
      console.log(`   ❌ Service account key file not found: ${path}`);
      results.push({
        name: 'Service Account',
        enabled: false,
        accessible: false,
        error: `Key file not found: ${path}`
      });
    }
  } else {
    console.log(`   ❌ GOOGLE_APPLICATION_CREDENTIALS is not set`);
    results.push({
      name: 'Service Account',
      enabled: false,
      accessible: false,
      error: 'GOOGLE_APPLICATION_CREDENTIALS not found in environment'
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');

  const allPassed = results.every(r => r.enabled && r.accessible);
  const failed = results.filter(r => !r.enabled || !r.accessible);

  results.forEach(result => {
    const status = result.enabled && result.accessible ? '✅' : '❌';
    console.log(`   ${status} ${result.name}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  console.log('');

  if (allPassed) {
    console.log('🎉 All APIs are properly configured!');
    console.log('🚀 You\'re ready to run and test the Eventide AI app!\n');
    console.log('Next steps:');
    console.log('   1. Start the backend: cd backend && npm run dev');
    console.log('   2. Start the mobile app: cd mobile && npm start');
    console.log('   3. Test creating an event and adding suggested tasks\n');
  } else {
    console.log('⚠️  Some APIs need attention:\n');
    failed.forEach(result => {
      console.log(`   • ${result.name}: ${result.error || 'Not configured'}`);
    });
    console.log('\n📝 Please fix the issues above before testing the app.\n');
  }
}

testAllAPIs().catch(console.error);

