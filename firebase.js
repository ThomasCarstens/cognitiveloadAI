// Import the functions you need from the SDKs you need
// v9 compat packages are API compatible with v8 code
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, browserSessionPersistence, getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
// import {  } from '@react-native-firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage } from "firebase/storage";
import { getDatabase } from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// const firebaseConfig = {
//   apiKey: "AIzaSyAdIS3ti6i-cWjBcKm3_9-nBhW61F7bgxg",
//   authDomain: "appdolivier.firebaseapp.com",
//   projectId: "appdolivier",
//   storageBucket: "appdolivier.appspot.com",
//   messagingSenderId: "349759213253",
//   appId: "1:349759213253:web:b973f229c611c64a756aac",
//   measurementId: "G-YTQQ4TDLMF",
//   databaseURL: 'https://appdolivier-default-rtdb.europe-west1.firebasedatabase.app'
// };
const firebaseConfig = {

  apiKey: "AIzaSyDMq52yFXZrieExEY3IYyoT3mlJpVE5wIs",

  authDomain: "esculappl-france.firebaseapp.com",

  projectId: "esculappl-france",

  storageBucket: "esculappl-france.appspot.com",

  messagingSenderId: "891359673788",

  appId: "1:891359673788:web:8c831e29fb93bcf23e7fb9",

  measurementId: "G-K1X3T7JE18",
  databaseURL: 'https://esculappl-france-default-rtdb.europe-west1.firebasedatabase.app'


};

// Initialize Firebase

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);
// Initialize Firebase
// let app;
// if (firebase.apps.length === 0) {
//   app = firebase.initializeApp(firebaseConfig);
// } else {
//   app = firebase.app()
// }

// const auth = getAuth(app); // Deactivated to have session-persistent auth.

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});



// const auth = firebase.auth()
const storage = getStorage(app);
const database = getDatabase();
export { auth, storage, database };