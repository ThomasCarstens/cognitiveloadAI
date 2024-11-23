import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, Animated, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { auth, database } from '../../firebase';
import { ref as ref_d, onValue } from 'firebase/database';

const RechercheFormationsScreen = () => {
  const [reactionTests, setReactionTests] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const filterHeight = useState(new Animated.Value(0))[0];
  const navigation = useNavigation();

  const processChartData = (tests) => {
    // Sort tests by timestamp
    const sortedTests = [...tests].sort((a, b) => parseInt(a.date) - parseInt(b.date));

    // Calculate average reaction time for each test and format time
    const processedData = sortedTests.map(test => {
      // Calculate average reaction time
      const reactionTimes = Object.values(test.reactiontime || {});
      const avgTime = reactionTimes.length > 0 
        ? reactionTimes.reduce((sum, time) => sum + parseFloat(time), 0) / reactionTimes.length
        : 0;

      // Format timestamp to hour:minute
      const date = new Date(parseInt(test.date));
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        time: timeString,
        avgReactionTime: Math.round(avgTime)
      };
    });

    // Prepare data for the chart
    const labels = processedData.map(item => item.time);
    const data = processedData.map(item => item.avgReactionTime);

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => `rgba(26, 83, 255, ${opacity})`, // Blue color
          strokeWidth: 2,
        }
      ],
      legend: ['Average Reaction Time (ms)']
    };
  };

  useEffect(() => {
    fetchReactionTests();
    setupNavigation();
  }, []);

  useEffect(() => {
    if (reactionTests.length > 0) {
      const newChartData = processChartData(reactionTests);
      setChartData(newChartData);
    }
  }, [reactionTests]);

  const fetchReactionTests = () => {
    const reactionTestsRef = ref_d(database, 'reaction-test/');
    onValue(reactionTestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const testsArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setReactionTests(testsArray);
      }
    });
  };

  // Chart configuration
  const chartConfig = {
    backgroundColor: '#111111',
    backgroundGradientFrom: '#111111',
    backgroundGradientTo: '#111111',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#1a53ff'
    },
    formatXLabel: (value) => value,
    formatYLabel: (value) => `${value}ms`
  };

  // useEffect(() => {
  //   fetchReactionTests();
  //   setupNavigation();
  // }, []);

  // const fetchReactionTests = () => {
  //   const reactionTestsRef = ref_d(database, 'reaction-test/');
  //   onValue(reactionTestsRef, (snapshot) => {
  //     const data = snapshot.val();
  //     if (data) {
  //       const testsArray = Object.entries(data).map(([key, value]) => ({
  //         id: key,
  //         ...value
  //       }));
  //       setReactionTests(testsArray);
  //     }
  //   });
  // };

  const setupNavigation = () => {
    navigation.setOptions({
      headerShown: true,
      title: 'Reaction Tests',
      headerStyle: {
        backgroundColor: '#1a53ff',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </TouchableOpacity>
      ),
    });
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
    Animated.timing(filterHeight, {
      toValue: showFilters ? 0 : 400, // Increased height to accommodate chart
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const renderReactionTestItem = ({ item }) => (
    <View style={styles.testItem}>
      <Text style={styles.testTitle}>Test ID: {item.id}</Text>
      <Text>Date: {new Date(parseInt(item.date)).toLocaleDateString()}</Text>
      <Text>Fatigue Opinion: {item.fatigue_opinion}</Text>
      <Text>Game Number: {item.game_nb}</Text>
      <Text>User ID: {item.userId}</Text>
      <View style={styles.reactionTimes}>
        <Text>Reaction Times:</Text>
        {item.reactiontime && Object.entries(item.reactiontime).map(([key, value]) => (
          <Text key={key}>Attempt {key}: {value}ms</Text>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.filterToggleButton} onPress={toggleFilters}>
        <Text style={styles.filterToggleButtonText}>Filtres et Statistiques</Text>
        <Ionicons name={showFilters ? "chevron-up" : "chevron-down"} size={24} color="white" />
      </TouchableOpacity>

      <Animated.View style={[styles.filtersContainer, { height: filterHeight }]}>
        <ScrollView>
          <View style={styles.graphContainer}>
            <Text style={styles.graphTitle}>Average Reaction Times Throughout the Day</Text>
            {chartData && (
              <LineChart
                data={chartData}
                width={320}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                fromZero={true}
                verticalLabelRotation={45}
              />
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <FlatList
        data={reactionTests}
        renderItem={renderReactionTestItem}
        keyExtractor={item => item.id}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  filterToggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a53ff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  filterToggleButtonText: {
    color: 'white',
    fontSize: 16,
  },
  filtersContainer: {
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginBottom: 10,
  },
  graphContainer: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  graphTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  testItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  reactionTimes: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  logoutButton: {
    marginRight: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
});

export default RechercheFormationsScreen;