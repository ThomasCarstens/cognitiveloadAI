import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { database } from '../../firebase';
import { ref, onValue, query, orderByKey, limitToLast } from 'firebase/database';

const { width, height } = Dimensions.get('window');
const AVATAR_SIZE = width * 0.3;
const METRIC_SIZE = width * 0.22;

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    console.log('Starting data fetch...');
    const dataRef = query(
      ref(database, 'data_processed'),
      orderByKey(),
      limitToLast(1)
    );

    const unsubscribe = onValue(dataRef, (snapshot) => {
      console.log('Snapshot exists:', snapshot.exists());
      if (snapshot.exists()) {
        const latestData = Object.values(snapshot.val())[0];
        console.log('Latest data:', latestData);
        setData(latestData);
        setLoading(false);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start();
      } else {
        console.log('No data found');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const MetricBubble = ({ value, label, style }) => (
    <Animated.View style={[styles.metricBubble, style]}>
      <Text style={styles.metricValue}>
        {typeof value === 'number' ? value.toFixed(2) : '---'}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  // Debug data
  const testData = {
    blink_rate: 3,
    estimated_llm_fatigue: 0.44,
    estimated_speechspeed_fatigue: 0.77,
    self_report: 0.55,
    reactiontime: { 0: 300, 1: 33, 2: 493 },
    saccade_velocities: { 0: 220, 1: 233, 2: 328 }
  };

  // Use testData for debugging, switch to real data later
  const displayData = data || testData;

  const avgReactionTime = displayData?.reactiontime
    ? Object.values(displayData.reactiontime).reduce((a, b) => a + b, 0) / 
      Object.values(displayData.reactiontime).length
    : 0;

  const avgSaccadeVelocity = displayData?.saccade_velocities
    ? Object.values(displayData.saccade_velocities).reduce((a, b) => a + b, 0) / 
      Object.values(displayData.saccade_velocities).length
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.metricsContainer}>
        {/* Top Row */}
        <View style={styles.row}>
          <MetricBubble
            value={displayData?.blink_rate}
            label="Blink Rate"
            style={styles.metric}
          />
        </View>

        {/* Middle Row */}
        <View style={styles.row}>
          <MetricBubble
            value={displayData?.estimated_llm_fatigue}
            label="LLM Fatigue"
            style={styles.metric}
          />
          
          {/* Center Avatar */}
          <View style={styles.avatarContainer}>
            <Image
              source={require('../../assets/images/stick_avatar.png')}
              style={styles.avatar}
            />
          </View>
          
          <MetricBubble
            value={displayData?.estimated_speechspeed_fatigue}
            label="Speech Fatigue"
            style={styles.metric}
          />
        </View>

        {/* Bottom Row */}
        <View style={styles.row}>
          <MetricBubble
            value={avgSaccadeVelocity}
            label="Saccade Velocity"
            style={styles.metric}
          />
          <MetricBubble
            value={avgReactionTime}
            label="Reaction Time"
            style={styles.metric}
          />
        </View>

        {/* Bottom Metric */}
        <View style={styles.row}>
          <MetricBubble
            value={displayData?.self_report}
            label="Self Report"
            style={styles.metric}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  metricsContainer: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    padding: 10,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00E5FF',
    margin: 10,
  },
  avatar: {
    width: AVATAR_SIZE * 0.8,
    height: AVATAR_SIZE * 0.8,
    tintColor: '#00E5FF',
  },
  metricBubble: {
    width: METRIC_SIZE,
    height: METRIC_SIZE,
    borderRadius: METRIC_SIZE / 2,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00E5FF',
    margin: 5,
  },
  metric: {
    margin: 5,
  },
  metricValue: {
    color: '#00E5FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});