// API Configuration
// For physical device (Expo Go), use your computer's IP address
// For iOS Simulator, localhost works
export const API_BASE_URL = __DEV__
  ? 'http://143.215.104.253:3000'  // Your computer's IP - update if it changes
  : 'https://your-production-api.com';

export const API_ENDPOINTS = {
  extract: `${API_BASE_URL}/extract`,
  save: `${API_BASE_URL}/save`,
  health: `${API_BASE_URL}/health`,
  calendar: {
    events: `${API_BASE_URL}/calendar/events`,
    history: `${API_BASE_URL}/calendar/history`,
  },
  tasks: {
    suggest: `${API_BASE_URL}/tasks/suggest`,
    create: `${API_BASE_URL}/tasks`,
    list: `${API_BASE_URL}/tasks`,
  },
};

