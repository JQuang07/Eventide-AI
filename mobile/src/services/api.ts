import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { CanonicalEvent } from '../types/event';

export interface ExtractionRequest {
  type: 'image' | 'url' | 'text';
  data: string;
}

export interface ExtractionResponse {
  event: CanonicalEvent;
  confidence?: number;
}

export interface SaveResponse {
  success: boolean;
  eventId: string;
  htmlLink: string;
  message: string;
}

export class ApiService {
  async extract(request: ExtractionRequest, signal?: AbortSignal): Promise<ExtractionResponse> {
    try {
      const response = await axios.post<ExtractionResponse>(
        API_ENDPOINTS.extract,
        request,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000, // 30s timeout
          signal // Add abort signal
        }
      );
      return response.data;
    } catch (error: any) {
      // Handle cancellation
      if (axios.isCancel(error) || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw new Error('Request cancelled');
      }
      if (error.response) {
        throw new Error(error.response.data.error || 'Extraction failed');
      } else if (error.request) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('An unexpected error occurred');
      }
    }
  }

  async save(event: CanonicalEvent): Promise<SaveResponse> {
    try {
      const response = await axios.post<SaveResponse>(
        API_ENDPOINTS.save,
        event,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000 // 15s timeout
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data.error || 'Save failed');
      } else if (error.request) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('An unexpected error occurred');
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(API_ENDPOINTS.health, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getEvents(maxResults?: number): Promise<any[]> {
    try {
      const response = await axios.get(API_ENDPOINTS.calendar.events, {
        params: { maxResults: maxResults || 50 }
      });
      return response.data.events || [];
    } catch (error: any) {
      console.error('Get events error:', error);
      return [];
    }
  }

  async getHistory(maxResults?: number): Promise<any[]> {
    try {
      const response = await axios.get(API_ENDPOINTS.calendar.history, {
        params: { maxResults: maxResults || 100 }
      });
      return response.data.events || [];
    } catch (error: any) {
      console.error('Get history error:', error);
      return [];
    }
  }

  async getEvent(eventId: string): Promise<any | null> {
    try {
      const response = await axios.get(`${API_ENDPOINTS.calendar.events}/${eventId}`);
      return response.data.event || null;
    } catch (error: any) {
      console.error('Get event error:', error);
      return null;
    }
  }

  async getSuggestedTasks(event: CanonicalEvent): Promise<any[]> {
    try {
      const response = await axios.post(API_ENDPOINTS.tasks.suggest, event);
      return response.data.suggestions || [];
    } catch (error: any) {
      console.error('Get suggested tasks error:', error);
      return [];
    }
  }

  async createTask(task: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<{ success: boolean; taskId: string }> {
    try {
      const response = await axios.post(API_ENDPOINTS.tasks.create, task);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data.error || 'Failed to create task');
      } else if (error.request) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('An unexpected error occurred');
      }
    }
  }

  async getTasks(): Promise<any[]> {
    try {
      const response = await axios.get(API_ENDPOINTS.tasks.list);
      return response.data.tasks || [];
    } catch (error: any) {
      console.error('Get tasks error:', error);
      return [];
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_ENDPOINTS.calendar.events}/${eventId}`);
      return response.data.success || false;
    } catch (error: any) {
      console.error('Delete event error:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete event');
    }
  }

  async updateTask(taskId: string, updates: {
    title?: string;
    notes?: string;
    status?: 'needsAction' | 'completed';
    due?: string;
  }): Promise<{ success: boolean }> {
    if (!taskId || taskId.trim() === '') {
      throw new Error('Task ID is required');
    }

    try {
      // Encode the task ID to handle special characters
      const encodedTaskId = encodeURIComponent(taskId);
      console.log('Updating task:', { taskId, encodedTaskId, updates });
      
      const response = await axios.patch(`${API_ENDPOINTS.tasks.create}/${encodedTaskId}`, updates);
      return response.data;
    } catch (error: any) {
      console.error('Update task API error:', error.response?.data || error.message);
      if (error.response) {
        throw new Error(error.response.data.error || 'Failed to update task');
      } else if (error.request) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('An unexpected error occurred');
      }
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    if (!taskId || taskId.trim() === '') {
      throw new Error('Task ID is required');
    }

    try {
      // Encode the task ID to handle special characters
      const encodedTaskId = encodeURIComponent(taskId);
      console.log('Deleting task:', { taskId, encodedTaskId });
      
      const response = await axios.delete(`${API_ENDPOINTS.tasks.create}/${encodedTaskId}`);
      return response.data.success || false;
    } catch (error: any) {
      console.error('Delete task API error:', error.response?.data || error.message);
      if (error.response) {
        throw new Error(error.response.data.error || 'Failed to delete task');
      } else if (error.request) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('An unexpected error occurred');
      }
    }
  }
}

