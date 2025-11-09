import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { ApiService } from '../services/api';
import { CanonicalEvent } from '../types/event';
import { theme } from '../theme';

const apiService = new ApiService();

export default function HomeScreen({ navigation }: any) {
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [isUrlPromptOpen, setIsUrlPromptOpen] = useState(false);
  const textInputAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const handleExtract = async (type: 'image' | 'url' | 'text', data: string) => {
    // Create AbortController for cancellation
    const abortController = new AbortController();
    
    // Start extraction promise with abort signal
    const extractPromise = apiService.extract({ type, data }, abortController.signal);
    
    // Navigate to processing screen
    navigation.navigate('Processing', {
      extractPromise,
      extractionType: type,
      abortController,
      onComplete: (event: any) => {
        // Navigate to review screen when complete
        navigation.navigate('Review', { event });
      }
    });
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to capture flyers');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await handleExtract('image', base64);
    }
  };

  const handleShareUrl = async (url: string) => {
    await handleExtract('url', url);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      handleExtract('text', textInput.trim());
      setTextInput('');
      setShowTextInput(false);
    }
  };

  // Handle deep links (for share sheet)
  React.useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const { url } = event;
      // Only handle HTTP/HTTPS URLs, ignore exp:// and other protocols
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        await handleShareUrl(url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      // Only handle HTTP/HTTPS URLs, ignore exp:// and other protocols
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        handleShareUrl(url);
      }
    });

    return () => subscription.remove();
  }, []);

  // Animate text input appearance
  useEffect(() => {
    if (showTextInput) {
      // Always start from 0 to ensure fade-in animation
      textInputAnim.setValue(0);
      Animated.timing(textInputAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(textInputAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [showTextInput]);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 100}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { paddingTop: Math.max(insets.top + theme.spacing.lg, theme.spacing['2xl'] + theme.spacing.base) }]}>
          <Text style={styles.title}>Create Event from Anything</Text>
          <Text style={styles.subtitle}>Capture a flyer, share a URL, or paste text</Text>

        <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={pickImage}
          activeOpacity={0.8}
          style={styles.mainButton}
        >
          <LinearGradient
            colors={theme.colors.gradient.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.button}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonEmoji}>📷</Text>
              <Text style={styles.buttonText}>Capture Media</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsUrlPromptOpen(true);
            Alert.prompt(
              'Enter URL',
              'Paste a social media or event URL',
              [
                { 
                  text: 'Cancel', 
                  style: 'cancel',
                  onPress: () => setIsUrlPromptOpen(false)
                },
                {
                  text: 'Extract',
                  onPress: (url) => {
                    setIsUrlPromptOpen(false);
                    if (url) handleShareUrl(url);
                  }
                }
              ],
              'plain-text'
            );
          }}
          activeOpacity={0.8}
          style={styles.mainButton}
        >
          <LinearGradient
            colors={theme.colors.gradient.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.button}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonEmoji}>🔗</Text>
              <Text style={styles.buttonText}>Share URL</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {!showTextInput && !isUrlPromptOpen ? (
        <TouchableOpacity
          onPress={() => setShowTextInput(true)}
          style={styles.textOptionButton}
          activeOpacity={0.7}
        >
          <Text style={styles.textOptionText}>Or paste event details here...</Text>
        </TouchableOpacity>
      ) : !showTextInput ? null : (
        <Animated.View 
          style={[
            styles.textInputWrapper,
            {
              opacity: textInputAnim,
              transform: [{
                translateY: textInputAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Paste event details here..."
              multiline
              numberOfLines={4}
              value={textInput}
              onChangeText={setTextInput}
              autoFocus={true}
              placeholderTextColor={theme.colors.textLight}
            />
            <View style={styles.textInputActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowTextInput(false);
                  setTextInput('');
                  Keyboard.dismiss();
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTextSubmit}
                disabled={!textInput.trim()}
                activeOpacity={0.8}
                style={styles.submitButtonWrapper}
              >
                {!textInput.trim() ? (
                  <View style={[styles.submitButton, styles.submitButtonDisabled]}>
                    <Text style={styles.submitButtonText}>Extract</Text>
                  </View>
                ) : (
                  <LinearGradient
                    colors={theme.colors.gradient.sunset}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitButton}
                  >
                    <Text style={styles.submitButtonText}>Extract</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundLight
  },
  title: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    marginTop: 0,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    color: theme.colors.text,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['3xl'],
    textAlign: 'center'
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    flex: 1,
    maxHeight: 300,
  },
  mainButton: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
  button: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 200,
    ...theme.shadows.md
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  buttonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
  },
  textOptionButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    alignItems: 'center',
  },
  textOptionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  textInputWrapper: {
    marginTop: theme.spacing.sm,
  },
  textInputContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  textInput: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.base,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  },
  textInputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.md,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
  },
  submitButtonWrapper: {
    flex: 1,
  },
  submitButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.sm
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.border
  },
  submitButtonText: {
    color: theme.colors.textOnGradient,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold
  }
});

