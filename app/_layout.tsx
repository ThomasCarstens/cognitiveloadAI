import React, { useState, useEffect } from 'react';
import { Image, Button, KeyboardAvoidingView, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { auth, firebase, storage, database } from '../firebase'
import { ref as ref_d, set, get, onValue } from 'firebase/database'

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons'; //https://ionic.io/ionicons/v4
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import your screen components
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import PasswordResetScreen from './screens/PasswordResetScreen';
import BackgroundInfoScreen from './screens/BackgroundInfoScreen';
import InscriptionScreen from './(tabs)/InscriptionScreen';
import RechercheFormationsScreen from './(tabs)/RechercheFormationsScreen';
import NotifsScreen from './(tabs)/NotifsScreen';
import AjoutFormationScreen from './screens/AjoutFormationScreen';
import UnderConstructionScreen from './screens/UnderConstructionScreen';
import FormationScreen from './screens/FormationScreen';
import OrganizationsPartenairesScreen from './screens/OrganizationsPartenairesScreen';
import InscriptionFormationScreen from './screens/InscriptionFormationScreen';
import RGPDScreen from './screens/RGPDScreen';
import NotifsScreenSkeleton from './skeleton/NotifsScreenSkeleton';
import NotificationExplanationScreen from './screens/NotificationExplanationScreen';
import AccountDeletionScreen from './screens/AccountDeletionScreen';
import ReactionTestScreen from './screens/ReactionTestScreen';

// import ProfilScreen from './(tabs)/ProfilScreen';
// import DemandesProfilsScreen from './(tabs)/DemandesProfilsScreen';
// import ValidationProfilScreen from './screens/ValidationProfilScreen';
// import AjoutFormateurScreen from './screens/AjoutFormateurScreen';
// import ParticipantsScreen from './screens/ParticipantsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();


// function NewUserTabs() {
//   return (
//     <Tab.Navigator 
//       screenOptions={({ route }) => ({
//         tabBarStyle: {
//           backgroundColor: '#1a53ff',
//           height: 70, // Increased height to accommodate larger text
//         },
//         tabBarIcon: ({ focused, color, size }) => {
//           let iconName;
//           if (route.name === 'Inscription') {
//             iconName = focused ? 'search' : 'search';
//           } else if (route.name === 'Notifications') {
//             iconName = focused ? 'notifications-outline' : 'notifications-outline';
//           } else if (route.name === 'Profil') {
//             iconName = focused ? 'person' : 'person';
//           }
//           return <Ionicons name={iconName} size={30} color={color} />;
//         },
//         tabBarActiveTintColor: 'black',
//         tabBarInactiveTintColor: 'white',
//         tabBarLabelStyle: {
//           fontSize: 16, // Increased font size
//           fontWeight: 'bold', // Added bold font weight for better visibility
//         },
//         tabBarIconStyle: {
//           marginTop: 5, // Added some top margin to the icon for better spacing
//         },
//       })}
//     >
//       <Tab.Screen name="Inscription" component={InscriptionScreen} />
//       <Tab.Screen name="Notifications" component={NotifsScreen} />
//       <Tab.Screen name="Profil" component={ProfilScreen} />
//     </Tab.Navigator>
//   );
// }

// function AdminTabs() {
//   return (
//     <Tab.Navigator screenOptions={({ route }) => ({
//       tabBarStyle:  {
//         backgroundColor: '#1a53ff',
//     },
//       tabBarIcon: ({ focused, color, size }) => {
//         let iconName;

//         if (route.name === 'RechercheFormations') {
//           iconName = focused ? 'search' : 'search';
//         } else if (route.name === 'Notifications') {
//           iconName = focused ? 'notifications' : 'notifications';
//         } else if (route.name === 'Administrer') {
//           iconName = focused ? 'shield-checkmark' : 'shield-checkmark';
//         } else if (route.name === 'OrganizationsPartenaires') {
//           iconName = focused ? 'information-circle-outline' : 'information-circle-outline';
//         }

        
//         // You can return any component that you like here!
//         return <Ionicons name={iconName} size={size} color={color} />;
//       },
//       tabBarActiveTintColor: 'white',
//       tabBarInactiveTintColor: 'black',
//     })}>
//       <Tab.Screen name="RechercheFormations" component={RechercheFormationsScreen} initialParams={{spoofLoggedIn: false, spoofFormateur: true, spoofAdmin: true, spoofValidated: true}} />
//       {/* <Tab.Screen name="NotifsScreenSkeleton" component={NotifsScreenSkeleton} /> */}
//       <Tab.Screen name="Administrer" component={DemandesProfilsScreen} />
//       <Tab.Screen name="OrganizationsPartenaires" component={OrganizationsPartenairesScreen} />

//     </Tab.Navigator>
//   );
// }

function App() {
  const [gameFileContext, setGameFile] =   React.useState({"isFormateur":"true", "isValidated":"true"}) //ouch
  const [isAdmin, setIsAdmin] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // In case user already logged in - else same in Login component.
  React.useMemo(()=>{
    const userLoggedIn = (auth.currentUser)
    // console.log(userLoggedIn.uid)  
    if (userLoggedIn !== null) {
      // User Roles loaded from Firebase Realtime Database.
      const gameFileRef = ref_d(database, "userdata/"+String(userLoggedIn.uid) );

      onValue(gameFileRef, (snapshot) =>  {
            const data = snapshot.val();
            if (data){
              console.log('Userdata downloaded in App.js'+ data)
              setGameFile(data)
            }
          })

      // Automatic login: if there is a current user, based on id.
      // if (userLoggedIn !== null){
      //   navigation.replace("Selection", {gameFile: gameFile})
      //   return
      // }
    }
    
      }, [])


  
  function UserTabs() {
    return (
      <Tab.Navigator screenOptions={({ route }) => ({
        tabBarStyle:  {
          backgroundColor: '#1a53ff',
      },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
  
          if (route.name === 'RechercheFormations') {
            iconName = focused ? 'search' : 'search';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications';
          } else if (route.name === 'ReactionTest') {
            iconName = focused ? 'information-circle-outline' : 'information-circle-outline';
          }
          // You can return any component that you like here!
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'white',
        tabBarInactiveTintColor: 'black',
      })}>
        <Tab.Screen name="RechercheFormations" component={RechercheFormationsScreen} initialParams={{spoofLoggedIn: true, spoofFormateur: false, spoofAdmin: false, spoofValidated: true}}/>
        <Tab.Screen name="Notifications" component={NotifsScreen} initialParams={{"gameFileContext": gameFileContext}}/>
        <Tab.Screen name="ReactionTest" component={ReactionTestScreen} initialParams={{"gameFileContext": gameFileContext}}/>
      </Tab.Navigator>
    );
  }

  function RestrainedTabs() {
    return (
      <Tab.Navigator screenOptions={({ route }) => ({
        tabBarStyle:  {
          backgroundColor: '#1a53ff',
      },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
  
          if (route.name === 'RechercheFormations') {
            iconName = focused ? 'search' : 'search';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications-outline' : 'notifications-outline';
          } else if (route.name === 'Profil') {
            iconName = focused ? 'person' : 'person';
          }
          // You can return any component that you like here!
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'white',
        tabBarInactiveTintColor: 'black',
      })}>
        <Tab.Screen name="RechercheFormations" component={RechercheFormationsScreen} initialParams={{spoofLoggedIn: false, spoofFormateur: false, spoofAdmin: false, spoofValidated: true}}/>
        {/* <Tab.Screen name="Notifications" component={NotifsScreen} initialParams={{"gameFileContext": gameFileContext}}/> */}
        {/* <Tab.Screen name="Profil" component={ProfilScreen} initialParams={{"gameFileContext": gameFileContext}}/> */}
      </Tab.Navigator>
    );
  }

  // function FormateurTabs() {
  //   return (
  //     <Tab.Navigator screenOptions={({ route }) => ({
  //       tabBarStyle:  {
  //         backgroundColor: '#1a53ff',
  //     },
  //       tabBarIcon: ({ focused, color, size }) => {
  //         let iconName;
  
  //         if (route.name === 'RechercheFormations') {
  //           iconName = focused ? 'search' : 'search';
  //         } else if (route.name === 'Notifications') {
  //           iconName = focused ? 'notifications-outline' : 'notifications-outline';
  //         } else if (route.name === 'Profil') {
  //           iconName = focused ? 'person' : 'person';
  //         }
  //         // You can return any component that you like here!
  //         return <Ionicons name={iconName} size={size} color={color} />;
  //       },
  //       tabBarActiveTintColor: 'white',
  //       tabBarInactiveTintColor: 'black',
  //     })}>
  //       <Tab.Screen name="RechercheFormations" component={RechercheFormationsScreen} initialParams={{spoofLoggedIn: true, spoofFormateur: true, spoofAdmin: false, spoofValidated: true}}/>
  //       <Tab.Screen name="Notifications" component={NotifsScreen} initialParams={{"gameFileContext": gameFileContext}}/>
  //       <Tab.Screen name="Profil" component={ProfilScreen} initialParams={{"gameFileContext": gameFileContext}}/>
  //     </Tab.Navigator>
  //   );
  // }

  // useEffect(()=>{   
  //   setGameFile({"isFormateur":"true"})
  // }, [])
  // onValue(gameFileRef, (snapshot) =>  {
  //   const data = snapshot.val();
  //   if (data){
  //     console.log('Gamefile downloaded in App.js')
  //     setGameFile(data)
  //   } 
  // })

  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator>

        <Stack.Screen name="Login"          component={LoginScreen} options={{headerShown: false}} initialParams={{"gameFileContext": gameFileContext}}  />
        <Stack.Screen name="Signup"         component={SignupScreen} />
        <Stack.Screen name="PasswordReset"  component={PasswordResetScreen} />
        <Stack.Screen name="OrganizationsPartenaires" component={OrganizationsPartenairesScreen} />
        <Stack.Screen name="RGPD" component={RGPDScreen} />
        <Stack.Screen name="NotifsScreenSkeleton"       component={NotifsScreenSkeleton} />
        <Stack.Screen name="ReactionTest" component={ReactionTestScreen}/>

        <Stack.Screen name="NotificationExplanation" component={NotificationExplanationScreen} />
        <Stack.Screen name="AccountDeletion" component={AccountDeletionScreen} />
        
        
        <Stack.Screen name="Formation"       component={FormationScreen} />
        <Stack.Screen name="RechercheFormations"  component={RechercheFormationsScreen} options={{ headerShown: true, headerBackTitleVisible: true }}/>
        <Stack.Screen name="InscriptionFormation" component={InscriptionFormationScreen} />

        {/* tabs if ADMIN */}
        {/* <Stack.Screen name="AjoutFormation"       component={AjoutFormationScreen} /> */}
        {/* <Stack.Screen name="AdminTabs"            component={AdminTabs} options={{ headerShown: false }}  /> */}
        {/* <Stack.Screen name="ValidationProfil" component={ValidationProfilScreen} /> */}
        {/* <Stack.Screen name="AjoutFormateur"       component={AjoutFormateurScreen} /> */}
        {/* <Stack.Screen name="Participants"       component={ParticipantsScreen} /> */}

        {/* tabs if NEW */}
        {/* <Stack.Screen name="NewUserTabs" component={NewUserTabs} options={{ headerShown: false }} /> */}

        {/* tabs if ETUDIANT */}
        <Stack.Screen name="UserTabs" component={UserTabs} options={{ headerShown: false }}  />

        {/* tabs if FORMATEUR */}
        {/* <Stack.Screen name="FormateurTabs" component={FormateurTabs} options={{ headerShown: false }}  /> */}
        
        {/* Restrained Functionality */}
        <Stack.Screen name="RestrainedTabs"            component={RestrainedTabs} options={{ headerShown: false }}  />

        <Stack.Screen name="UnderConstruction" component={UnderConstructionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;