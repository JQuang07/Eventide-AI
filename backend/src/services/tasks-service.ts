import { tasks_v1, google } from 'googleapis';
import { CanonicalEvent } from '../types/event';

export interface SuggestedTask {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export class TasksService {
  private tasks: tasks_v1.Tasks;
  private auth: any;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/tasks']
    });

    this.tasks = google.tasks({ version: 'v1', auth });
  }

  /**
   * Generate suggested tasks based on event
   */
  generateSuggestedTasks(event: CanonicalEvent): SuggestedTask[] {
    const suggestions: SuggestedTask[] = [];
    const eventDate = new Date(event.startTime);
    const oneDayBefore = new Date(eventDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);

    // Location-based suggestions
    if (event.location) {
      suggestions.push({
        title: 'Plan travel route',
        description: `Get directions to ${event.location.name || event.location.address}`,
        dueDate: oneDayBefore.toISOString().split('T')[0],
        priority: 'medium'
      });
    }

    // Description-based suggestions
    const descLower = (event.description || '').toLowerCase();
    
    if (descLower.includes('ticket') || descLower.includes('purchase')) {
      suggestions.push({
        title: 'Purchase tickets',
        description: 'Buy tickets for the event',
        dueDate: oneDayBefore.toISOString().split('T')[0],
        priority: 'high'
      });
    }

    if (descLower.includes('rsvp') || descLower.includes('register') || descLower.includes('confirm')) {
      suggestions.push({
        title: 'Send RSVP',
        description: 'Confirm your attendance',
        dueDate: oneDayBefore.toISOString().split('T')[0],
        priority: 'high'
      });
    }

    if (descLower.includes('presentation') || descLower.includes('meeting') || descLower.includes('prepare')) {
      suggestions.push({
        title: 'Prepare materials',
        description: 'Gather materials for the event',
        dueDate: oneDayBefore.toISOString().split('T')[0],
        priority: 'medium'
      });
    }

    // Title-based suggestions
    const titleLower = event.title.toLowerCase();
    if (titleLower.includes('concert') || titleLower.includes('show')) {
      suggestions.push({
        title: 'Check parking/transportation',
        description: 'Plan how to get to the venue',
        dueDate: oneDayBefore.toISOString().split('T')[0],
        priority: 'medium'
      });
    }

    if (titleLower.includes('dinner') || titleLower.includes('lunch') || titleLower.includes('restaurant')) {
      suggestions.push({
        title: 'Make reservation',
        description: 'Confirm restaurant reservation if needed',
        dueDate: oneDayBefore.toISOString().split('T')[0],
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Create a task in Google Tasks
   */
  async createTask(taskListId: string, task: SuggestedTask): Promise<string> {
    try {
      const taskBody: tasks_v1.Schema$Task = {
        title: task.title,
        notes: task.description,
        due: task.dueDate ? `${task.dueDate}T00:00:00.000Z` : undefined,
        status: 'needsAction'
      };

      const response = await this.tasks.tasks.insert({
        tasklist: taskListId,
        requestBody: taskBody
      });

      return response.data.id || '';
    } catch (error: any) {
      console.error('Task creation error:', error.message);
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  /**
   * Get all tasks from default task list
   */
  async getTasks(taskListId: string = '@default', showCompleted: boolean = true): Promise<tasks_v1.Schema$Task[]> {
    try {
      const response = await this.tasks.tasks.list({
        tasklist: taskListId,
        showCompleted,
        maxResults: 100
      });

      return response.data.items || [];
    } catch (error: any) {
      console.error('Tasks fetch error:', error.message);
      return [];
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskListId: string, taskId: string, updates: {
    title?: string;
    notes?: string;
    status?: 'needsAction' | 'completed';
    due?: string;
  }): Promise<boolean> {
    try {
      if (!taskId || taskId.trim() === '') {
        throw new Error('Missing task ID');
      }

      if (!taskListId || taskListId.trim() === '') {
        throw new Error('Missing task list ID');
      }

      console.log('Updating task:', { taskListId, taskId, updates });

      // First, try to get the task to verify it exists and get its current state
      let existingTask;
      try {
        const getResponse = await this.tasks.tasks.get({
          tasklist: taskListId,
          task: taskId
        });
        existingTask = getResponse.data;
        console.log('Found existing task:', existingTask.id, existingTask.title);
      } catch (getError: any) {
        console.error('Task not found:', getError.message);
        throw new Error(`Task not found: ${getError.message}`);
      }

      const taskBody: tasks_v1.Schema$Task = {
        id: taskId, // Include the ID in the request body
        ...existingTask // Start with existing task data
      };
      
      // Apply updates
      if (updates.title !== undefined) taskBody.title = updates.title;
      if (updates.notes !== undefined) taskBody.notes = updates.notes;
      if (updates.status !== undefined) taskBody.status = updates.status;
      if (updates.due !== undefined) {
        taskBody.due = updates.due.includes('T') 
          ? updates.due 
          : `${updates.due}T00:00:00.000Z`;
      }

      const updateResponse = await this.tasks.tasks.update({
        tasklist: taskListId,
        task: taskId,
        requestBody: taskBody
      });

      console.log('Task updated successfully:', updateResponse.data.id);
      return true;
    } catch (error: any) {
      console.error('Task update error:', error.message);
      console.error('Error details:', { taskListId, taskId, error: error.response?.data || error.message });
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskListId: string, taskId: string): Promise<boolean> {
    try {
      if (!taskId || taskId.trim() === '') {
        throw new Error('Missing task ID');
      }

      if (!taskListId || taskListId.trim() === '') {
        throw new Error('Missing task list ID');
      }

      console.log('Deleting task:', { taskListId, taskId });

      await this.tasks.tasks.delete({
        tasklist: taskListId,
        task: taskId
      });

      console.log('Task deleted successfully:', taskId);
      return true;
    } catch (error: any) {
      console.error('Task delete error:', error.message);
      console.error('Error details:', { taskListId, taskId, error: error.response?.data || error.message });
      throw new Error(`Failed to delete task: ${error.message}`);
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

