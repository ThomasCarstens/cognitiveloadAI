import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, FlatList, Animated, Linking, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { auth, firebase, storage, database } from '../../firebase'
import { ref as ref_d, set, get, onValue } from 'firebase/database'
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

// import { useNavigation } from '@react-navigation/native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const RechercheFormationsScreen = (props, { route }) => {

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      // Notifications.setNotificationChannelAsync("gameupdates", {
      //       name: "gameupdates",
      //       importance: Notifications.AndroidImportance.MAX,
      //       vibrationPattern: [0, 250, 250, 250],
      //       lightColor: "#FF231F7C",
      //   })
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      console.log(finalStatus)
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        
        Alert.alert('Erreur', 'Permission non accordée pour les notifications push !');
        return;
      }
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      console.log('projectId: ', projectId)
      if (!projectId) {
        Alert.alert('Erreur', 'ID du projet non trouvé');
        return;
      }
      try {
        const pushTokenString = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('push token string:', pushTokenString);
        const tokenRef = ref_d(database, `userdata/${auth.currentUser.uid}/notifications/token`);
        set(tokenRef, pushTokenString);
        return pushTokenString;
      } catch (e) {
        Alert.alert('Erreur', `${e}`);
      }
    } else {
      Alert.alert('Erreur', 'Les notifications push nécessitent un appareil physique');
    }
  }

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const renderTopButtons = () => (
    <View style={styles.topButtonsContainer}>
      {isUpdateAvailable && (
        <TouchableOpacity style={styles.updateButton} onPress={openAppStore}>
          <Text style={styles.updateButtonText}>Mettre à jour</Text>
        </TouchableOpacity>
      )}
      {!notificationsEnabled && (
        <TouchableOpacity 
          style={styles.notificationButton} 
          onPress={() => navigation.navigate('NotificationsExplanationScreen')}
        >
          <Text style={styles.notificationButtonText}>Activer les notifications</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // const { status } = route.params;
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(undefined);
  const notificationListener = useRef();
  const responseListener = useRef();
  const [pushTokenList, setPushTokenList] = useState([]);
  const [UidPushTokenList, setUidPushTokenList] = useState({});
  const [participantCounts, setParticipantCounts] = useState({});
  const [allDemandes, setAllDemandes] = useState({});


  const fetchParticipantCounts = () => {
    const counts = {};

    
    formations.forEach(formation => {
      let count = 0;
      // console.log('dem: ', formation.id)
      for (const eachUid in allDemandes) {
        // console.log('for formation ', formation.id, ' user is ', allDemandes[eachUid][formation.id])
        // && allDemandes[eachUid][formation.id].admin === 'Validée'
        if (allDemandes[eachUid][formation.id] ) {
          count++;
        }
      }
      counts[formation.id] = count;
    });
    // console.log('counts', counts)
    setParticipantCounts(counts);
  };


  useEffect(() => {
    // verifierConsentementPrecedent();

    registerForPushNotificationsAsync()
      .then(token => {
        setExpoPushToken(token ?? '')
      })
      .catch((error) => setExpoPushToken(`${error}`));

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      notificationListener.current &&
        Notifications.removeNotificationSubscription(notificationListener.current);
      responseListener.current &&
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
  const getExplanation = () => {
    if (status === 'granted') {
      return "Les notifications push sont actuellement activées pour Esculappl. Si vous souhaitez les désactiver, suivez les instructions ci-dessous.";
    } else {
      return "Les notifications push sont actuellement désactivées pour Esculappl. Pour profiter pleinement de l'application, nous vous recommandons de les activer. Suivez les instructions ci-dessous pour les réactiver.";
    }
  };



  // const { userDta, role } = route.params;
  const [formations, setFormations] = useState([]);
  const [filteredFormations, setFilteredFormations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const [niveauFilter, setNiveauFilter] = useState('');
  const [activeTab, setActiveTab] = useState('Visibles');
  const [isFormateur, setIsFormateur] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const filterHeight = useState(new Animated.Value(0))[0];
  const [userDemandes, setUserDemandes] = useState({});

  const [categoryFilter, setCategoryFilter] = useState('');
  const [lieuFilter, setLieuFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [anneeFilter, setAnneeFilter] = useState('');

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  // Remove niveauFilter state

  // const [categoryOptions, setCategoryOptions] = useState([]);
  // const [lieuOptions, setLieuOptions] = useState([]);
  // const [regionOptions, setRegionOptions] = useState([]);
  // const [anneeOptions, setAnneeOptions] = useState([]);

  const navigation = useNavigation();

  // const parametersRef = ref_d(database, 'parameters');
  // const paramsSnapshot = await get(paramtersRef);e
  // const parameters = paramsSnapshot.val();
  // console.log(parameters)

  const [categoryOptions, setCategoryOptions] = useState([
    "Médecine Manuelle",
    "Médecine Sport",
    "Rhumatologie",
    "Médecine Physique",
    "Autre"
  ]);
  
  const [lieuOptions, setLieuOptions] = useState([
    "Nîmes GEMMLR",
    "Toulouse AMOPY",
    "Avignon ISTM",
    "Autre"
  ]);
  
  const [regionOptions, setRegionOptions] = useState([
    "PACA",
    "Occitanie",
    "Île-de-France",
    "Grand Est",
    "Bretagne",
    "Auvergne-Rhône-Alpes",
    "Bourgogne-Franche-Comté",
    "Centre-Val de Loire",
    "Corse",
    "Hauts-de-France",
    "Normandie",
    "Nouvelle-Aquitaine",
    "Pays de la Loire",
    "Loire-Atlantique",
    "Autre"
  ]);
  
  const [anneeOptions, setAnneeOptions] = useState([
    "DIU 1",
    "DIU 2",
    "DIU 3",
    "Postgraduate",
    "Autre"
  ]);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  // useEffect(() => {
  //   console.log(route)
  // }, [route?.params]);

  useEffect(() => {
    checkForUpdates();
    downloadFilterOptions();
    fetchFormations();
    fetchUserDemandes();

    console.log(auth.currentUser?.uid)
    
    checkNotificationPermissions();
  }, []);

  useEffect(() => {
    fetchParticipantCounts();
    
  }, [allDemandes]);

  const downloadFilterOptions = async () => {
    try {
      const parametersRef = ref_d(database, 'parameters');
      const paramsSnapshot = await get(parametersRef);
      const parameters = paramsSnapshot.val();
      console.log(parameters)
    
      setCategoryOptions(parameters.categoryOptions);
      setLieuOptions(parameters.lieuOptions);
      setRegionOptions(parameters.regionOptions);
      setAnneeOptions(parameters.anneeOptions);
      // console.log(categoryOptions)
      // const [lieuOptions, setLieuOptions] = useState([]);
      // const [regionOptions, setRegionOptions] = useState([]);
      // const [anneeOptions, setAnneeOptions] = useState([]);
    } catch (error) {
      console.error('Error checking filter options:', error);
    }
  
  }


  const checkForUpdates = async () => {
    try {
      let currentVersion;
      if (Platform.OS === 'ios') {
        currentVersion = await Application.nativeApplicationVersion;
      } else {
        currentVersion = Application.nativeApplicationVersion;
      }
      console.log(currentVersion)

      const latestVersionRef = ref_d(database, '/parameters/updateParams');
      const snapshot = await get(latestVersionRef);
      const updateParams = snapshot.val()

      const latestVersion = Platform.OS === 'ios' ? updateParams.ios.forceUpdate_minimumVersion : updateParams.android.forceUpdate_minimumVersion
      
      console.log('v', latestVersion)
      console.log(compareVersions(currentVersion, latestVersion))
      if (latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
        console.log('UPDATE')
        setIsUpdateAvailable(true);
        Alert.alert(
          `Mise à jour disponible: ${latestVersion}`,
          `Vous avez une ancienne version de l\'application (${currentVersion}). Pour continuer à utiliser Esculappl, merci de télécharger la dernière version.`,
          [
            // { text: 'Plus tard', style: 'cancel' },
            { text: 'Mettre à jour', onPress: () => openAppStore(updateParams) }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
  };

  const openAppStore = (updateParams) => {
    const url = Platform.OS === 'ios'
      ? updateParams.ios.storeLink
      : updateParams.android.storeLink 
    Linking.openURL(url);
  };
  
  useEffect(() => {
    applyFilters(activeTab)
  }, [formations]);
  
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Formations',
      headerStyle: {
        backgroundColor: '#1a53ff',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerRight: () => (
        <TouchableOpacity onPress={()=>handleLogout()} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (props.route.params?.spoofFormateur) {
      setIsFormateur(props.route.params.spoofFormateur);
    }
  }, [props.route.params?.spoofFormateur]);

  useEffect(() => {
    if (props.route.params?.spoofAdmin) {
      setIsAdmin(props.route.params.spoofAdmin);
    }
  }, [props.route.params?.spoofAdmin]);

  useEffect(() => {
    if (props.route.params?.spoofLoggedIn) {
      setIsLoggedIn(props.route.params.spoofLoggedIn);
    }
  }, [props.route.params?.spoofLoggedIn]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.removeItem('userUid');
      navigation.navigate('Login');
      // navigation.
      // setLoading(false);
      
    } catch (error) {
      console.error('Error logging out:', error);
      // setLoading(false);
    }
  };

  const fetchFormations = () => {
    setLoading(true);
    const formationsRef = ref_d(database, "formations/");
    onValue(formationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        
        const formationsArray = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        setFormations(formationsArray);
        setFilteredFormations(formationsArray);
        setLoading(false);
        updateFilterOptions(formationsArray);
      } else {
        setError('Aucune formation trouvée');
        setLoading(false);
      }
    }, (error) => {
      setError('Erreur lors du chargement des formations');
      setLoading(false);
    });
  };

  const updateFilterOptions = (formationsArray) => {
    // We don't need to update the options from the formationsArray anymore
    // as we're using predefined lists. However, we might want to keep track
    // of which options are actually present in the data.
    
    const presentCategories = new Set(formationsArray.map(f => f.domaine));
    const presentLieux = new Set(formationsArray.map(f => f.lieu));
    const presentRegions = new Set(formationsArray.map(f => f.region));
    const presentAnnees = new Set(formationsArray.map(f => f.anneeConseillee));
  
    console.log("Present categories:", presentCategories);
    console.log("Present lieux:", presentLieux);
    console.log("Present regions:", presentRegions);
    console.log("Present annees:", presentAnnees);
  
    // If you want to highlight or mark which options are actually present in the data,
    // you can use these Sets to do so in your UI rendering logic.

    
  };


  // const updateFilterOptions = (formationsArray) => {

  //   // We don't need to update the options from the formationsArray anymore
  //   // as we're using predefined lists. However, we might want to keep track
  //   // of which options are actually present in the data.

  //   const updateOptions = (currentOptions, newOptions) => {
  //     const combinedOptions = new Set([...currentOptions, ...newOptions]);
  //     return Array.from(combinedOptions);
  //   };

  //   const newCategories = formationsArray.map(f => f.domaine);
  //   const newLieux = formationsArray.map(f => f.lieu);
  //   const newRegions = formationsArray.map(f => f.region);
  //   const newAnnees = formationsArray.map(f => f.anneeConseillee);

  //   setCategoryOptions(prevOptions => updateOptions(prevOptions, newCategories));
  //   setLieuOptions(prevOptions => updateOptions(prevOptions, newLieux));
  //   setRegionOptions(prevOptions => updateOptions(prevOptions, newRegions));
  //   setAnneeOptions(prevOptions => updateOptions(prevOptions, newAnnees));

  //   console.log("Updated categories:", categoryOptions);
  //   console.log("Updated lieux:", lieuOptions);
  //   console.log("Updated regions:", regionOptions);
  //   console.log("Updated annees:", anneeOptions);

  // };
  
  // const updateFilterOptions = (formationsArray) => {
  //   const categories = [...new Set(formationsArray.map(f => f.domaine))];
  //   const lieux = [...new Set(formationsArray.map(f => f.lieu))];
  //   const regions = [...new Set(formationsArray.map(f => f.region))];
  //   const annees = [...new Set(formationsArray.map(f => f.anneeConseillee))];
  //   console.log(categories)
  //   setCategoryOptions(categories);
  //   setLieuOptions(lieux);
  //   setRegionOptions(regions);
  //   setAnneeOptions(annees);
  // };

  const renderAppliedFilters = () => {
    const appliedFilters = [];
    if (categoryFilter) appliedFilters.push({ type: 'Domaine', value: categoryFilter });
    if (lieuFilter) appliedFilters.push({ type: 'Lieu', value: lieuFilter });
    if (niveauFilter) appliedFilters.push({ type: 'Niveau', value: niveauFilter });
  
    return (
      <View style={styles.appliedFiltersContainer}>
        {appliedFilters.map((filter, index) => (
          <View key={index} style={styles.appliedFilterItem}>
            <Text style={styles.appliedFilterText}>{filter.type}: {filter.value}</Text>
            <TouchableOpacity onPress={() => removeFilter(filter.type)}>
              <Ionicons name="close-circle" size={20} color="#1a53ff" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };
  const toggleFilters = () => {
    setShowFilters(!showFilters);
    Animated.timing(filterHeight, {
      toValue: showFilters ? 0 : 300,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const fetchUserDemandes = () => {
    const demandesRef = ref_d(database, `demandes/${auth.currentUser.uid}`);
    onValue(demandesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUserDemandes(data);
      }
    });

    const allDemandesRef = ref_d(database, 'demandes');
    onValue(allDemandesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAllDemandes(data);
      }
    });

  };

  const applyFilters = (tab) => {
    let filtered = formations;
    if (categoryFilter) {
      filtered = filtered.filter(f => f.domaine === categoryFilter);
    }
    if (lieuFilter) {
      filtered = filtered.filter(f => f.lieu === lieuFilter);
    }
    if (regionFilter) {
      filtered = filtered.filter(f => f.region === regionFilter);
    }
    if (anneeFilter) {
      filtered = filtered.filter(f => f.anneeConseillee === anneeFilter);
    }
    const today = new Date();
    const twoDaysFromNow = new Date(today.getTime() + (2 * 24 * 60 * 60 * 1000));
    if (tab === 'Actuelles') {
      filtered = filtered.filter(f => {
        const startDate = new Date(f.date);
        return startDate >= twoDaysFromNow;
      });
    } else if (tab === "J'y suis inscrit") {
      filtered = filtered.filter(f => 
        userDemandes[f.id] && userDemandes[f.id].admin === "Validée"
      );
    } else if (tab === 'Je propose') {
      filtered = filtered.filter(f => (f.status === 'propose'));
    } else if (tab === 'Cachées') {
      filtered = filtered.filter(f => f.active === false);
    } else {
      // 'Visibles' tab
      filtered = filtered.filter(f => f.active === true);
    }
    setFilteredFormations(filtered);
  };
  
  const renderFilterButtons = (title, options, selectedValue, setSelectedValue) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.filterButtonsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.filterButton,
              selectedValue === option && styles.filterButtonSelected
            ]}
            onPress={() => {
              
              setSelectedValue(selectedValue === option ? '' : option);
              // applyFilters(activeTab); 
              // toggleFilters();
              }}
          >
            <Text style={[
              styles.filterButtonText,
              selectedValue === option && styles.filterButtonTextSelected
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFormationItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.formationItem} 
      onPress={() => navigation.navigate('Formation', { formationId: item.id, role: {isAdmin: isAdmin, isFormateur: isFormateur} })}
    >
      <View style={styles.formationContent}>
        <Image source={{ uri: item.image }} style={styles.formationImage} />
        <View style={styles.formationDetails}>
          <Text style={styles.formationTitle}>{item.title}</Text>
          {/* {isAdmin && (
            <TouchableOpacity style={styles.participantsButton} onPress={()=>navigation.navigate("Participants", { formationId: item.id})}>
              <Text style={styles.participantsButtonText}>
                Demandes: {participantCounts[item.id] || 0}
              </Text>
            </TouchableOpacity>
          )} */}
          <Text>Début: {item.date}</Text>
          <Text>Fin: {item.date_de_fin}</Text>
          <Text>Lieu: {item.lieu}</Text>
          <Text>Tarif étudiant DIU: {item.tarifEtudiant} €</Text>
          <Text>Tarif médecin: {item.tarifMedecin} €</Text>
          {userDemandes[item.id] && (
            <Text style={styles.validationStatus}>
              Inscription: {userDemandes[item.id].admin}
            </Text>
          )}

        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement des formations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}> 
      {/* {renderTopButtons()} */}

      <View style={styles.tabContainer}>
        {(isFormateur ? ['Visibles', "J'y suis inscrit", 'Je propose', 'Cachées']
         : (isLoggedIn ? ['Toutes', 'Actuelles', "J'y suis inscrit"] : ['Visibles', 'Actuelles']))
         .map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              setActiveTab(tab);
              applyFilters(tab)
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.filterToggleButton} onPress={toggleFilters}>
        <Text style={styles.filterToggleButtonText}>Filtres de recherche</Text>
        <Ionicons name={showFilters ? "chevron-up" : "chevron-down"} size={24} color="white" />
      </TouchableOpacity>

      <Animated.View style={[styles.filtersContainer, { height: filterHeight }]}>
      <TouchableOpacity style={styles.applyFilterButton} onPress={() => { applyFilters(); toggleFilters(); }}>
            <Text style={styles.applyFilterButtonText}>Lancer ma recherche</Text>
          </TouchableOpacity>
        <ScrollView>
          {renderFilterButtons('Domaine', categoryOptions, categoryFilter, setCategoryFilter)}
          {renderFilterButtons('Année conseillée', anneeOptions, anneeFilter, setAnneeFilter)}
          {renderFilterButtons('Lieu', lieuOptions, lieuFilter, setLieuFilter)}
          
          {renderFilterButtons('Region', regionOptions, regionFilter, setRegionFilter)}
          
          

        </ScrollView>
      </Animated.View>

      <FlatList
        data={filteredFormations}
        renderItem={renderFormationItem}
        keyExtractor={item => item.id}
        style={styles.list}
      />

      {/* {isFormateur && (
        <TouchableOpacity 
          style={styles.newFormationButton}
          onPress={() => navigation.navigate('AjoutFormation')}
        >
          <Text style={styles.newFormationButtonText}>+</Text>
        </TouchableOpacity>
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  participantsButton: {
    backgroundColor: '#1a53ff',
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
  },
  participantsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
    explanationText: {
    fontSize: 14,
    color: '#333',
  },
  formationItem: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#d5dcf0',
    borderRadius: 10,
    shadowColor: "orange",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  formationContent: {
    flexDirection: 'row',
  },
  formationImage: {
    width: 120,
    height: 180,
    borderRadius: 30,
    marginRight: 15,
  },
  formationDetails: {
    flex: 1,
  },
  formationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  filtersContainer: {
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  filterButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    margin: 4,
    borderWidth: 1,
    borderColor: '#1a53ff',
  },  
  filterButtonText: {
    color: '#1a53ff',
  },
  applyFilterButton: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 20,
    // width:200,
    alignItems: 'center',
    // marginTop: 5,
    marginHorizontal: 10,

  },
  applyFilterButtonText: {
    color: 'white',
    fontSize: 16,
  },
  container: {
    flex: 1,
    padding: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  activeTab: {
    backgroundColor: '#1a53ff',
  },
  tabText: {
    color: '#333',
  },
  activeTabText: {
    color: 'white',
  },
  // filterButton: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   backgroundColor: '#1a53ff',
  //   padding: 10,
  //   borderRadius: 5,
  //   marginBottom: 10,
  // },
  // filterButtonText: {
  //   color: 'white',
  //   fontSize: 16,
  // },
  // filtersContainer: {
  //   overflow: 'hidden',
  //   marginBottom: 10,
  // },
  picker: {
    height: 40,
    marginBottom: 5,
  },
  // applyFilterButton: {
  //   backgroundColor: '#1a53ff',
  //   padding: 10,
  //   borderRadius: 5,
  //   alignItems: 'center',
  // },
  // applyFilterButtonText: {
  //   color: 'white',
  //   fontSize: 16,
  // },
  list: {
    flex: 1,
  },
  newFormationButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1a53ff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newFormationButtonText: {
    color: 'white',
    fontSize: 35,
    fontWeight: '200',
  },
  // formationTitle: {
  //   fontSize: 18,
  //   fontWeight: 'bold',
  //   marginBottom: 5,
  // },
  // formationImage: {
  //   width: '100%',
  //   height: 150,
  //   marginBottom: 10,
  //   borderRadius: 5,
  // },

  
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
  
  filterSection: {
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  filterButtonSelected: {
    backgroundColor: '#1a53ff',
  },

  filterButtonTextSelected: {
    color: 'white',
  },
  validationStatus: {
    marginTop: 5,
    fontWeight: 'bold',
    color: '#1a53ff',
  },
  logoutButton: {
    marginRight: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  topButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  updateButton: {
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  updateButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  notificationButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginLeft: 5,
  },
  notificationButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default RechercheFormationsScreen;
