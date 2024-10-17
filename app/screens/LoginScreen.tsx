import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform, Dimensions } from 'react-native';
import { auth, storage, database } from '../../firebase';
import { getDownloadURL, list, ref } from 'firebase/storage';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref as ref_d, onValue } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState({});
  const [uid, setUid] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Chart data
  const chartData = {
    labels: ['60', '70', '80'],
    datasets: [
      {
        data: [60, 70, 80],
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        strokeWidth: 2
      },
      {
        data: [60, 90, 75],
        color: (opacity = 1) => `rgba(139, 0, 0, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ['Series 1', 'Series 2']
  };

  const chartConfig = {
    backgroundColor: '#111111',
    backgroundGradientFrom: '#111111',
    backgroundGradientTo: '#111111',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
    }
  };

  useEffect(() => {
    auth.onAuthStateChanged(function(user) {
      checkCachedUser();
    });
  }, []);

  const checkCachedUser = async () => {
    try {
      const cachedUid = await AsyncStorage.getItem('userUid');
      console.log('cache:', cachedUid)
      if (cachedUid) {
        // User UID found in cache, check if still valid
        const user = auth.currentUser;

        if (user && user.uid === cachedUid) {
          // Previous user is still logged in
          fetchUserRolesAndNavigate(cachedUid);
        } else if (user) {
            // Some other user is still logged in
            try {
              await auth.signOut();
              await AsyncStorage.removeItem('userUid');
              setLoading(false); 
            } catch (error) {
              console.error('Error logging out:', error);
            }
        } else {
          // Cached UID is no longer valid
          await AsyncStorage.removeItem('userUid');
          setLoading(false);
        }
      } else {
        // No cached UID found
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking cached user:', error);
      setLoading(false);
    }
  };

  const fetchUserRolesAndNavigate = (userId) => {
    const gameFileRef = ref_d(database, `userdata/${userId}`);
    
    onValue(gameFileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('Userdata downloaded:', data);
        
        // Tabs According to Roles -- pre-app split.

          navigation.navigate('UserTabs', { userRoles: data, formateur: true, validated: 'true' });
          
        // }
        
      } else {
        // No user data found, log out and show login screen
        handleLogout();
      }
      setLoading(false);
    });
  };

  const handleLogin = () => {
    setLoading(true);
    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredentials) => {
        const user = userCredentials.user;
        console.log('Logged in with:', user.email);
        // Cache the user's UID
        await AsyncStorage.setItem('userUid', user.uid);
        fetchUserRolesAndNavigate(user.uid);
      })
      .catch(error => {
        alert(error.message);
        setLoading(false);
      });
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.removeItem('userUid');
      setLoading(false);
    } catch (error) {
      console.error('Error logging out:', error);
      setLoading(false);
    }
  };

  const renderButton = (title, onPress, buttonStyle, textStyle) => (
    <TouchableOpacity
      style={[styles.button, styles.buttonShadow, buttonStyle]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );


  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* <Image source={require('../../assets/images/logos/cogai.jpeg')} style={styles.logo} /> */}
        <View style={styles.titleContainer}>
          <Text style={styles.appTitle}>Cognitive Load AI</Text>
          <Text style={styles.appSlogan}>Concentration management AI</Text>
        </View>
        
        <View style={styles.graphContainer}>
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        </View>

        <Text style={styles.inputLabel}>Email</Text>
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.inputLabel}>Mot de passe</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#000"
              />
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRow}>
            {renderButton("Se connecter", handleLogin, styles.primaryButton, styles.primaryButtonText)}
            {renderButton("Partenaires", () => navigation.navigate('OrganizationsPartenaires'), styles.primaryButton, styles.primaryButtonText)}
          </View>
          <View style={styles.buttonRow}>
            {renderButton("Créer un compte", () => navigation.navigate('Signup'), styles.secondaryButton, styles.secondaryButtonText)}
            {renderButton("Mot de passe oublié", () => navigation.navigate('PasswordReset'), styles.secondaryButton, styles.secondaryButtonText)}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
    borderRadius: 30,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  appSlogan: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  graphContainer: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 10,
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#333',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  buttonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'white',
    borderRadius: 5,
    borderColor: '#333',
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
  },
  eyeIcon: {
    padding: 10,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#8B0000',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#000000',
  },
  inputLabel: {
    color: 'white',
    marginBottom: 5,
    fontWeight: 'bold',
  }
});

export default LoginScreen;