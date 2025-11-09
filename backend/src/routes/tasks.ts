import express from 'express';
import { TasksService } from '../services/tasks-service';
import { CanonicalEvent } from '../types/event';
import { z } from 'zod';

const router = express.Router();
const tasksService = new TasksService();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional()
});

/**
 * POST /tasks/suggest
 * Get suggested tasks for an event
 */
router.post('/suggest', async (req, res, next) => {
  try {
    const event = req.body as CanonicalEvent;
    
    if (!event || !event.title) {
      return res.status(400).json({ error: 'Event data required' });
    }

    const suggestions = await tasksService.generateSuggestedTasks(event);
    res.json({ suggestions });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /tasks
 * Create a task in Google Tasks
 */
router.post('/', async (req, res, next) => {
  try {
    const validated = taskSchema.parse(req.body);
    const taskListId = await tasksService.getDefaultTaskListId();
    
    const taskId = await tasksService.createTask(taskListId, validated);
    
    res.json({
      success: true,
      taskId,
      message: 'Task created successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid task data', 
        details: error.errors 
      });
    }
    next(error);
  }
});

/**
 * GET /tasks
 * Get all tasks
 */
router.get('/', async (req, res, next) => {
  try {
    const taskListId = req.query.taskListId as string || '@default';
    const showCompleted = req.query.showCompleted !== 'false';
    const tasks = await tasksService.getTasks(taskListId, showCompleted);
    
    res.json({ tasks });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PATCH /tasks/:taskId
 * Update a task
 */
router.patch('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId || taskId.trim() === '') {
      console.error('Missing task ID in route params');
      return res.status(400).json({ error: 'Missing task ID' });
    }

    // Decode the task ID in case it's URL encoded
    const decodedTaskId = decodeURIComponent(taskId);
    console.log('Task update request:', { taskId: decodedTaskId, body: req.body });
    
    const taskListId = await tasksService.getDefaultTaskListId();
    console.log('Using task list ID:', taskListId);
    
    const result = await tasksService.updateTask(taskListId, decodedTaskId, req.body);
    
    if (!result) {
      return res.status(400).json({ error: 'Failed to update task' });
    }
    
    // If uncompleting, return the new event ID so frontend can update the task ID
    const response: any = { success: true, message: 'Task updated successfully' };
    if (result.newEventId) {
      response.newEventId = result.newEventId;
    }
    
    res.json(response);
  } catch (error: any) {
    console.error('Task update route error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: error.message || 'Failed to update task' });
  }
});

/**
 * DELETE /tasks/:taskId
 * Delete a task
 */
router.delete('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId || taskId.trim() === '') {
      console.error('Missing task ID in route params');
      return res.status(400).json({ error: 'Missing task ID' });
    }

    // Decode the task ID in case it's URL encoded
    const decodedTaskId = decodeURIComponent(taskId);
    console.log('Task delete request:', { taskId: decodedTaskId });
    
    const taskListId = await tasksService.getDefaultTaskListId();
    console.log('Using task list ID:', taskListId);
    
    const success = await tasksService.deleteTask(taskListId, decodedTaskId);
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to delete task' });
    }
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Task delete route error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: error.message || 'Failed to delete task' });
  }
});

export { router as tasksRouter };

