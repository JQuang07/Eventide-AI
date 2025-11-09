import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { ApiService } from '../services/api';
import { theme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

const apiService = new ApiService();

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

interface Task {
  id: string;
  title: string;
  due?: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
}

type ViewType = 'month' | 'week' | 'day';

export default function CalendarScreen({ navigation }: any) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'events' | 'tasks'>('events');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskNotes, setEditTaskNotes] = useState('');
  const [showViewTypeDropdown, setShowViewTypeDropdown] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadData();
  }, []);

  // Animate modal when opening
  useEffect(() => {
    if (editingTask !== null) {
      // Always start from 0 to ensure fade-in animation
      modalAnim.setValue(0);
      Animated.timing(modalAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [editingTask]);


  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, tasksData] = await Promise.all([
        apiService.getEvents(500), // Get more events for filtering
        apiService.getTasks()
      ]);
      setEvents(eventsData);
      // Ensure tasks have valid IDs - Google Tasks API returns 'id' field
      const tasksWithIds = tasksData.map((task: any) => {
        const taskId = task.id || task.taskId;
        if (!taskId) {
          console.warn('Task missing ID:', task);
        }
        return {
          ...task,
          id: taskId || `temp-${Date.now()}-${Math.random()}`
        };
      });
      console.log('Loaded tasks:', tasksWithIds.map((t: any) => ({ id: t.id, title: t.title })));
      setAllTasks(tasksWithIds);
    } catch (error: any) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filter events based on view type
  const filteredEvents = useMemo(() => {
    const now = new Date(currentDate);
    let startDate: Date;
    let endDate: Date;

    switch (viewType) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }, [events, viewType, currentDate]);

  // Filter tasks based on view type
  const filteredTasks = useMemo(() => {
    const now = new Date(currentDate);
    let startDate: Date;
    let endDate: Date;

    switch (viewType) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    return allTasks.filter(task => {
      // Include tasks without due dates in month view only
      if (!task.due) {
        return viewType === 'month';
      }
      const taskDate = new Date(task.due);
      return taskDate >= startDate && taskDate <= endDate;
    });
  }, [allTasks, viewType, currentDate]);

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${eventTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteEvent(eventId);
              setEvents(prev => prev.filter(e => e.id !== eventId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete event');
            }
          }
        }
      ]
    );
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${taskTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Store the task for potential revert
            const taskToDelete = allTasks.find(t => t.id === taskId);
            
            // Optimistically remove from UI immediately
            setAllTasks(prev => prev.filter(t => t.id !== taskId));
            
            // Make API call in background
            try {
              await apiService.deleteTask(taskId);
              // Success - task already removed from UI
            } catch (error: any) {
              // Revert on error - add task back
              if (taskToDelete) {
                setAllTasks(prev => [...prev, taskToDelete]);
              }
              Alert.alert('Error', error.message || 'Failed to delete task');
            }
          }
        }
      ]
    );
  };

  const handleToggleTaskComplete = async (task: Task) => {
    if (!task.id || task.id.trim() === '') {
      console.error('Task missing ID:', task);
      Alert.alert('Error', 'Invalid task ID');
      return;
    }
    
    // Optimistic update - update UI immediately
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const previousStatus = task.status;
    
    // Update UI immediately
    setAllTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, status: newStatus } : t
    ));
    
    // Make API call in background
    try {
      await apiService.updateTask(task.id, { status: newStatus });
      // Success - UI already updated
    } catch (error: any) {
      console.error('Toggle task error:', error);
      // Revert the optimistic update on error
      setAllTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: previousStatus } : t
      ));
      Alert.alert('Error', error.message || 'Failed to update task');
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskNotes(task.notes || '');
  };

  const handleSaveTask = async () => {
    if (!editingTask || !editTaskTitle.trim()) {
      Alert.alert('Error', 'Task title is required');
      return;
    }

    if (!editingTask.id || editingTask.id.trim() === '') {
      Alert.alert('Error', 'Invalid task ID');
      return;
    }

    // Store previous values for potential revert
    const previousTitle = editingTask.title;
    const previousNotes = editingTask.notes || '';

    // Optimistic update - update UI immediately
    setAllTasks(prev => prev.map(t => 
      t.id === editingTask.id 
        ? { ...t, title: editTaskTitle, notes: editTaskNotes }
        : t
    ));
    
    // Close modal immediately
    setEditingTask(null);
    setEditTaskTitle('');
    setEditTaskNotes('');

    // Make API call in background
    try {
      await apiService.updateTask(editingTask.id, {
        title: editTaskTitle,
        notes: editTaskNotes
      });
      // Success - UI already updated
    } catch (error: any) {
      console.error('Save task error:', error);
      // Revert the optimistic update on error
      setAllTasks(prev => prev.map(t => 
        t.id === editingTask.id 
          ? { ...t, title: previousTitle, notes: previousNotes }
          : t
      ));
      Alert.alert('Error', error.message || 'Failed to update task. Changes have been reverted.');
    }
  };

  const renderRightActions = (event: CalendarEvent) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteEvent(event.id, event.title)}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const renderRightActionsForTask = (task: Task) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteTask(task.id, task.title)}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const formatDate = (dateString: string, isAllDay: boolean) => {
    const date = !dateString.includes('T')
      ? (() => {
          const [year, month, day] = dateString.split('-').map(Number);
          return new Date(year, month - 1, day);
        })()
      : new Date(dateString);
    
    if (isAllDay) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getViewPeriodLabel = () => {
    const now = new Date(currentDate);
    switch (viewType) {
      case 'day':
        return now.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'week':
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'month':
      default:
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      switch (viewType) {
        case 'day':
          newDate.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
          break;
        case 'week':
          newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
          break;
        case 'month':
          newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
          break;
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (loading && events.length === 0 && allTasks.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: 0 }]}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + theme.spacing['2xl'] }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {/* Header with Calendar title and View Type selector */}
      <View style={[styles.headerRow, { paddingTop: insets.top + theme.spacing.md }]}>
        <Text style={styles.title}>Calendar</Text>
        <TouchableOpacity
          style={styles.viewTypeButton}
          onPress={() => setShowViewTypeDropdown(true)}
        >
          <Text style={styles.viewTypeButtonText}>
            {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
          </Text>
          <Text style={styles.viewTypeButtonIcon}>▼</Text>
        </TouchableOpacity>
      </View>
      
      {/* Date Navigation */}
      <View style={styles.viewSelectorContainer}>
        <View style={styles.dateNavigation}>
          <TouchableOpacity onPress={() => navigateDate('prev')} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={goToToday} 
            style={styles.todayButton}
          >
            <Text style={styles.todayButtonText}>{getViewPeriodLabel()}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateDate('next')} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Events ({filteredEvents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
            Tasks ({filteredTasks.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {activeTab === 'events' ? (
          filteredEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No events for this period</Text>
            </View>
          ) : (
            filteredEvents.map((event) => (
              <Swipeable
                key={event.id}
                renderRightActions={() => renderRightActions(event)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={styles.eventCard}
                  onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                >
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.isAllDay && (
                      <View style={styles.allDayBadge}>
                        <Text style={styles.allDayText}>All Day</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.eventTime}>{formatDate(event.startTime, event.isAllDay)}</Text>
                  {event.location && (
                    <Text style={styles.eventLocation}>📍 {event.location}</Text>
                  )}
                </TouchableOpacity>
              </Swipeable>
            ))
          )
        ) : (
          filteredTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>No tasks for this period</Text>
            </View>
          ) : (
            filteredTasks.map((task) => (
              <Swipeable
                key={task.id}
                renderRightActions={() => renderRightActionsForTask(task)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={[styles.taskCard, task.status === 'completed' && styles.taskCardCompleted]}
                  onPress={() => handleEditTask(task)}
                >
                  <TouchableOpacity
                    style={[
                      styles.taskCheckbox,
                      task.status === 'completed' && styles.taskCheckboxCompleted
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleToggleTaskComplete(task);
                    }}
                  >
                    <Text style={[
                      styles.taskCheckboxText,
                      task.status === 'completed' && styles.taskCheckboxTextCompleted
                    ]}>
                      {task.status === 'completed' ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskTitleCompleted]}>
                      {task.title}
                    </Text>
                    {task.due && (
                      <Text style={styles.taskDue}>
                        Due: {new Date(task.due).toLocaleDateString()}
                      </Text>
                    )}
                    {task.notes && (
                      <Text style={styles.taskNotes} numberOfLines={2}>
                        {task.notes}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </Swipeable>
            ))
          )
        )}
      </ScrollView>

      {/* Task Edit Modal */}
      <Modal
        visible={editingTask !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setEditingTask(null);
          setEditTaskTitle('');
          setEditTaskNotes('');
          Keyboard.dismiss();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setEditingTask(null);
              setEditTaskTitle('');
              setEditTaskNotes('');
              Keyboard.dismiss();
            }}
          />
          <Animated.View 
            style={[
              styles.modalContent,
              {
                opacity: modalAnim,
                transform: [{
                  translateY: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Task</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingTask(null);
                  setEditTaskTitle('');
                  setEditTaskNotes('');
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.modalLabel}>Title</Text>
              <TextInput
                style={styles.modalInput}
                value={editTaskTitle}
                onChangeText={setEditTaskTitle}
                placeholder="Task title"
                placeholderTextColor={theme.colors.textLight}
                autoFocus={true}
              />
              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editTaskNotes}
                onChangeText={setEditTaskNotes}
                placeholder="Task notes (optional)"
                placeholderTextColor={theme.colors.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setEditingTask(null);
                  setEditTaskTitle('');
                  setEditTaskNotes('');
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveTask}
              >
                <LinearGradient
                  colors={theme.colors.gradient.sunset}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonTextSave}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Type Dropdown Modal */}
      <Modal
        visible={showViewTypeDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowViewTypeDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowViewTypeDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdownOption, viewType === 'month' && styles.dropdownOptionActive]}
              onPress={() => {
                setViewType('month');
                setShowViewTypeDropdown(false);
              }}
            >
              <Text style={[styles.dropdownOptionText, viewType === 'month' && styles.dropdownOptionTextActive]}>
                Month
              </Text>
              {viewType === 'month' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownOption, viewType === 'week' && styles.dropdownOptionActive]}
              onPress={() => {
                setViewType('week');
                setShowViewTypeDropdown(false);
              }}
            >
              <Text style={[styles.dropdownOptionText, viewType === 'week' && styles.dropdownOptionTextActive]}>
                Week
              </Text>
              {viewType === 'week' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownOption, viewType === 'day' && styles.dropdownOptionActive]}
              onPress={() => {
                setViewType('day');
                setShowViewTypeDropdown(false);
              }}
            >
              <Text style={[styles.dropdownOptionText, viewType === 'day' && styles.dropdownOptionTextActive]}>
                Day
              </Text>
              {viewType === 'day' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
    padding: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    letterSpacing: -0.5,
    flex: 1,
  },
  viewSelectorContainer: {
    marginBottom: theme.spacing.md,
  },
  viewTypeButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    width: '48%',
    ...theme.shadows.sm,
  },
  viewTypeButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  viewTypeButtonIcon: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  navButton: {
    padding: theme.spacing.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  todayButton: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  todayButtonText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.textOnGradient,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['2xl'],
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  eventTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  allDayBadge: {
    backgroundColor: theme.colors.primaryLight + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  allDayText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primaryDark,
    fontWeight: theme.typography.weights.medium,
  },
  eventTime: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  eventLocation: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  deleteAction: {
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    minWidth: 80,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
  },
  taskCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  taskCardCompleted: {
    opacity: 0.7,
  },
  taskCheckbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    backgroundColor: 'transparent',
  },
  taskCheckboxCompleted: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  taskCheckboxText: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  taskCheckboxTextCompleted: {
    color: '#fff',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  taskDue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  taskNotes: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: theme.colors.backgroundLight,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxHeight: '80%',
    marginTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalCloseButton: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalScrollContent: {
    paddingBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  modalLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  modalInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonSave: {
    overflow: 'hidden',
  },
  modalButtonGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
    padding: theme.spacing.md,
  },
  modalButtonTextSave: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: theme.spacing.lg,
  },
  dropdownContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.lg,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: theme.colors.primaryLight + '10',
  },
  dropdownOptionText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  dropdownOptionTextActive: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
  },
  dropdownOptionCheck: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});
