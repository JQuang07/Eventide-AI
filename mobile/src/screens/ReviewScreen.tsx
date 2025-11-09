import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  KeyboardAvoidingView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../services/api';
import { CanonicalEvent } from '../types/event';
import { theme } from '../theme';

const apiService = new ApiService();

export default function ReviewScreen({ route, navigation }: any) {
  const { event: initialEvent } = route.params;
  const [event, setEvent] = useState<CanonicalEvent>(initialEvent);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Date picker states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date(event.startTime));
  const [endDate, setEndDate] = useState(event.endTime ? new Date(event.endTime) : null);

  const updateField = (field: keyof CanonicalEvent, value: any) => {
    const updatedEvent = { ...event, [field]: value };
    setEvent(updatedEvent);
    
    // Sync date picker states when times change
    if (field === 'startTime' && value) {
      setStartDate(new Date(value));
    }
    if (field === 'endTime') {
      if (value) {
        setEndDate(new Date(value));
      } else {
        setEndDate(null);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiService.save(event);
      navigation.navigate('Success', { 
        eventId: response.eventId, 
        htmlLink: response.htmlLink,
        event: event 
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
      // Update event with new ISO string
      updateField('startTime', selectedDate.toISOString());
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
      if (event.type === 'dismissed') {
        // User dismissed - don't update
        return;
      }
    }
    if (selectedDate) {
      setEndDate(selectedDate);
      // Update event with new ISO string
      updateField('endTime', selectedDate.toISOString());
    }
  };

  const removeEndTime = () => {
    setEndDate(null);
    updateField('endTime', undefined);
  };

  // Calculate completion status for color coding
  const getCompletionStatus = () => {
    const requiredFields = [event.title, event.startTime];
    const optionalFields = [event.description, event.location, event.endTime];
    const hasConflicts = event.conflicts && event.conflicts.length > 0;
    
    const requiredCount = requiredFields.filter(f => f).length;
    const optionalCount = optionalFields.filter(f => f).length;
    
    // Red: missing required fields
    if (requiredCount < requiredFields.length) {
      return { color: '#ff3b30', bgColor: 'rgba(255, 59, 48, 0.15)' };
    }
    // Yellow: has required but missing some optional OR has conflicts
    if (optionalCount < optionalFields.length || hasConflicts) {
      return { color: '#ffcc00', bgColor: 'rgba(255, 204, 0, 0.15)' };
    }
    // Green: all fields filled and no conflicts
    return { color: '#34c759', bgColor: 'rgba(52, 199, 89, 0.15)' };
  };

  const completionStatus = getCompletionStatus();

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.backButtonContainer, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Add' })}
          activeOpacity={0.7}
          disabled={saving}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={styles.topSaveButtonWrapper}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !event.title || !event.startTime}
            activeOpacity={0.8}
          >
            {saving || !event.title || !event.startTime ? (
              <View style={[styles.topSaveButton, styles.topSaveButtonDisabled]}>
                {saving ? (
                  <ActivityIndicator color={theme.colors.textSecondary} size="small" />
                ) : (
                  <Text style={styles.topSaveButtonTextDisabled}>Save</Text>
                )}
              </View>
            ) : (
              <LinearGradient
                colors={theme.colors.gradient.sunset}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topSaveButton}
              >
                <Text style={styles.topSaveButtonText}>Save</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: theme.spacing.xs }
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* Compact summary at top */}
        <View style={[styles.summaryContainer, { backgroundColor: completionStatus.bgColor, borderColor: completionStatus.color }]}>
          <View style={styles.summaryRow}>
            {/* Title */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: event.title ? '#34c75920' : '#ff3b3020' }]}>
                <Text style={styles.summaryIconText}>📝</Text>
              </View>
              <Text style={[styles.summaryLabel, !event.title && styles.summaryLabelError]} numberOfLines={1}>
                {event.title ? 'Title' : 'Missing'}
              </Text>
            </View>

            {/* Date/Time */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: event.startTime ? '#34c75920' : '#ff3b3020' }]}>
                <Text style={styles.summaryIconText}>📅</Text>
              </View>
              <Text style={[styles.summaryLabel, !event.startTime && styles.summaryLabelError]} numberOfLines={1}>
                {event.startTime ? 'Date' : 'Missing'}
              </Text>
            </View>

            {/* Location */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: event.location ? '#34c75920' : '#ffcc0020' }]}>
                <Text style={styles.summaryIconText}>📍</Text>
              </View>
              <Text style={[styles.summaryLabel, !event.location && styles.summaryLabelWarning]} numberOfLines={1}>
                {event.location ? 'Location' : 'None'}
              </Text>
            </View>

            {/* Description */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: event.description ? '#34c75920' : '#ffcc0020' }]}>
                <Text style={styles.summaryIconText}>📄</Text>
              </View>
              <Text style={[styles.summaryLabel, !event.description && styles.summaryLabelWarning]} numberOfLines={1}>
                {event.description ? 'Desc' : 'None'}
              </Text>
            </View>

            {/* Time (Start Time) */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: (event.startTime && event.startTime.includes('T')) ? '#34c75920' : '#e0e0e020' }]}>
                <Text style={styles.summaryIconText}>⏰</Text>
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                {(event.startTime && event.startTime.includes('T')) ? 'Time' : 'None'}
              </Text>
            </View>

            {/* Conflicts */}
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: (event.conflicts && event.conflicts.length > 0) ? '#ff3b3020' : '#34c75920' }]}>
                <Text style={styles.summaryIconText}>⚠️</Text>
              </View>
              <Text style={[styles.summaryLabel, (event.conflicts && event.conflicts.length > 0) && styles.summaryLabelError]} numberOfLines={1}>
                {(event.conflicts && event.conflicts.length > 0) ? 'Conflicts' : 'None'}
              </Text>
            </View>
          </View>
        </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={event.title}
          onChangeText={(text) => updateField('title', text)}
          placeholder="Event title"
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Description {!event.description && <Text style={styles.optionalLabel}>(Optional)</Text>}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={event.description || ''}
          onChangeText={(text) => updateField('description', text || undefined)}
          placeholder="Event description (optional - can leave empty)"
          multiline
          numberOfLines={3}
        />
        {!event.description && (
          <Text style={styles.hintText}>No description found - you can add one or leave empty</Text>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Start Time *</Text>
        <TouchableOpacity 
          style={styles.datePickerButton}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={styles.dateTimeText}>
            {event.startTime.includes('T') 
              ? formatDateTime(event.startTime) 
              : (() => {
                  // Parse date-only strings in local timezone to avoid timezone shifts
                  const dateStr = event.startTime;
                  if (!dateStr.includes('T')) {
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    return `All-Day Event: ${date.toLocaleDateString()}`;
                  }
                  return `All-Day Event: ${new Date(dateStr).toLocaleDateString()}`;
                })()}
          </Text>
          <Text style={styles.tapHint}>Tap to edit</Text>
        </TouchableOpacity>
        {event.startTime.includes('T') && (
          <Text style={styles.timezoneText}>Timezone: {event.timezone}</Text>
        )}
        {!event.startTime.includes('T') && (
          <Text style={styles.timezoneText}>All-day event (no specific time)</Text>
        )}
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleStartDateChange}
            minimumDate={new Date()}
          />
        )}
        {Platform.OS === 'ios' && showStartPicker && (
          <View style={styles.pickerButtonRow}>
            <TouchableOpacity
              style={styles.pickerDoneButton}
              onPress={() => setShowStartPicker(false)}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          End Time {!event.endTime && <Text style={styles.optionalLabel}>(Optional)</Text>}
        </Text>
        {/* Hide end time field for all-day events */}
        {!event.startTime.includes('T') ? (
          <Text style={styles.hintText}>All-day events don't have end times</Text>
        ) : event.endTime ? (
          <>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={styles.dateTimeText}>{formatDateTime(event.endTime)}</Text>
              <Text style={styles.tapHint}>Tap to edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={removeEndTime}
            >
              <Text style={styles.removeButtonText}>Remove End Time</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDate || new Date(startDate.getTime() + 60 * 60 * 1000)}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleEndDateChange}
                minimumDate={startDate}
              />
            )}
            {Platform.OS === 'ios' && showEndPicker && (
              <View style={styles.pickerButtonRow}>
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  onPress={() => setShowEndPicker(false)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.addEndTimeButton}
              onPress={() => {
                // Default to 1 hour after start time
                const defaultEnd = new Date(startDate.getTime() + 60 * 60 * 1000);
                setEndDate(defaultEnd);
                updateField('endTime', defaultEnd.toISOString());
                setShowEndPicker(true);
              }}
            >
              <Text style={styles.addEndTimeText}>+ Add End Time</Text>
            </TouchableOpacity>
            {showEndPicker && endDate && (
              <>
                <DateTimePicker
                  value={endDate}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={startDate}
                />
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerButtonRow}>
                    <TouchableOpacity
                      style={styles.pickerDoneButton}
                      onPress={() => setShowEndPicker(false)}
                    >
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Location {!event.location && <Text style={styles.optionalLabel}>(Optional - can leave empty)</Text>}</Text>
        <TextInput
          style={styles.input}
          value={event.location?.name || event.location?.address || ''}
          onChangeText={(text) => {
            if (text.trim()) {
              updateField('location', { name: text });
            } else {
              updateField('location', null);
            }
          }}
          placeholder="Event location (optional)"
          returnKeyType="done"
          blurOnSubmit={true}
        />
        {event.location?.address && event.location.address !== event.location?.name && (
          <Text style={styles.addressText}>{event.location.address}</Text>
        )}
        {!event.location && (
          <Text style={styles.hintText}>No location found - you can add one or leave empty</Text>
        )}
      </View>

      {event.conflicts && event.conflicts.length > 0 && (
        <View style={styles.conflictContainer}>
          <Text style={styles.conflictTitle}>⚠️ Conflicts Detected</Text>
          {event.conflicts.map((conflict, index) => (
            <Text key={index} style={styles.conflictText}>
              • {conflict.title} at {formatDateTime(conflict.startTime)}
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving || !event.title || !event.startTime}
        activeOpacity={0.8}
      >
        {saving || !event.title || !event.startTime ? (
          <View style={[styles.saveButton, styles.saveButtonDisabled]}>
            {saving ? (
              <ActivityIndicator color={theme.colors.textSecondary} />
            ) : (
              <Text style={styles.saveButtonTextDisabled}>Save to Calendar</Text>
            )}
          </View>
        ) : (
          <LinearGradient
            colors={theme.colors.gradient.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>Save to Calendar</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.backgroundLight,
    zIndex: 10,
  },
  backButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    minWidth: 80,
  },
  backButtonText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  topSaveButtonWrapper: {
    width: 70,
    alignItems: 'flex-end',
  },
  topSaveButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  topSaveButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  topSaveButtonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  topSaveButtonTextDisabled: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing['3xl']
  },
  sectionTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.base,
    color: theme.colors.text
  },
  fieldContainer: {
    marginBottom: theme.spacing.xl
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  dateTimeText: {
    fontSize: 16,
    color: '#333',
    marginTop: 4
  },
  timezoneText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  conflictContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffc107'
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#856404'
  },
  conflictText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4
  },
  saveButton: {
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.border
  },
  saveButtonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold
  },
  saveButtonTextDisabled: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
    fontStyle: 'italic'
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic'
  },
  summaryContainer: {
    borderRadius: 6,
    padding: 8,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    borderWidth: 1.5
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0
  },
  summaryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  summaryIconText: {
    fontSize: 16
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center'
  },
  summaryLabelError: {
    color: '#ff3b30'
  },
  summaryLabelWarning: {
    color: '#ff9500'
  },
  datePickerButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 4
  },
  tapHint: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontStyle: 'italic'
  },
  pickerButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  },
  pickerDoneButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  pickerDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  addEndTimeButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4
  },
  addEndTimeText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500'
  },
  removeButton: {
    marginTop: 8,
    padding: 8,
    alignItems: 'center'
  },
  removeButtonText: {
    color: '#ff3b30',
    fontSize: 14
  }
});

