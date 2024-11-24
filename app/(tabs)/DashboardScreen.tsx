import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useNavigation } from '@react-navigation/native';


const { width, height } = Dimensions.get('window');

const FatigueDashboard = ({ userId = "iWZ5nUDp86X5bW1k9GsfR6iJIkh1" }) => {
  const [fatigueData, setFatigueData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'My Health',
      headerStyle: {
        backgroundColor: '#00E5FF',
      },
      headerTitleStyle: {
        fontWeight: 'bold',
        color: '#000', // Set title color to black
      },
      headerTintColor: '#000',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      // headerRight: () => (
      //   <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
      //     <Text style={styles.logoutButtonText}>Se déconnecter</Text>
      //   </TouchableOpacity>
      // ),
    });
  }, [navigation]);
  useEffect(() => {
    console.log('Starting data fetch from Firebase...');
    const dataRef = ref(database, 'data_processed/');
    
    onValue(dataRef, (snapshot) => {
      console.log('Firebase snapshot received:', snapshot.exists());
      
      const data = snapshot.val();
      console.log('Raw data from Firebase:', data);
      
      if (data) {
        const userTests = Object.values(data)
          .filter(test => test.userId === userId)
          .sort((a, b) => parseInt(a.id_data) - parseInt(b.id_data));
        
        console.log('Filtered data for userId:', userId);
        console.log('Number of tests found:', userTests.length);
        console.log('Processed user tests:', userTests);
        
        setFatigueData(userTests);
      } else {
        console.log('No data received from Firebase');
      }
    }, (error) => {
      console.error('Firebase data fetch error:', error);
    });
  }, [userId]);
  
  // Add a log after state updates
  useEffect(() => {
    console.log('Current fatigue data state:', fatigueData);
    console.log('Current index:', currentIndex);
  }, [fatigueData, currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex(current => 
      current > 0 ? current - 1 : fatigueData.length - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex(current => 
      current < fatigueData.length - 1 ? current + 1 : 0
    );
  };

  const currentData = fatigueData[currentIndex];

  const FatigueLabel = ({ style, value, label }) => (
    <View style={[styles.fatigueLabel, style]}>
      <Text style={styles.fatigueLabelText}>{label}</Text>
      <Text style={styles.fatigueLabelValue}>
        {(value * 100).toFixed(0)}%
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {/* <View style={styles.header}>
        <Text style={styles.headerText}>Dashboard</Text>
      </View> */}



      {/* Main Content */}
      <View style={styles.mainContent}>
        <Image
          source={require('../../assets/images/zion_avatar.png')}
          style={styles.backgroundImage}
          resizeMode="contain"
        />

        {currentData && (
          <>
            <FatigueLabel
              style={styles.llmLabel}
              value={currentData.estimated_llm_fatigue}
              label="LLM Fatigue"
            />
            <FatigueLabel
              style={styles.saccadeLabel}
              value={currentData.estimated_saccade_fatigue}
              label="Saccade Fatigue"
            />
            <FatigueLabel
              style={styles.speechLabel}
              value={currentData.estimated_speechspeed_fatigue}
              label="Speech Speed Fatigue"
            />
          </>
        )}

        {/* Navigation Arrows */}
        <View style={styles.navigationControls}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={handlePrevious}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={handleNext}
          >
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Analysis Card */}
      <View style={styles.analysisCard}>
        <Text style={styles.analysisTitle}>Cognitive Load Analysis</Text>
        {/* <Text style={styles.analysisSubtitle}>Subject: Anonymous</Text> */}
        <Text style={styles.analysisSubtitle}>
          Date: {currentData ? new Date(parseInt(currentData.id_data)).toLocaleString() : 'Loading...'}
        </Text>
      </View>
      {/* Bottom Navigation */}
      {/* <View style={styles.bottomNav}>
        <View style={styles.bottomNavItem}>
          <Text style={[styles.bottomNavText, styles.activeNavItem]}>Dashboard</Text>
        </View>
        <View style={styles.bottomNavItem}>
          <Text style={styles.bottomNavText}>Mes notifications</Text>
        </View>
        <View style={styles.bottomNavItem}>
          <Text style={styles.bottomNavText}>ReactionTest</Text>
        </View>
      </View> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#00CED1',
    padding: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  analysisCard: {
    backgroundColor: '#1F2937',
    margin: 12,
    padding: 16,
    borderRadius: 12,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00CED1',
    marginBottom: 8,
  },
  analysisSubtitle: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  mainContent: {
    flex: 1,
    position: 'relative',
    margin: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 1,
  },
  fatigueLabel: {
    position: 'absolute',
    backgroundColor: '#00CED1',
    padding: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fatigueLabelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  fatigueLabelValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  llmLabel: {
    right: '10%',
    top: '35%',
  },
  saccadeLabel: {
    right: '5%',
    top: '5%',
  },
  speechLabel: {
    left: '5%',
    top: '55%',
  },
  navigationControls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  navButton: {
    backgroundColor: '#00CED1',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  navButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    padding: 16,
    justifyContent: 'space-around',
  },
  bottomNavItem: {
    alignItems: 'center',
  },
  bottomNavText: {
    color: 'white',
    opacity: 0.5,
  },
  activeNavItem: {
    opacity: 1,
  },
});

export default FatigueDashboard;