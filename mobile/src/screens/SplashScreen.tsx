import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface SplashScreenProps {
  navigation: any;
}

export default function SplashScreen({ navigation }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fade in and scale up animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to Home after 1.5 seconds
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigation.replace('MainTabs');
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigation, fadeAnim, scaleAnim]);

  return (
    <LinearGradient
      colors={theme.colors.gradient.sunset}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Semi-circle graphic (sunset) - positioned behind text */}
        <View style={styles.semiCircleContainer}>
          <LinearGradient
            colors={['#FFB84D', '#FF8FA3', '#FF6B4A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.semiCircle}
          />
        </View>

        {/* Eventide AI Text - positioned over semi-circle */}
        <View style={styles.textContainer}>
          <Text style={styles.eventideText}>Eventide</Text>
          <Text style={styles.aiText}>AI</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundLight,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  semiCircleContainer: {
    position: 'absolute',
    width: 240,
    height: 120,
    top: -20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 0,
  },
  semiCircle: {
    width: 240,
    height: 120,
    borderRadius: 120,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    zIndex: 1,
    marginTop: 40,
  },
  eventideText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#8B2E6B', // Deep purple-magenta (darker than primaryDark)
    letterSpacing: -1.5,
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  aiText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#D84A8F', // Lighter magenta-pink
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

