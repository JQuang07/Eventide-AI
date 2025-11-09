import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiService } from '../services/api';
import { theme } from '../theme';
import { CanonicalEvent } from '../types/event';
import { ClickableText } from '../components/ClickableText';

const apiService = new ApiService();

interface SuggestedTask {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export default function EventDetailScreen({ route, navigation }: any) {
  const { eventId, event: initialEvent } = route.params;
  const [event, setEvent] = useState<CanonicalEvent | null>(initialEvent || null);
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
  const [loading, setLoading] = useState(!initialEvent);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!initialEvent) {
      loadEvent();
    }
  }, [eventId]);

  useEffect(() => {
    if (event) {
      loadSuggestedTasks();
    }
  }, [event]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const eventData = await apiService.getEvent(eventId);
      if (eventData) {
        // Convert to CanonicalEvent format
        setEvent({
          title: eventData.title,
          description: eventData.description,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          location: eventData.location ? { name: eventData.location } : undefined,
          timezone: 'America/New_York', // Default, should be stored
          source: 'flyer' // Default
        });
      } else {
        Alert.alert('Error', 'Event not found');
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load event');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedTasks = async () => {
    if (!event) return;
    
    try {
      const tasks = await apiService.getSuggestedTasks(event);
      setSuggestedTasks(tasks);
    } catch (error: any) {
      console.error('Error loading suggested tasks:', error);
    }
  };

  const handleAddTask = async (task: SuggestedTask) => {
    try {
      setSavingTask(task.title);
      await apiService.createTask({
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority
      });
      
      Alert.alert('Success', `Task "${task.title}" added to your tasks list`);
      // Remove from suggestions
      setSuggestedTasks(prev => prev.filter(t => t.title !== task.title));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add task');
    } finally {
      setSavingTask(null);
    }
  };

  const handleEditEvent = () => {
    if (event) {
      navigation.navigate('Review', { event, isEdit: true, eventId });
    }
  };

  const handleGoToCalendar = () => {
    navigation.navigate('MainTabs', { screen: 'Calendar' });
  };

  const formatDateTime = (isoString: string, isAllDay?: boolean) => {
    // Use parseDate utility to handle date-only strings correctly
    const date = !isoString.includes('T') 
      ? (() => {
          const [year, month, day] = isoString.split('-').map(Number);
          return new Date(year, month - 1, day); // Local timezone
        })()
      : new Date(isoString);
    
    if (isAllDay || !isoString.includes('T')) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  const isAllDay = !event.startTime.includes('T');

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: theme.spacing['2xl'] + theme.spacing.base }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Event Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Details</Text>
        <View style={styles.eventCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventTime}>
            {formatDateTime(event.startTime, isAllDay)}
          </Text>
          {event.endTime && !isAllDay && (
            <Text style={styles.eventEndTime}>
              Until: {formatDateTime(event.endTime)}
            </Text>
          )}
          {event.location && (
            <Text style={styles.eventLocation}>
              📍 {event.location.name || event.location.address}
            </Text>
          )}
          {event.description && (
            <ClickableText text={event.description} style={styles.eventDescription} />
          )}
        </View>
      </View>

      {/* Suggested Tasks */}
      {suggestedTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested Tasks</Text>
          <Text style={styles.sectionSubtitle}>
            Add reminders to help you prepare for this event
          </Text>
          {suggestedTasks.map((task, index) => (
            <View key={index} style={styles.taskCard}>
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description && (
                  <Text style={styles.taskDescription}>{task.description}</Text>
                )}
                {task.dueDate && (
                  <Text style={styles.taskDue}>
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleAddTask(task)}
                disabled={savingTask === task.title}
                activeOpacity={0.8}
              >
                {savingTask === task.title ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <LinearGradient
                    colors={theme.colors.gradient.warm}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addTaskButton}
                  >
                    <Text style={styles.addTaskText}>Add</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleEditEvent} activeOpacity={0.8} style={styles.actionButton}>
          <LinearGradient
            colors={theme.colors.gradient.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit Event</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGoToCalendar} activeOpacity={0.8} style={styles.actionButton}>
          <LinearGradient
            colors={theme.colors.gradient.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.calendarButton}
          >
            <Text style={styles.calendarButtonText}>Go to Calendar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
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
  errorText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing['2xl'],
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  eventTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  eventTime: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  eventEndTime: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  eventLocation: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  eventDescription: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.base,
    marginTop: theme.spacing.sm,
  },
  taskCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  taskContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  taskTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  taskDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  taskDue: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textLight,
  },
  addTaskButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  addTaskText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  actions: {
    marginTop: theme.spacing.lg,
  },
  actionButton: {
    marginBottom: theme.spacing.md,
  },
  editButton: {
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  editButtonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
  },
  calendarButton: {
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  calendarButtonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
  },
  backButton: {
    padding: theme.spacing.base,
    paddingBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold
  },
});

