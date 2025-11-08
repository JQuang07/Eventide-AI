import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { ApiService } from '../services/api';
import { CanonicalEvent } from '../types/event';

const apiService = new ApiService();

export default function HomeScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState('');

  const handleExtract = async (type: 'image' | 'url' | 'text', data: string) => {
    setLoading(true);
    try {
      // Step 1: Extract event info
      const response = await apiService.extract({ type, data });
      const event = response.event;
      
      // Step 2: Show review screen (user can edit/fill missing fields)
      navigation.navigate('Review', { event });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to extract event');
    } finally {
      setLoading(false);
    }
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
    }
  };

  // Handle deep links (for share sheet)
  React.useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const { url } = event;
      if (url && url.startsWith('http')) {
        await handleShareUrl(url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleShareUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Event from Anything</Text>
        <Text style={styles.subtitle}>Capture a flyer, share a URL, or paste text</Text>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Extracting event information...</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={pickImage}
          disabled={loading}
        >
          <Text style={styles.buttonText}>📷 Capture Flyer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => {
            Alert.prompt(
              'Enter URL',
              'Paste a social media or event URL',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Extract',
                  onPress: (url) => url && handleShareUrl(url || '')
                }
              ],
              'plain-text'
            );
          }}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🔗 Share URL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.textInputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Or paste event text here..."
          multiline
          numberOfLines={4}
          value={textInput}
          onChangeText={setTextInput}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.submitButton, !textInput.trim() && styles.submitButtonDisabled]}
          onPress={handleTextSubmit}
          disabled={!textInput.trim() || loading}
        >
          <Text style={styles.submitButtonText}>Extract Event</Text>
        </TouchableOpacity>
      </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 10,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center'
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20
  },
  loadingText: {
    marginTop: 10,
    color: '#666'
  },
  buttonContainer: {
    marginBottom: 30
  },
  button: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center'
  },
  primaryButton: {
    backgroundColor: '#007AFF'
  },
  secondaryButton: {
    backgroundColor: '#34C759'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  textInputContainer: {
    flex: 1
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc'
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

