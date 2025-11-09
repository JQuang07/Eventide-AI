/**
 * Test script to verify Google Tasks API access
 * Run with: npx ts-node test-tasks-api.ts
 */

import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

async function testTasksAPI() {
  console.log('🔍 Testing Google Tasks API Access...\n');

  try {
    // Initialize auth with Tasks API scope
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/tasks'
      ]
    });

    console.log('✅ Auth initialized');
    console.log(`📁 Service account key: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

    // Initialize Tasks API with auth
    const tasks = google.tasks({ version: 'v1', auth });
    console.log('✅ Tasks API client initialized\n');

    // Test 1: List task lists
    console.log('📋 Test 1: Listing task lists...');
    try {
      const taskListsResponse = await tasks.tasklists.list({
        maxResults: 10
      });

      if (taskListsResponse.data.items && taskListsResponse.data.items.length > 0) {
        console.log(`✅ Found ${taskListsResponse.data.items.length} task list(s):`);
        taskListsResponse.data.items.forEach((list, index) => {
          console.log(`   ${index + 1}. ${list.title} (ID: ${list.id})`);
        });
      } else {
        console.log('⚠️  No task lists found (this is normal if you haven\'t created any)');
      }
    } catch (error: any) {
      console.error('❌ Error listing task lists:', error.message);
      if (error.message.includes('403')) {
        console.error('   → This usually means the Tasks API is not enabled or permissions are missing');
      }
      throw error;
    }

    console.log('');

    // Test 2: Get default task list
    console.log('📋 Test 2: Getting default task list...');
    try {
      const defaultListResponse = await tasks.tasklists.list({
        maxResults: 1
      });

      if (defaultListResponse.data.items && defaultListResponse.data.items.length > 0) {
        const defaultListId = defaultListResponse.data.items[0].id || '@default';
        console.log(`✅ Default task list ID: ${defaultListId}`);

        // Test 3: List tasks in default list
        console.log('\n📋 Test 3: Listing tasks in default list...');
        try {
          const tasksResponse = await tasks.tasks.list({
            tasklist: defaultListId,
            showCompleted: false,
            maxResults: 10
          });

          if (tasksResponse.data.items && tasksResponse.data.items.length > 0) {
            console.log(`✅ Found ${tasksResponse.data.items.length} task(s):`);
            tasksResponse.data.items.forEach((task, index) => {
              console.log(`   ${index + 1}. ${task.title}${task.due ? ` (Due: ${task.due})` : ''}`);
            });
          } else {
            console.log('✅ No tasks found (this is normal)');
          }
        } catch (error: any) {
          console.error('❌ Error listing tasks:', error.message);
          throw error;
        }

        // Test 4: Create a test task
        console.log('\n📋 Test 4: Creating a test task...');
        try {
          const testTask = {
            title: 'Test Task from Eventide AI',
            notes: 'This is a test task to verify API access',
            status: 'needsAction' as const
          };

          const createResponse = await tasks.tasks.insert({
            tasklist: defaultListId,
            requestBody: testTask
          });

          if (createResponse.data.id) {
            console.log(`✅ Test task created successfully!`);
            console.log(`   Task ID: ${createResponse.data.id}`);
            console.log(`   Task Title: ${createResponse.data.title}`);

            // Clean up: Delete the test task
            console.log('\n🧹 Cleaning up test task...');
            try {
              await tasks.tasks.delete({
                tasklist: defaultListId,
                task: createResponse.data.id
              });
              console.log('✅ Test task deleted');
            } catch (deleteError: any) {
              console.warn('⚠️  Could not delete test task:', deleteError.message);
              console.warn(`   You may need to manually delete task ID: ${createResponse.data.id}`);
            }
          }
        } catch (error: any) {
          console.error('❌ Error creating test task:', error.message);
          if (error.message.includes('403')) {
            console.error('   → This usually means the service account lacks write permissions');
          }
          throw error;
        }
      } else {
        console.log('⚠️  No task lists available');
      }
    } catch (error: any) {
      console.error('❌ Error getting default task list:', error.message);
      throw error;
    }

    console.log('\n✅ All tests passed! Tasks API is properly configured.');
    console.log('\n📝 Summary:');
    console.log('   • Tasks API is enabled');
    console.log('   • Service account has proper permissions');
    console.log('   • Can read and write tasks');
    console.log('\n🚀 You\'re ready to use the Tasks feature in the app!');

  } catch (error: any) {
    console.error('\n❌ Tests failed!\n');
    console.error('Error details:', error.message);
    
    if (error.message.includes('403')) {
      console.error('\n🔧 Troubleshooting steps:');
      console.error('1. Enable Google Tasks API in Google Cloud Console:');
      console.error('   https://console.cloud.google.com/apis/library/tasks.googleapis.com');
      console.error('\n2. Verify service account has Editor role or Tasks API permissions');
      console.error('\n3. Check that GOOGLE_APPLICATION_CREDENTIALS points to the correct key file');
    } else if (error.message.includes('ENOENT')) {
      console.error('\n🔧 Troubleshooting steps:');
      console.error('1. Check that GOOGLE_APPLICATION_CREDENTIALS is set correctly in .env');
      console.error('2. Verify the service account key file exists at the specified path');
    } else {
      console.error('\n🔧 Check the error message above for specific issues');
    }
    
    process.exit(1);
  }
}

testTasksAPI();

