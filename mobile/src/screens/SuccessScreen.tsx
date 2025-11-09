import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

export default function SuccessScreen({ route, navigation }: any) {
  const { eventId, htmlLink, event } = route.params;
  const insets = useSafeAreaInsets();

  const openInCalendar = () => {
    navigation.navigate('MainTabs', { screen: 'Calendar' });
  };

  const createAnother = () => {
    navigation.navigate('MainTabs', { screen: 'Add' });
  };
  
  const viewEvent = () => {
    navigation.navigate('EventDetail', { eventId, event: route.params.event });
  };

  const goHome = () => {
    navigation.navigate('MainTabs', { screen: 'Add' });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.backButtonContainer, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goHome}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.successIcon}>✅</Text>
      <Text style={styles.title}>Event Created!</Text>
      <Text style={styles.message}>
        Your event has been successfully added to Google Calendar.
      </Text>

      <TouchableOpacity onPress={openInCalendar} activeOpacity={0.8}>
        <LinearGradient
          colors={theme.colors.gradient.sunset}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Open in Calendar</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={viewEvent}
      >
        <Text style={styles.secondaryButtonText}>View Event Details</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.tertiaryButton} onPress={createAnother}>
        <Text style={styles.tertiaryButtonText}>Create Another Event</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  successIcon: {
    fontSize: 80,
    marginBottom: theme.spacing.lg
  },
  title: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.base,
    textAlign: 'center',
    color: theme.colors.text
  },
  message: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing['3xl']
  },
  button: {
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
    ...theme.shadows.md
  },
  buttonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold
  },
  secondaryButton: {
    padding: theme.spacing.base,
    width: '100%',
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.base
  },
  tertiaryButton: {
    padding: theme.spacing.base,
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing.sm
  },
  tertiaryButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm
  },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    zIndex: 10,
  },
  backButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold
  }
});

