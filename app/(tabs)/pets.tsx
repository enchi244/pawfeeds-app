import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PetsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pets Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

