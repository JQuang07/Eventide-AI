import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '../services/api';
import { theme } from '../theme';

const apiService = new ApiService();

interface HistoryEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
  source: 'flyer' | 'url' | 'text' | 'email';
  createdAt: string;
}

export default function HistoryScreen({ navigation }: any) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const historyData = await apiService.getHistory();
      setEvents(historyData);
    } catch (error: any) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const isPastEvent = (startTime: string) => {
    return new Date(startTime) < new Date();
  };

  const handleEventPress = (event: HistoryEvent) => {
    navigation.navigate('EventDetail', { 
      eventId: event.id,
      event: event 
    });
  };

  if (loading && !refreshing && events.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: 0 }]}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + theme.spacing['2xl'] }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + theme.spacing.md }]}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>All events added through Eventide AI</Text>
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
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptySubtext}>Events you add will appear here</Text>
          </View>
        ) : (
          events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventCard, isPastEvent(event.startTime) && styles.eventCardPast]}
              onPress={() => handleEventPress(event)}
            >
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceText}>
                    {event.source === 'flyer' ? '📷' : event.source === 'url' ? '🔗' : '📝'}
                  </Text>
                </View>
              </View>
              <Text style={styles.eventTime}>
                {event.isAllDay 
                  ? (() => {
                      // Parse date-only strings in local timezone to avoid timezone shifts
                      const dateStr = event.startTime;
                      if (!dateStr.includes('T')) {
                        const [year, month, day] = dateStr.split('-').map(Number);
                        return new Date(year, month - 1, day).toLocaleDateString();
                      }
                      return new Date(dateStr).toLocaleDateString();
                    })()
                  : formatDate(event.startTime)}
              </Text>
              {event.location && (
                <Text style={styles.eventLocation}>📍 {event.location}</Text>
              )}
              {event.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
              )}
              <View style={styles.eventFooter}>
                <Text style={styles.eventDate}>
                  Added {new Date(event.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
    padding: theme.spacing.lg,
  },
  headerContainer: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['2xl'],
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
    paddingVertical: theme.spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
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
  eventCardPast: {
    opacity: 0.8,
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
  sourceBadge: {
    marginLeft: theme.spacing.sm,
  },
  sourceText: {
    fontSize: theme.typography.sizes.base,
  },
  eventTime: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  eventLocation: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  eventDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  eventFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  eventDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textLight,
  },
});

