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
  TouchableWithoutFeedback
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ApiService } from '../services/api';
import { CanonicalEvent } from '../types/event';

const apiService = new ApiService();

export default function ReviewScreen({ route, navigation }: any) {
  const { event: initialEvent } = route.params;
  const [event, setEvent] = useState<CanonicalEvent>(initialEvent);
  const [saving, setSaving] = useState(false);
  
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
      navigation.navigate('Success', { eventId: response.eventId, htmlLink: response.htmlLink });
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView 
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.sectionTitle}>Event Details</Text>

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
          <Text style={styles.dateTimeText}>{formatDateTime(event.startTime)}</Text>
          <Text style={styles.tapHint}>Tap to edit</Text>
        </TouchableOpacity>
        <Text style={styles.timezoneText}>Timezone: {event.timezone}</Text>
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
        {event.endTime ? (
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

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <Text style={styles.summaryText}>
          {event.title ? '✅ Title' : '❌ Title'} • {' '}
          {event.startTime ? '✅ Date/Time' : '❌ Date/Time'} • {' '}
          {event.location ? '✅ Location' : '⚠️ No Location'} • {' '}
          {event.description ? '✅ Description' : '⚠️ No Description'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving || !event.title}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save to Calendar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        disabled={saving}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  fieldContainer: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333'
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
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
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc'
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16
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
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF'
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF'
  },
  summaryText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20
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

