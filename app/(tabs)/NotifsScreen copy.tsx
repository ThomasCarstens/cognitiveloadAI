import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Switch, Animated, ScrollView } from 'react-native';
import { ref as ref_d, onValue, update } from 'firebase/database';
import { database, auth } from '../../firebase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationList = ({ isAdmin, isFormateur }) => {
  const [notifications, setNotifications] = useState([]);
  const [isListening, setIsListening] = useState(true);
  const [lastTestDate, setLastTestDate] = useState(null);
  const [testStats, setTestStats] = useState({
    last3Days: 0,
    lastWeek: 0,
    lastMonth: 0
  });
  const [nextNotificationTime, setNextNotificationTime] = useState(null);
  
  const navigation = useNavigation();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    
    // Fetch notifications
    const notificationsRef = ref_d(database, '/notification-panel/');
    const testsRef = ref_d(database, `/users/${userId}/reactionTests`);
    
    // Listen for notifications
    const notificationUnsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const filteredNotifications = Object.entries(data)
          .filter(([_, notification]) => notification.received && notification.received[userId])
          .map(([id, notification]) => ({
            id,
            ...notification,
            formationId: notification.id,
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(filteredNotifications);
      }
    });

    // Listen for test data
    const testUnsubscribe = onValue(testsRef, (snapshot) => {
      const testData = snapshot.val();
      if (testData) {
        // Find last test date
        const dates = Object.values(testData).map(test => test.timestamp);
        const lastTest = Math.max(...dates);
        setLastTestDate(new Date(lastTest));

        // Calculate test counts for different periods
        const now = Date.now();
        const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const monthAgo = now - (30 * 24 * 60 * 60 * 1000);

        const stats = {
          last3Days: Object.values(testData).filter(test => test.timestamp > threeDaysAgo).length,
          lastWeek: Object.values(testData).filter(test => test.timestamp > weekAgo).length,
          lastMonth: Object.values(testData).filter(test => test.timestamp > monthAgo).length
        };
        setTestStats(stats);
      }
    });

    // Calculate next notification time (example: every 3 hours)
    const calculateNextNotification = () => {
      const now = new Date();
      const next = new Date(now.setHours(now.getHours() + 3));
      setNextNotificationTime(next);
    };
    calculateNextNotification();

    // Set up navigation options
    navigation.setOptions({
      headerShown: true,
      title: 'Notification Center',
      headerStyle: {
        backgroundColor: '#00E5FF',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
      ),
    });

    return () => {
      notificationUnsubscribe();
      testUnsubscribe();
    };
  }, [navigation]);

  const calculatePredictionQuality = () => {
    // Simple algorithm to estimate prediction quality
    const qualityScore = (testStats.last3Days * 0.5) + 
                        (testStats.lastWeek * 0.3) + 
                        (testStats.lastMonth * 0.2);
    
    if (qualityScore > 20) return 'Excellent';
    if (qualityScore > 10) return 'Good';
    if (qualityScore > 5) return 'Fair';
    return 'Poor';
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.removeItem('userUid');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // Here you would typically update the listening status in the database
    const userId = auth.currentUser?.uid;
    update(ref_d(database, `users/${userId}`), { isListening: !isListening });
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => navigation.navigate('Formation', {
        formationId: item.data,
        role: { isAdmin, isFormateur }
      })}
    >
      <Ionicons 
        name={!item.body.includes('inscription') ? 'school-outline' : 'clipboard-outline'} 
        size={24} 
        color="#007AFF" 
        style={styles.icon} 
      />
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationTime}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Status Panel */}
      <View style={styles.statusPanel}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>App Listening:</Text>
          <Switch
            value={isListening}
            onValueChange={toggleListening}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isListening ? "#f5dd4b" : "#f4f3f4"}
          />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Next Notification:</Text>
          <Text style={styles.statusValue}>
            {nextNotificationTime ? nextNotificationTime.toLocaleTimeString() : 'Not scheduled'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last Reaction Test:</Text>
          <Text style={styles.statusValue}>
            {lastTestDate ? lastTestDate.toLocaleString() : 'No tests recorded'}
          </Text>
        </View>

        <View style={styles.predictionQualityContainer}>
          <Text style={styles.statusLabel}>Prediction Quality:</Text>
          <Text style={[styles.qualityBadge, 
            styles[`quality${calculatePredictionQuality()}`]]}>
            {calculatePredictionQuality()}
          </Text>
        </View>

        <View style={styles.testStatsContainer}>
          <Text style={styles.testStatsTitle}>Recent Tests:</Text>
          <Text style={styles.testStat}>Last 3 days: {testStats.last3Days}</Text>
          <Text style={styles.testStat}>Last week: {testStats.lastWeek}</Text>
          <Text style={styles.testStat}>Last month: {testStats.lastMonth}</Text>
        </View>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        style={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  statusPanel: {
    backgroundColor: 'white',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusValue: {
    fontSize: 16,
    color: '#666',
  },
  predictionQualityContainer: {
    marginTop: 16,
  },
  qualityBadge: {
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  qualityExcellent: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  qualityGood: {
    backgroundColor: '#8BC34A',
    color: 'white',
  },
  qualityFair: {
    backgroundColor: '#FFC107',
    color: 'black',
  },
  qualityPoor: {
    backgroundColor: '#FF5722',
    color: 'white',
  },
  testStatsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  testStatsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  testStat: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
  listContainer: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
  },
  icon: {
    marginRight: 16,
  },
  logoutButton: {
    marginRight: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default NotificationList;