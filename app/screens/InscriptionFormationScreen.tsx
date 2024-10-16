import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, Alert, KeyboardAvoidingView, ScrollView, Platform, Keyboard } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ref as ref_d, set } from 'firebase/database';
import { database, auth } from '../../firebase';

const InscriptionFormationScreen = ({ route, navigation }) => {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [medecinDiplome, setMedecinDiplome] = useState(false);
  const [anneeDiplome, setAnneeDiplome] = useState('');
  const [faculte, setFaculte] = useState('');
  const [fonctionEnseignant, setFonctionEnseignant] = useState(false);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [etudiantDIU, setEtudiantDIU] = useState(false);
  const [anneeDIU, setAnneeDIU] = useState('');
  const [formationId, setFormationId] = useState(route.params.formationId);
  const [formationTitle, setFormationTitle] = useState(route.params.formationTitle);

  navigation.setOptions({
    headerShown: true,
    title: 'Fiche d\'inscription',
    headerStyle: {
      backgroundColor: '#1a53ff',
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
    },
    // headerRight: () => (
    //   <TouchableOpacity onPress={()=>handleLogout()} style={styles.logoutButton}>
    //     <Text style={styles.logoutButtonText}>Se déconnecter</Text>
    //   </TouchableOpacity>
    // ),
  });

  const validateForm = () => {
    if (!nom.trim() || !prenom.trim() || !email.trim() || !telephone.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires (nom, prénom, email, téléphone).');
      return false;
    }

    if (medecinDiplome && (!anneeDiplome.trim() || !faculte.trim())) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs pour Médecin Diplômé.');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide.');
      return false;
    }

    // Basic phone number validation (adjust regex as needed for your specific format)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(telephone)) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide (10 chiffres).');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const formData = {
      admin: 'en attente',
      formationTitle,
      nom,
      prenom,
      medecinDiplome,
      anneeDiplome,
      faculte,
      fonctionEnseignant,
      email,
      telephone,
      etudiantDIU,
      anneeDIU,
      timestamp: new Date().toISOString(),
    };

    const userUID = auth.currentUser?.uid;

    try {
      const userRef = ref_d(database, `demandes/${userUID}/${formationId}`);
      
      await set(userRef, formData);
      Alert.alert('Succès', 'Votre inscription a été enregistrée avec succès!');
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'enregistrement. Veuillez réessayer.');
    }
  };
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView 
          contentContainerStyle={[
            styles.scrollViewContent,
            { paddingBottom: keyboardHeight + 20 } // Add dynamic padding
          ]}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.title}>Inscription à la Formation {formationTitle}</Text>

        <View style={styles.nameContainer}>
          <View style={styles.nameField}>
            <Text style={styles.label}>Nom *</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder="Nom de famille"
              required
            />
          </View>
          <View style={styles.nameField}>
            <Text style={styles.label}>Prénom *</Text>
            <TextInput
              style={styles.input}
              value={prenom}
              onChangeText={setPrenom}
              placeholder="Prénom"
              required
            />
          </View>
        </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Médecin Diplômé</Text>
        <Switch
          value={medecinDiplome}
          onValueChange={setMedecinDiplome}
        />
      </View>

      {medecinDiplome && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Année de diplôme *</Text>
            <TextInput
              style={styles.input}
              value={anneeDiplome}
              onChangeText={setAnneeDiplome}
              keyboardType="numeric"
              placeholder="YYYY"
              required
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Faculté *</Text>
            <TextInput
              style={styles.input}
              value={faculte}
              onChangeText={setFaculte}
              placeholder="Nom de l'université"
              required
            />
          </View>
        </>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Fonction Enseignant</Text>
        <Switch
          value={fonctionEnseignant}
          onValueChange={setFonctionEnseignant}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="votre@email.com"
          required
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Numéro de téléphone *</Text>
        <TextInput
          style={styles.input}
          value={telephone}
          onChangeText={setTelephone}
          keyboardType="phone-pad"
          placeholder="0123456789"
          required
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Étudiant DIU</Text>
        <Switch
          value={etudiantDIU}
          onValueChange={setEtudiantDIU}
        />
      </View>

      {etudiantDIU && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>Année DIU</Text>
          <Picker
            selectedValue={anneeDIU}
            onValueChange={(itemValue) => setAnneeDIU(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Sélectionnez une année" value="" />
            <Picker.Item label="1ère année" value="1" />
            <Picker.Item label="2ème année" value="2" />
            <Picker.Item label="3ème année" value="3" />
          </Picker>
        </View>
      )}

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>S'inscrire</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d5dcf0',
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  nameField: {
    flex: 1,
    marginRight: 10,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: 'white',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#1a53ff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default InscriptionFormationScreen;


