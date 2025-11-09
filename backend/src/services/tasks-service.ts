import { tasks_v1, google, calendar_v3 } from 'googleapis';
import { CanonicalEvent } from '../types/event';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SuggestedTask {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export class TasksService {
  private tasks: tasks_v1.Tasks;
  private calendar: calendar_v3.Calendar;
  private auth: any;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        'https://www.googleapis.com/auth/tasks',
        'https://www.googleapis.com/auth/calendar'
      ]
    });

    this.tasks = google.tasks({ version: 'v1', auth });
    this.calendar = google.calendar({ version: 'v3', auth });
    
    // Initialize Gemini for AI-powered task suggestions
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      this.gemini = new GoogleGenerativeAI(geminiApiKey);
    }
  }

  /**
   * Generate suggested tasks based on event using AI
   */
  async generateSuggestedTasks(event: CanonicalEvent): Promise<SuggestedTask[]> {
    // Use Gemini AI for creative, context-aware suggestions
    if (this.gemini) {
      try {
        return await this.generateAISuggestions(event);
      } catch (error: any) {
        console.warn('[TasksService] AI suggestion generation failed, falling back to rule-based:', error.message);
        return this.generateRuleBasedSuggestions(event);
      }
    }
    
    // Fallback to rule-based if Gemini is not available
    return this.generateRuleBasedSuggestions(event);
  }

  /**
   * Generate AI-powered task suggestions using Gemini
   */
  private async generateAISuggestions(event: CanonicalEvent): Promise<SuggestedTask[]> {
    if (!this.gemini) {
      return this.generateRuleBasedSuggestions(event);
    }

    const model = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Parse date without timezone conversion to avoid day shifts
    let eventDate: Date;
    if (event.startTime.includes('T')) {
      eventDate = new Date(event.startTime);
    } else {
      // For date-only strings, parse as local date to avoid UTC conversion
      const [year, month, day] = event.startTime.split('-').map(Number);
      eventDate = new Date(year, month - 1, day);
    }
    
    const oneDayBefore = new Date(eventDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    // Format as YYYY-MM-DD using local date methods to avoid timezone issues
    const year = oneDayBefore.getFullYear();
    const month = String(oneDayBefore.getMonth() + 1).padStart(2, '0');
    const day = String(oneDayBefore.getDate()).padStart(2, '0');
    const oneDayBeforeStr = `${year}-${month}-${day}`;
    
    // Check if location has an actual address (not just a name)
    const hasAddress = event.location && (
      event.location.address || 
      (event.location.name && event.location.name.includes(',')) ||
      (event.location.address && event.location.address.length > 10)
    );

    const prompt = `You are a helpful assistant that generates relevant, actionable task suggestions for calendar events.

Event Details:
- Title: ${event.title}
- Description: ${event.description || 'No description provided'}
- Date: ${eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Time: ${event.startTime.includes('T') ? eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All-day event'}
- Location: ${event.location ? (event.location.name || event.location.address || 'Location specified') : 'No location'}
- Has Address: ${hasAddress ? 'Yes' : 'No'}

Generate 2-4 creative, contextually relevant task suggestions for this event. Be specific and actionable.

IMPORTANT RULES:
1. Task titles MUST be SHORT and CONCISE - aim for 2-4 words maximum (e.g., "Buy tickets", "Charge phone", "Review agenda", "Reserve table"). Avoid long titles like "Plan travel route to venue" - use "Plan route" instead.
2. ONLY suggest location/travel-related tasks (like "Plan route", "Check parking", "Get directions") if the location HAS AN ADDRESS (hasAddress: Yes). If hasAddress is No, DO NOT suggest any travel/location tasks.
3. REASON FROM CONTEXT in the event details:
   - Look at the title, description, date, time, and location to understand what's happening
   - Consider different scenarios based on what's present. For example:
     * If title is "Dinner at [Restaurant]" with a date/time → suggest "Reserve table" or "Confirm reservation"
     * If title is "Watch [Movie]" with a release date → suggest "Buy tickets" or "Check showtimes"
     * If title is just "[Restaurant Name]" → suggest "Check menu" or "Read reviews"
     * If it's an event with tickets mentioned → suggest "Buy tickets"
   - Be flexible and reason from what's actually present, not hardcoded assumptions
4. Make suggestions creative and varied - avoid generic tasks unless they're truly relevant.
5. Examples of good SHORT suggestions (reason from context):
   - For restaurant reservations: "Reserve table", "Confirm reservation", "Check menu", "Review dietary", "Plan route" (only if address exists)
   - For movie watching: "Buy tickets", "Check showtimes", "Find theater", "Charge phone", "Plan route" (only if address exists)
   - For restaurant research: "Check menu", "Read reviews", "Check hours"
   - For concerts: "Charge phone", "Check setlist", "Review parking" (only if address exists)
   - For meetings: "Review agenda", "Prepare notes", "Test setup"
   - For workshops: "Bring notebook", "Review prep", "Download files"
6. Avoid suggesting tasks that don't make sense (e.g., "Plan travel route" for online events or events without addresses).
7. Make each suggestion unique and specific to this event.
8. Keep descriptions brief too - 1 short sentence maximum.

Return ONLY a JSON array of task objects in this exact format:
[
  {
    "title": "Short task title (2-4 words max)",
    "description": "Brief description (1 sentence max)",
    "dueDate": "${oneDayBeforeStr}",
    "priority": "high" | "medium" | "low"
  }
]

Return ONLY the JSON array, no markdown, no explanation.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const suggestions = JSON.parse(jsonMatch[0]) as SuggestedTask[];
      
      // Validate and filter suggestions
      const validSuggestions = suggestions
        .filter(task => {
          // Filter out location-related tasks if no address
          if (!hasAddress) {
            const titleLower = task.title.toLowerCase();
            const descLower = (task.description || '').toLowerCase();
            const locationKeywords = ['travel', 'route', 'directions', 'parking', 'transportation', 'navigate', 'commute'];
            const hasLocationKeyword = locationKeywords.some(keyword => 
              titleLower.includes(keyword) || descLower.includes(keyword)
            );
            if (hasLocationKeyword) {
              console.log(`[TasksService] Filtered out location task "${task.title}" - no address available`);
              return false;
            }
          }
          return task.title && task.title.trim().length > 0;
        })
        .slice(0, 4); // Limit to 4 suggestions

      console.log(`[TasksService] Generated ${validSuggestions.length} AI-powered task suggestions`);
      return validSuggestions;
    } catch (error: any) {
      console.error('[TasksService] Error generating AI suggestions:', error.message);
      throw error;
    }
  }

  /**
   * Fallback rule-based task generation (improved version)
   */
  private generateRuleBasedSuggestions(event: CanonicalEvent): SuggestedTask[] {
    const suggestions: SuggestedTask[] = [];
    // Parse date without timezone conversion to avoid day shifts
    let eventDate: Date;
    if (event.startTime.includes('T')) {
      eventDate = new Date(event.startTime);
    } else {
      // For date-only strings, parse as local date to avoid UTC conversion
      const [year, month, day] = event.startTime.split('-').map(Number);
      eventDate = new Date(year, month - 1, day);
    }
    
    const oneDayBefore = new Date(eventDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    // Format as YYYY-MM-DD using local date methods to avoid timezone issues
    const year = oneDayBefore.getFullYear();
    const month = String(oneDayBefore.getMonth() + 1).padStart(2, '0');
    const day = String(oneDayBefore.getDate()).padStart(2, '0');
    const oneDayBeforeStr = `${year}-${month}-${day}`;

    // Check if location has an actual address
    const hasAddress = !!(event.location && (
      event.location.address || 
      (event.location.name && event.location.name.includes(',')) ||
      (event.location.address && event.location.address.length > 10)
    ));

    // Location-based suggestions - ONLY if address exists
    if (hasAddress && event.location) {
      suggestions.push({
        title: 'Plan route',
        description: `Get directions to ${event.location.name || event.location.address || 'location'}`,
        dueDate: oneDayBeforeStr,
        priority: 'medium'
      });
    }

    // Description-based suggestions
    const descLower = (event.description || '').toLowerCase();
    const titleLower = event.title.toLowerCase();
    
    if (descLower.includes('ticket') || descLower.includes('purchase') || titleLower.includes('ticket')) {
      suggestions.push({
        title: 'Buy tickets',
        description: 'Purchase event tickets',
        dueDate: oneDayBeforeStr,
        priority: 'high'
      });
    }
    
    // Remove duplicate "Buy tickets" if already added for movies
    // (This will be handled by the deduplication logic below)

    if (descLower.includes('rsvp') || descLower.includes('register') || descLower.includes('confirm') || descLower.includes('sign up')) {
      suggestions.push({
        title: 'Send RSVP',
        description: 'Confirm attendance',
        dueDate: oneDayBeforeStr,
        priority: 'high'
      });
    }

    if (descLower.includes('presentation') || descLower.includes('meeting') || descLower.includes('prepare') || descLower.includes('workshop')) {
      suggestions.push({
        title: 'Prepare materials',
        description: 'Gather needed items',
        dueDate: oneDayBeforeStr,
        priority: 'medium'
      });
    }

    // Title-based suggestions
    if (titleLower.includes('concert') || titleLower.includes('show') || titleLower.includes('performance')) {
      if (hasAddress) {
        suggestions.push({
          title: 'Check parking',
          description: 'Plan transportation',
          dueDate: oneDayBeforeStr,
          priority: 'medium'
        });
      }
      suggestions.push({
        title: 'Charge phone',
        description: 'Prepare devices',
        dueDate: oneDayBeforeStr,
        priority: 'low'
      });
    }

    // Restaurant/dining events - reason from context, not hardcoded assumptions
    // Check if it looks like a reservation (has date/time) vs research (just restaurant name)
    const hasDateTime = event.startTime.includes('T') || (event.startTime && event.startTime.length > 10);
    if (titleLower.includes('dinner at') || titleLower.includes('lunch at') || titleLower.includes('brunch at') || 
        (titleLower.includes('restaurant') && hasDateTime) || 
        (descLower.includes('restaurant') && hasDateTime) || 
        (descLower.includes('dining') && hasDateTime)) {
      // Looks like a reservation - suggest reservation-related tasks
      suggestions.push({
        title: 'Reserve table',
        description: 'Make or confirm restaurant reservation',
        dueDate: oneDayBeforeStr,
        priority: 'high'
      });
      
      if (hasAddress && event.location) {
        suggestions.push({
          title: 'Plan route',
          description: `Get directions to ${event.location.name || event.location.address || 'restaurant'}`,
          dueDate: oneDayBeforeStr,
          priority: 'medium'
        });
      }
      
      suggestions.push({
        title: 'Check menu',
        description: 'Review restaurant menu and options',
        dueDate: oneDayBeforeStr,
        priority: 'low'
      });
    } else if (titleLower.includes('restaurant') || descLower.includes('restaurant') || descLower.includes('dining')) {
      // Just restaurant info, might be research - suggest research tasks
      suggestions.push({
        title: 'Check menu',
        description: 'Review restaurant menu',
        dueDate: oneDayBeforeStr,
        priority: 'medium'
      });
      
      suggestions.push({
        title: 'Read reviews',
        description: 'Check restaurant reviews',
        dueDate: oneDayBeforeStr,
        priority: 'low'
      });
    }
    
    // Movie events - reason from context
    if (titleLower.startsWith('watch ') || (titleLower.includes('movie') && hasDateTime) || 
        (descLower.includes('movie') && hasDateTime) || (descLower.includes('film') && hasDateTime)) {
      // Looks like they want to watch it - suggest ticket/showtime tasks
      suggestions.push({
        title: 'Buy tickets',
        description: 'Purchase movie tickets',
        dueDate: oneDayBeforeStr,
        priority: 'high'
      });
      
      suggestions.push({
        title: 'Check showtimes',
        description: 'Find available movie showtimes',
        dueDate: oneDayBeforeStr,
        priority: 'high'
      });
      
      if (hasAddress && event.location) {
        suggestions.push({
          title: 'Find theater',
          description: 'Locate movie theater location',
          dueDate: oneDayBeforeStr,
          priority: 'medium'
        });
      }
    } else if (titleLower.includes('movie') || descLower.includes('movie') || descLower.includes('film')) {
      // Just movie info, might be research - suggest research tasks
      suggestions.push({
        title: 'Read reviews',
        description: 'Check movie reviews',
        dueDate: oneDayBeforeStr,
        priority: 'low'
      });
    }

    if (titleLower.includes('meeting') || titleLower.includes('conference')) {
      suggestions.push({
        title: 'Review agenda',
        description: 'Prepare topics',
        dueDate: oneDayBeforeStr,
        priority: 'medium'
      });
    }

    if (titleLower.includes('workshop') || titleLower.includes('class') || titleLower.includes('training')) {
      suggestions.push({
        title: 'Review prep',
        description: 'Check prerequisites',
        dueDate: oneDayBeforeStr,
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Create a task as an all-day calendar event
   * Since service account tasks aren't visible in user's Google Tasks,
   * we create tasks as calendar events so they appear in Google Calendar
   */
  async createTask(taskListId: string, task: SuggestedTask): Promise<string> {
    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      // Format dueDate as YYYY-MM-DD, handling both date-only and ISO strings
      let dueDate: string;
      if (task.dueDate) {
        if (task.dueDate.includes('T')) {
          // ISO string with time - extract just the date part
          dueDate = task.dueDate.split('T')[0];
        } else {
          // Already a date string
          dueDate = task.dueDate;
        }
      } else {
        // Default to today using local date to avoid timezone issues
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dueDate = `${year}-${month}-${day}`;
      }
      
      // Generate a unique task ID for tracking
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const calendarEvent: calendar_v3.Schema$Event = {
        summary: `✓ ${task.title}`, // Add checkmark prefix to indicate it's a task
        description: task.description || '',
        start: {
          date: dueDate // All-day event - no timeZone for all-day events
        },
        end: {
          date: dueDate // Same day - no timeZone for all-day events
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 0 } // Reminder at start of day
          ]
        },
        extendedProperties: {
          private: {
            eventideTask: 'true',
            eventideTaskId: taskId,
            eventideTaskStatus: 'needsAction'
          }
        }
      };

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: calendarEvent
      });

      const eventId = response.data.id || taskId;
      console.log(`[TasksService] Created task as calendar event: ${task.title} (ID: ${eventId})`);

      return eventId;
    } catch (error: any) {
      console.error('Task creation error:', error.message);
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  /**
   * Get all tasks from calendar events marked as tasks
   */
  async getTasks(taskListId: string = '@default', showCompleted: boolean = true): Promise<any[]> {
    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      // Get events from calendar that are marked as tasks
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ahead
      
      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults: 500,
        singleEvents: true,
        orderBy: 'startTime'
      });

      // Filter for task events and convert to task format
      const taskEvents = (response.data.items || [])
        .filter(event => {
          const isTask = event.extendedProperties?.private?.eventideTask === 'true';
          return isTask; // Include all tasks, even if completed (they're stored in app state)
        })
        .map(event => {
          const startDate = event.start?.date || event.start?.dateTime;
          // For all-day events (date-only), keep as date string without time
          // For timed events, extract just the date part
          let dueDate: string | undefined;
          if (startDate) {
            if (event.start?.date) {
              // All-day event - use date as-is (YYYY-MM-DD)
              dueDate = event.start.date;
            } else if (event.start?.dateTime) {
              // Timed event - extract date part
              dueDate = event.start.dateTime.split('T')[0];
            }
          }
          
          return {
            id: event.id,
            title: event.summary?.replace(/^✓\s*/, '') || '', // Remove checkmark prefix
            notes: event.description || '',
            // Keep as date string (YYYY-MM-DD) for all-day events to avoid timezone issues
            due: dueDate || undefined,
            status: (event.extendedProperties?.private?.eventideTaskStatus as 'needsAction' | 'completed') || 'needsAction',
            taskId: event.id, // For compatibility
            taskListId: '@default'
          };
        });

      // Also need to track completed tasks that were deleted from calendar
      // For now, we'll return tasks that exist in calendar
      // Completed tasks that were deleted won't appear, but we can handle that in the frontend
      // by maintaining a local cache of completed tasks
      
      return taskEvents;
    } catch (error: any) {
      console.error('Tasks fetch error:', error.message);
      return [];
    }
  }

  /**
   * Update a task (stored as calendar event)
   * Returns true or an object with newEventId if event was recreated
   */
  async updateTask(taskListId: string, taskId: string, updates: {
    title?: string;
    notes?: string;
    status?: 'needsAction' | 'completed';
    due?: string;
  }): Promise<boolean | { newEventId: string }> {
    try {
      if (!taskId || taskId.trim() === '') {
        throw new Error('Missing task ID');
      }

      console.log('Updating task:', { taskListId, taskId, updates });

      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      // Get existing event (if it exists - it might have been deleted when completed)
      let existingEvent: calendar_v3.Schema$Event | null = null;
      try {
        const getResponse = await this.calendar.events.get({
          calendarId,
          eventId: taskId
        });
        existingEvent = getResponse.data;
        
        // Verify it's a task event
        if (existingEvent.extendedProperties?.private?.eventideTask !== 'true') {
          throw new Error('Event is not a task');
        }
      } catch (getError: any) {
        // Event might not exist if it was deleted when completed - that's okay for uncompleting
        if (updates.status === 'needsAction' && getError.message.includes('Not Found')) {
          console.log('Task event not found (likely deleted when completed) - will recreate');
          existingEvent = null; // Will use defaults when recreating
        } else if (updates.status !== 'needsAction') {
          // For other updates, we need the event to exist
          console.error('Task event not found:', getError.message);
          throw new Error(`Task not found: ${getError.message}`);
        }
      }

      // Build update (only if event exists)
      const updatedEvent: calendar_v3.Schema$Event | null = existingEvent ? {
        ...existingEvent
      } : null;
      
      // If status is being set to 'completed', delete the calendar event
      if (updates.status === 'completed') {
        console.log('Task completed - deleting calendar event:', taskId);
        try {
          await this.calendar.events.delete({
            calendarId,
            eventId: taskId
          });
          console.log('Task event deleted successfully:', taskId);
        } catch (deleteError: any) {
          // If event doesn't exist (already deleted), that's okay
          if (!deleteError.message.includes('Not Found')) {
            throw deleteError;
          }
          console.log('Task event already deleted or not found');
        }
        return true;
      }

      // If status is being set to 'needsAction' (uncompleting), recreate the calendar event
      if (updates.status === 'needsAction') {
        console.log('Task uncompleted - recreating calendar event. Original taskId:', taskId);
        
        // Get task details from existing event data (if it exists) or use provided updates/defaults
        const taskTitle = updates.title || existingEvent?.summary?.replace(/^✓\s*/, '') || 'Task';
        const taskDescription = updates.notes !== undefined 
          ? updates.notes 
          : (existingEvent?.description || '');
        const dueDate = updates.due 
          ? (updates.due.includes('T') ? updates.due.split('T')[0] : updates.due)
          : (existingEvent?.start?.date || existingEvent?.start?.dateTime?.split('T')[0] || (() => {
              // Default to today using local date to avoid timezone issues
              const today = new Date();
              const year = today.getFullYear();
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const day = String(today.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })());
        
        // Use the original taskId from extendedProperties if available, otherwise use the provided taskId
        // The taskId might be the event ID or the original task ID stored in extendedProperties
        const originalTaskId = existingEvent?.extendedProperties?.private?.eventideTaskId || taskId;
        
        const calendarEvent: calendar_v3.Schema$Event = {
          summary: `✓ ${taskTitle}`,
          description: taskDescription,
          start: {
            date: dueDate // All-day event - no timeZone for all-day events
          },
          end: {
            date: dueDate // Same day - no timeZone for all-day events
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 0 }
            ]
          },
          extendedProperties: {
            private: {
              eventideTask: 'true',
              eventideTaskId: originalTaskId, // Keep the original task ID for tracking
              eventideTaskStatus: 'needsAction'
            }
          }
        };

        const response = await this.calendar.events.insert({
          calendarId,
          requestBody: calendarEvent
        });

        const newEventId = response.data.id || '';
        console.log('Task event recreated successfully. New event ID:', newEventId, 'Original taskId:', originalTaskId);
        // Return the new event ID so frontend can update the task's ID
        return { newEventId };
      }

      // Apply updates for other status changes or non-status updates
      // Only update if event exists (if it doesn't exist and we're not uncompleting, that's an error)
      if (!updatedEvent) {
        throw new Error('Cannot update task: event does not exist');
      }

      if (updates.title !== undefined) {
        updatedEvent.summary = `✓ ${updates.title}`;
      }
      if (updates.notes !== undefined) {
        updatedEvent.description = updates.notes;
      }
      if (updates.status !== undefined && updates.status !== 'completed' && updates.status !== 'needsAction') {
        updatedEvent.extendedProperties = {
          ...updatedEvent.extendedProperties,
          private: {
            ...updatedEvent.extendedProperties?.private,
            eventideTaskStatus: updates.status
          }
        };
      }
      if (updates.due !== undefined) {
        const dueDate = updates.due.includes('T') 
          ? updates.due.split('T')[0]
          : updates.due;
        updatedEvent.start = {
          date: dueDate // All-day event - no timeZone for all-day events
        };
        updatedEvent.end = {
          date: dueDate // Same day - no timeZone for all-day events
        };
      }

      await this.calendar.events.update({
        calendarId,
        eventId: taskId,
        requestBody: updatedEvent
      });

      console.log('Task updated successfully:', taskId);
      return true;
    } catch (error: any) {
      console.error('Task update error:', error.message);
      console.error('Error details:', { taskListId, taskId, error: error.response?.data || error.message });
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  /**
   * Delete a task (stored as calendar event)
   */
  async deleteTask(taskListId: string, taskId: string): Promise<boolean> {
    try {
      if (!taskId || taskId.trim() === '') {
        throw new Error('Missing task ID');
      }

      console.log('Deleting task:', { taskListId, taskId });

      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      await this.calendar.events.delete({
        calendarId,
        eventId: taskId
      });

      console.log('Task deleted successfully:', taskId);
      return true;
    } catch (error: any) {
      // If the task is already deleted (410 Gone), treat it as success
      const errorCode = error.code || error.response?.status || error.response?.data?.error?.code;
      const errorMessage = error.message || error.response?.data?.error?.message || '';
      
      if (errorCode === 410 || 
          errorMessage.includes('deleted') || 
          errorMessage.includes('Gone') ||
          errorMessage.includes('Resource has been deleted')) {
        console.log('Task already deleted (410 Gone) - treating as success:', taskId);
        return true;
      }
      
      console.error('Task delete error:', errorMessage);
      console.error('Error details:', { taskListId, taskId, error: error.response?.data || error.message });
      throw new Error(`Failed to delete task: ${errorMessage}`);
    }
  }

  /**
   * Get default task list ID
   */
  async getDefaultTaskListId(): Promise<string> {
    try {
      const response = await this.tasks.tasklists.list({
        maxResults: 1
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].id || '@default';
      }
      return '@default';
    } catch (error: any) {
      console.error('Task list fetch error:', error.message);
      return '@default';
    }
  }
}

