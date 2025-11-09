import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators, TransitionSpecs } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import { theme } from './src/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.backgroundLight,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom - 8, 0),
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Add"
        component={HomeScreen}
        options={{
          title: 'Eventide AI',
          tabBarLabel: 'Add',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>➕</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>📅</Text>
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color }}>📜</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen 
          name="Splash" 
          component={SplashScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs}
          options={{ 
            headerShown: false,
            cardStyleInterpolator: ({ current }) => {
              return {
                cardStyle: {
                  opacity: current.progress,
                },
              };
            },
            transitionSpec: {
              open: {
                animation: 'timing',
                config: {
                  duration: 400,
                },
              },
              close: {
                animation: 'timing',
                config: {
                  duration: 300,
                },
              },
            },
          }}
        />
        <Stack.Screen 
          name="Processing" 
          component={ProcessingScreen}
          options={{ 
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="Review" 
          component={ReviewScreen}
          options={{ 
            title: 'Review Event',
            headerStyle: {
              backgroundColor: theme.colors.backgroundLight,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen 
          name="Success" 
          component={SuccessScreen}
          options={{ 
            headerLeft: null, 
            title: 'Success',
            headerStyle: {
              backgroundColor: theme.colors.backgroundLight,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen 
          name="EventDetail" 
          component={EventDetailScreen}
          options={{ 
            title: 'Event Details',
            headerStyle: {
              backgroundColor: theme.colors.backgroundLight,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

