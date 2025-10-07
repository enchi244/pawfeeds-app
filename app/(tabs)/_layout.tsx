import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

// --- Color Palette ---
const COLORS = {
  primary: '#8C6E63', // Kibble Brown
  accent: '#FFC107', // Golden Hour Yellow
  background: '#F5F5F5', // Soft Cream
  text: '#333333', // Charcoal Gray
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.lightGray,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];

          if (route.name === 'index') {
            iconName = 'view-dashboard';
          } else if (route.name === 'pets') {
            iconName = 'dog';
          } else if (route.name === 'schedules') {
            iconName = 'clock-outline';
          } else {
            iconName = 'help-circle'; // A fallback icon
          }

          return (
            <MaterialCommunityIcons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
      })}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Pets',
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          title: 'Schedules',
        }}
      />
    </Tabs>
  );
}

