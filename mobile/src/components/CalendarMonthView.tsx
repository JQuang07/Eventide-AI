import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import { theme } from '../theme';

const { width } = Dimensions.get('window');
const DAY_WIDTH = width / 7;

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

interface CalendarMonthViewProps {
  events: CalendarEvent[];
  onDatePress: (date: Date) => void;
  onEventPress: (event: CalendarEvent) => void;
}

export default function CalendarMonthView({ events, onDatePress, onEventPress }: CalendarMonthViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  let currentDateIter = new Date(startDate);

  while (currentDateIter <= monthEnd || currentWeek.length < 7) {
    currentWeek.push(new Date(currentDateIter));
    if (currentWeek.length === 7) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
    currentDateIter.setDate(currentDateIter.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(new Date(currentDateIter));
      currentDateIter.setDate(currentDateIter.getDate() + 1);
    }
    weeks.push(currentWeek);
  }

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = event.startTime.split('T')[0];
      return eventDate === dateStr;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
    setSelectedWeek(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedWeek(null);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const renderWeekView = (weekIndex: number) => {
    const week = weeks[weekIndex];
    const weekEvents: { [key: number]: CalendarEvent[] } = {};
    
    week.forEach((date, dayIndex) => {
      weekEvents[dayIndex] = getEventsForDate(date);
    });

    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekHeaderText}>
            {week[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
            {week[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setSelectedWeek(null)}>
            <Text style={styles.closeWeekText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.weekEventsList}>
          {week.map((date, dayIndex) => {
            const dayEvents = weekEvents[dayIndex] || [];
            return (
              <View key={dayIndex} style={styles.weekDayContainer}>
                <View style={styles.weekDayHeader}>
                  <Text style={[
                    styles.weekDayName,
                    isToday(date) && styles.weekDayNameToday
                  ]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[
                    styles.weekDayNumber,
                    isToday(date) && styles.weekDayNumberToday,
                    !isCurrentMonth(date) && styles.weekDayNumberOtherMonth
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
                {dayEvents.length > 0 ? (
                  dayEvents.map((event) => (
                    <TouchableOpacity
                      key={event.id}
                      style={[
                        styles.weekEventItem,
                        event.isAllDay && styles.weekEventItemAllDay
                      ]}
                      onPress={() => onEventPress(event)}
                    >
                      <Text style={styles.weekEventTime}>
                        {event.isAllDay 
                          ? 'All Day' 
                          : new Date(event.startTime).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit' 
                            })}
                      </Text>
                      <Text style={styles.weekEventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      {event.location && (
                        <Text style={styles.weekEventLocation} numberOfLines={1}>
                          📍 {event.location}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.weekNoEvents}>No events</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  if (selectedWeek !== null) {
    return renderWeekView(selectedWeek);
  }

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <Text style={styles.navButton}>‹</Text>
        </TouchableOpacity>
        <View style={styles.monthTitleContainer}>
          <Text style={styles.monthTitle}>{formatMonthYear(currentDate)}</Text>
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <Text style={styles.navButton}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day Names */}
      <View style={styles.dayNamesRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
          <View key={index} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <ScrollView style={styles.calendarGrid}>
        {weeks.map((week, weekIndex) => (
          <TouchableOpacity
            key={weekIndex}
            style={styles.weekRow}
            onPress={() => setSelectedWeek(weekIndex)}
            activeOpacity={0.7}
          >
            {week.map((date, dayIndex) => {
              const dayEvents = getEventsForDate(date);
              const isTodayDate = isToday(date);
              const isCurrentMonthDate = isCurrentMonth(date);

              return (
                <View
                  key={dayIndex}
                  style={[
                    styles.dayCell,
                    isTodayDate && styles.dayCellToday,
                    !isCurrentMonthDate && styles.dayCellOtherMonth
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      isTodayDate && styles.dayNumberToday,
                      !isCurrentMonthDate && styles.dayNumberOtherMonth
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {dayEvents.length > 0 && (
                    <View style={styles.dayEventsIndicator}>
                      {dayEvents.slice(0, 3).map((event, eventIndex) => (
                        <View
                          key={eventIndex}
                          style={[
                            styles.eventDot,
                            event.isAllDay && styles.eventDotAllDay
                          ]}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <Text style={styles.moreEventsText}>+{dayEvents.length - 3}</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  navButton: {
    fontSize: 32,
    color: theme.colors.primary,
    fontWeight: 'bold',
    paddingHorizontal: theme.spacing.base,
  },
  monthTitleContainer: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  monthTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  todayButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  todayButtonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  dayNamesRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayNameCell: {
    width: DAY_WIDTH,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  calendarGrid: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    minHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayCell: {
    width: DAY_WIDTH,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  dayCellToday: {
    backgroundColor: theme.colors.primaryLight + '20',
  },
  dayCellOtherMonth: {
    backgroundColor: theme.colors.backgroundLight,
    opacity: 0.4,
  },
  dayNumber: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 4,
  },
  dayNumberToday: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  dayNumberOtherMonth: {
    color: theme.colors.textSecondary,
  },
  dayEventsIndicator: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    margin: 1,
  },
  eventDotAllDay: {
    backgroundColor: theme.colors.accent,
  },
  moreEventsText: {
    fontSize: 8,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.semibold,
  },
  weekContainer: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  weekHeaderText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  closeWeekText: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  weekEventsList: {
    flex: 1,
  },
  weekDayContainer: {
    padding: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  weekDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  weekDayName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
    width: 50,
  },
  weekDayNameToday: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  weekDayNumber: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  weekDayNumberToday: {
    color: theme.colors.primary,
  },
  weekDayNumberOtherMonth: {
    color: theme.colors.textSecondary,
    opacity: 0.5,
  },
  weekEventItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  weekEventItemAllDay: {
    borderLeftColor: theme.colors.accent,
  },
  weekEventTime: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 2,
  },
  weekEventTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  weekEventLocation: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  weekNoEvents: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
  },
});

