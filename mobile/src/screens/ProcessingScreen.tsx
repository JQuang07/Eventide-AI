import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = 200;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ProcessingStage {
  percentage: number;
  description: string;
}

const VIDEO_STAGES: ProcessingStage[] = [
  { percentage: 0, description: 'Initializing...' },
  { percentage: 10, description: 'Downloading video...' },
  { percentage: 25, description: 'Extracting video frames...' },
  { percentage: 35, description: 'Extracting audio...' },
  { percentage: 45, description: 'Transcribing audio...' },
  { percentage: 55, description: 'Analyzing video frames...' },
  { percentage: 70, description: 'Extracting event details...' },
  { percentage: 80, description: 'Processing location...' },
  { percentage: 90, description: 'Validating information...' },
  { percentage: 95, description: 'Finalizing...' },
  { percentage: 100, description: 'Complete!' }
];

const IMAGE_STAGES: ProcessingStage[] = [
  { percentage: 0, description: 'Initializing...' },
  { percentage: 15, description: 'Analyzing image...' },
  { percentage: 40, description: 'Extracting event details...' },
  { percentage: 65, description: 'Processing location...' },
  { percentage: 85, description: 'Validating information...' },
  { percentage: 95, description: 'Finalizing...' },
  { percentage: 100, description: 'Complete!' }
];

const TEXT_STAGES: ProcessingStage[] = [
  { percentage: 0, description: 'Initializing...' },
  { percentage: 20, description: 'Parsing text...' },
  { percentage: 50, description: 'Extracting event details...' },
  { percentage: 75, description: 'Processing location...' },
  { percentage: 90, description: 'Validating information...' },
  { percentage: 95, description: 'Finalizing...' },
  { percentage: 100, description: 'Complete!' }
];

interface ProcessingScreenProps {
  route: {
    params: {
      onComplete: (event: any) => void;
      extractPromise: Promise<any>;
      extractionType?: 'image' | 'url' | 'text';
      abortController?: AbortController;
    };
  };
  navigation: any;
}

export default function ProcessingScreen({ route, navigation }: ProcessingScreenProps) {
  const { onComplete, extractPromise, extractionType = 'text', abortController } = route.params;
  const [progress, setProgress] = useState(0);
  const isCancelledRef = useRef(false);
  
  // Select stages based on extraction type
  const getStages = (type: 'image' | 'url' | 'text'): ProcessingStage[] => {
    if (type === 'url') {
      // URLs are typically videos, so use video stages
      return VIDEO_STAGES;
    } else if (type === 'image') {
      return IMAGE_STAGES;
    } else {
      return TEXT_STAGES;
    }
  };
  
  const PROCESSING_STAGES = getStages(extractionType);
  const [currentStage, setCurrentStage] = useState(PROCESSING_STAGES[0]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Animate progress - adjust speed based on extraction type
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        // Different increments based on extraction type
        let increment: number;
        if (extractionType === 'url') {
          // Videos take longer - slower progress
          increment = prev < 30 ? 0.8 : prev < 60 ? 0.6 : prev < 85 ? 0.4 : 0.2;
        } else if (extractionType === 'image') {
          // Images are medium speed
          increment = prev < 40 ? 1.2 : prev < 70 ? 0.8 : 0.3;
        } else {
          // Text is fastest
          increment = prev < 50 ? 1.5 : prev < 80 ? 1 : 0.3;
        }
        return Math.min(prev + increment, 95);
      });
    }, 50);

    // Update current stage based on progress
    const stageInterval = setInterval(() => {
      setProgress((currentProgress) => {
        const stage = PROCESSING_STAGES.find(
          (s, index) => 
            currentProgress >= s.percentage && 
            (index === PROCESSING_STAGES.length - 1 || currentProgress < PROCESSING_STAGES[index + 1].percentage)
        ) || PROCESSING_STAGES[0];
        setCurrentStage(stage);
        return currentProgress;
      });
    }, 50);

    // Wait for actual extraction to complete
    extractPromise
      .then((response) => {
        // Don't process if cancelled
        if (isCancelledRef.current) {
          return;
        }
        clearInterval(progressInterval);
        clearInterval(stageInterval);
        // Animate to 100%
        setProgress(100);
        setCurrentStage(PROCESSING_STAGES[PROCESSING_STAGES.length - 1]);
        
        // Small delay to show completion, then navigate
        setTimeout(() => {
          if (!isCancelledRef.current) {
            onComplete(response.event);
          }
        }, 500);
      })
      .catch((error) => {
        // Don't process if cancelled (user already navigated away)
        if (isCancelledRef.current) {
          return;
        }
        // Ignore cancellation errors
        if (error.message === 'Request cancelled') {
          return;
        }
        clearInterval(progressInterval);
        clearInterval(stageInterval);
        // On error, still show completion briefly then handle error
        setProgress(100);
        setTimeout(() => {
          if (!isCancelledRef.current) {
            navigation.goBack();
          }
        }, 500);
      });

    return () => {
      clearInterval(progressInterval);
      clearInterval(stageInterval);
      // Cancel request if component unmounts
      if (abortController && !isCancelledRef.current) {
        abortController.abort();
      }
    };
  }, [extractPromise, onComplete, navigation, abortController]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Interpolate color from red to green based on progress
  const getProgressColor = (progressValue: number) => {
    // Red at 0%, Green at 100%
    const red = Math.max(0, Math.min(255, 255 - (progressValue / 100) * 255));
    const green = Math.max(0, Math.min(255, (progressValue / 100) * 255));
    const blue = 0;
    return `rgb(${Math.round(red)}, ${Math.round(green)}, ${blue})`;
  };

  const animatedStrokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const handleCancel = () => {
    // Cancel the API request
    if (abortController) {
      abortController.abort();
    }
    isCancelledRef.current = true;
    // Navigate back to home
    navigation.navigate('MainTabs', { screen: 'Add' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.circleContainer}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={styles.svg}>
            {/* Background circle */}
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={theme.colors.border}
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />
          </Svg>
          {/* Progress circle - positioned absolutely over background */}
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={styles.svg}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={getProgressColor(progress)}
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE}
              strokeLinecap="round"
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.percentageContainer}>
            <Text style={styles.percentageText}>{Math.round(progress)}%</Text>
          </View>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{currentStage.description}</Text>
        </View>
      </View>
      
      <View style={[styles.cancelButtonContainer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    marginBottom: theme.spacing.xl,
  },
  svg: {
    position: 'absolute',
  },
  percentageContainer: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: theme.typography.sizes['4xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  descriptionContainer: {
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginTop: 0,
  },
  descriptionText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: theme.typography.weights.medium,
  },
  cancelButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  cancelButtonText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
  },
});

