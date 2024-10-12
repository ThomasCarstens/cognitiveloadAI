import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { auth, firebase, storage, database } from '../../firebase';
import { ref as ref_d, set, get, onValue, update } from 'firebase/database';



const FormationScreen = ({ route, navigation }) => {
  const { formationId, role } = route.params;
  const [formation, setFormation] = useState(null);
  const [inscriptionStatus, setInscriptionStatus] = useState(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [isDateValid, setIsDateValid] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Formation',
      headerStyle: {
        backgroundColor: '#00008B',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    //   tabBarStyle: {
    //     display:'flex',
    //     backgroundColor: '#6458D7',
    //     borderTopEndRadius: 18,
    //     borderTopLeftRadius: 18,
    // }
    });
  }, [navigation]);
  useEffect(() => {
    console.log(formationId)
    const formationRef = ref_d(database, `/formations/${formationId}`);
    const unsubscribe = onValue(formationRef, (snapshot) => {
      const data = snapshot.val();
      console.log(data)
      if (data) {
        setFormation(data);
        checkDateValidity(data.date);
      } else {
        Alert.alert("Erreur", "Formation non trouvée");
        navigation.goBack();
      }
    });

    // Vérifier le statut d'inscription
    const checkInscriptionStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        const demandeRef = ref_d(database, `/demandes/${user.uid}/${formationId}`);
        const snapshot = await get(demandeRef);
        if (snapshot.exists()) {
          setInscriptionStatus(snapshot.val().admin);
        } else {
          setInscriptionStatus(null);
        }
      }
    };

    // Vérifier le consentement RGPD
    const checkConsent = async () => {
      const user = auth.currentUser;
      if (user) {
        const consentRef = ref_d(database, `/consentement/${user.uid}`);
        const snapshot = await get(consentRef);
        
        setHasConsent(snapshot.val() === true);
      }
    };

    checkInscriptionStatus();
    checkConsent();

    return () => unsubscribe();
  }, [formationId]);

  const checkDateValidity = (date) => {
    const formationDate = new Date(date);
    const currentDate = new Date();
    const twoDaysFromNow = new Date(currentDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    setIsDateValid(formationDate > twoDaysFromNow);
  };

  const handleSignUp = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Erreur", "Vous devez être connecté pour vous inscrire.");
      return;
    }
    
    if (inscriptionStatus) {
      Alert.alert(`Inscription ${inscriptionStatus}`, "Nous ne permettons qu'une inscription par formation. Pour plus d'informations sur votre inscription, contactez notre email d'assistance: contact.esculappl@gmail.com");
      return;
    }
    
    if (!isDateValid) {
      Alert.alert(
        "Inscription impossible sur Esculappl",
        "La formation commence dans moins de 2 jours ou est déjà passée. Veuillez contacter contact.esculappl@gmail.com pour toute demande urgente."
      );
      return;
    }

    if (!hasConsent) {
      Alert.alert(
        "Consentement RGPD requis",
        "Vous devez donner votre consentement RGPD pour vous inscrire à cette formation.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Donner mon consentement", onPress: () => {
            navigation.navigate('UserTabs');
            navigation.push('RGPD')
          
          }}
        ]
      );
      return;
    }

    // Procéder à l'inscription
    navigation.navigate('InscriptionFormation', { formationId: formation.id, formationTitle: formation.title });
  };

  const handleUnsubscribe = () => {
    if (!isDateValid) {
      Alert.alert(
        "Impossible de se désinscrire",
        "La formation commence dans moins de 2 jours ou est déjà passée. Veuillez contacter contact.esculappl@gmail.com pour toute modification."
      );
      return;
    }

    Alert.alert(
      "Confirmation",
      "Êtes-vous sûr de vouloir vous désinscrire de cette formation ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: async () => {
          const user = auth.currentUser;
          if (user) {
            // const demandeRef = ref_d(database, `/demandes/${user.uid}/${formationId}`);
            await update(ref_d(database, `/demandes/${user.uid}/${formationId}`), { admin: "désinscrit" });

            
            setInscriptionStatus("désinscrit");
            Alert.alert("Succès", "Vous avez été désinscrit de la formation.");
          }
        }}
      ]
    );
  };

  const getButtonStyle = () => {
    if (!inscriptionStatus || inscriptionStatus === "désinscrit") return styles.signUpButton;
    return { ...styles.signUpButton, backgroundColor: '#808080' };
  };

  const getButtonText = () => {
    switch (inscriptionStatus) {
      case "en attente": return "Inscription en attente";
      case "Rejetée": return "Inscription rejetée";
      case "Validée": return "Se désinscrire";
      default: return "S'inscrire";
    }
  };

  const handleButtonPress = () => {
    console.log('inscriptionStatus: ', inscriptionStatus)
    console.log('hasConsent: ', hasConsent)
    if (inscriptionStatus === "Validée") {
      
      handleUnsubscribe();
    } else if (!inscriptionStatus ||inscriptionStatus=== "Rejetée" ||  inscriptionStatus === "désinscrit") {
      handleSignUp();
      
    }
  };
  const handleDelete = () => {
    let toggleAction = (formation.active) ? "Désactiver" : "Réactiver";
    Alert.alert(
      "Confirmation",
      `Êtes-vous sûr de vouloir ${toggleAction} cette formation ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: toggleAction, onPress: () => {
          const formationRef = ref_d(database, `/formations/${formationId}`);
          set(formationRef, { ...formation, active: !(formation.active) })
            .then(() => {
              Alert.alert("Succès", `La formation a été ${toggleAction.toLowerCase()}`);
              navigation.goBack();
            })
            .catch((error) => {
              Alert.alert("Erreur", "Impossible de modifier la formation");
            });
        }}
      ]
    );
  };

  if (!formation) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: formation.image }} style={styles.image} />
      <Text style={styles.title}>{formation.title}</Text>
      {/* {(role.isAdmin === true) ? (
         <View style={styles.buttonContainer}>
         {formation.active && (
           <TouchableOpacity 
             style={getButtonStyle()}
             onPress={handleButtonPress}
             disabled={inscriptionStatus === "en attente" || inscriptionStatus === "Rejetée"}
           >
             <Text style={[
               styles.signUpButtonText, 
               inscriptionStatus === "Validée" ? { color: 'red' } : null
             ]}>
               {getButtonText()}
             </Text>
           </TouchableOpacity>
         )}
         {role.isAdmin === true && (
           <>
             <TouchableOpacity 
               style={styles.modifyButton}
               onPress={() => navigation.navigate('AjoutFormation', { formation: formation, role: role })}
             >
               <Text style={styles.buttonText}>Modifier</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={styles.deleteButton}
               onPress={handleDelete}
             >
               <Text style={styles.buttonText}>{formation.active ? "Désactiver" : "Réactiver"}</Text>
             </TouchableOpacity>
           </>
         )}
       </View>
      ) : ( */}
        <View style={styles.buttonContainer}>
         {formation.active && (
           <TouchableOpacity 
             style={getButtonStyle()}
             onPress={handleButtonPress}
            //  disabled={inscriptionStatus === "en attente" || inscriptionStatus === "Rejetée"}
           >
             <Text style={[
               styles.signUpButtonText, 
               inscriptionStatus === "Validée" ? { color: 'red' } : null
             ]}>
               {getButtonText()}
             </Text>
           </TouchableOpacity>
         )}
        </View>
      {/* )} */}
      <Text style={styles.info}>Début: {formation.date}</Text>
      <Text style={styles.info}>Fin: {formation.date_de_fin}</Text>
      <Text style={styles.info}>Heure: {formation.heureDebut} - {formation.heureFin}</Text>
      <Text style={styles.info}>Lieu: {formation.lieu}</Text>
      <Text style={styles.info}>Nature: {formation.nature}</Text>
      <Text style={styles.info}>Tarif étudiant: {formation.tarifEtudiant} €</Text>
      <Text style={styles.info}>Tarif médecin: {formation.tarifMedecin} €</Text>
      
      <Text style={styles.sectionTitle}>Domaine</Text>
      <Text style={styles.text}>{formation.domaine}</Text>
      
      <Text style={styles.sectionTitle}>Prérequis</Text>
      <Text style={styles.text}>{formation.prerequis}</Text>
      
      <Text style={styles.sectionTitle}>Compétences acquises</Text>
      <Text style={styles.text}>{formation.competencesAcquises || "Non spécifié"}</Text>
      

      {/* <Text style={styles.sectionTitle}>Autres domaines</Text>
      <Text style={styles.text}>{formation.autresDomaine || "Non spécifié"}</Text> */}
      
      <Text style={styles.sectionTitle}>Affiliation DIU</Text>
      <Text style={styles.text}>{formation.affiliationDIU}</Text>
      
      <Text style={styles.sectionTitle}>Année conseillée</Text>
      <Text style={styles.text}>{formation.anneeConseillee}</Text>
      

      
      <Text style={styles.sectionTitle}>Instructions</Text>
      <Text style={styles.text}>{formation.instructions}</Text>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 30, // Add extra padding at the bottom
  },
  bottomSpacer: {
    height: 50, // Adjust this value to increase or decrease the space at the bottom
  },
  image: {
    width: '100%',
    height: 200,
    marginBottom: 15,
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  signUpButton: {
    backgroundColor: '#1a53ff',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  
  modifyButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    padding: 10,
    borderRadius: 5,
    flex: 1,
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  info: {
    fontSize: 16,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
  },
});

export default FormationScreen;