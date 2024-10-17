import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ref as ref_d, set, get } from 'firebase/database';
import { ref as ref_s, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, firebase, storage, database } from '../../firebase';
// import * as ImagePicker from 'expo-image-picker';

const AjoutFormationScreen = ({ navigation, route }) => {
  const [formData, setFormData] = useState({
    id: Date.now().toString(),
    title: '',
    active: true,     //temporary, only admin can make formations in Phase 2, needs to change in Phase 3
    date: new Date(),
    date_de_fin: new Date(),
    image: 'https://via.placeholder.com/150',
    region: '',
    lieu: '',
    status: 'propose', //temporary, only admin can make formations in Phase 2, needs to change in Phase 3
    heureDebut: new Date(),
    heureFin: new Date(),
    nature: '',
    anneeConseillee: '',
    tarifEtudiant: '',
    tarifMedecin: '',
    domaine: '',
    autresDomaine: '',
    autreLieu: '',
    autreRegion: '',
    autreNature: '',
    autreAnneeConseillee: '',
    affiliationDIU: '',
    autreAffiliationDIU: '',
    competencesAcquises: '',
    prerequis: '',
    instructions: '',
    admin: 'validée', //temporary, only admin can make formations in Phase 2, needs to change in Phase 3
  });

  // const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [errors, setErrors] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [affiliationOptions, setAffiliationOptions] = useState([]);
  const [lieuOptions, setLieuOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [anneeOptions, setAnneeOptions] = useState([]);
  const [natureOptions, setNatureOptions] = useState([]);

  useEffect(() => {
    downloadFilterOptions();
    // ... (keep existing useEffect logic)
  }, [route.params?.formation]);

  const downloadFilterOptions = async () => {
    try {
      const parametersRef = ref_d(database, 'parameters');
      const paramsSnapshot = await get(parametersRef);
      const parameters = paramsSnapshot.val();
      console.log(parameters);
      setCategoryOptions(parameters.categoryOptions);
      setLieuOptions(parameters.lieuOptions);
      setRegionOptions(parameters.regionOptions);
      setAnneeOptions(parameters.anneeOptions);
      setAffiliationOptions(parameters.affiliationOptions);
      setNatureOptions(parameters.natureOptions);
    } catch (error) {
      console.error('Error checking filter options:', error);
    }
  };

  useEffect(() => {
    downloadFilterOptions();
    const existingFormation = route.params?.formation;
    if (existingFormation) {
      setFormData({
        ...existingFormation,
        date: new Date(existingFormation.date),
        date_de_fin: new Date(existingFormation.date_de_fin),
        heureDebut: new Date(`2000-01-01T${existingFormation.heureDebut}`),
        heureFin: new Date(`2000-01-01T${existingFormation.heureFin}`),
      });
    }
  }, [route.params?.formation]);

  const handleInputChange = (name, value) => {
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: null
      }));
    }
  };


  const handleDateChange = (event, selectedDate, isEndDate = false) => {
    if (isEndDate) {
      setShowEndDatePicker(false);
    } else {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      handleInputChange(isEndDate ? 'date_de_fin' : 'date', selectedDate);
    }
  };

  const handleTimeChange = (event, selectedTime, type) => {
    console.log(formData.heureDebut)
    if (type === 'start') {
      setShowStartTimePicker(false);
    } else {
      setShowEndTimePicker(false);
    }
    if (selectedTime) {
      handleInputChange(type === 'start' ? 'heureDebut' : 'heureFin', selectedTime);
    }
  };

  const pickImage = async () => {
    // let result = await ImagePicker.launchImageLibraryAsync({
    //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
    //   allowsEditing: true,
    //   aspect: [4, 3],
    //   quality: 1,
    // });

    // if (!result.canceled) {
    //   setImageUri(result.assets[0].uri);
    // }
    let result = null
  };
  const uploadImage = async () => {
    if (imageUri) {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const filename = `formations/${formData.id}_${Date.now()}.jpg`;
      const storageRef = ref_s(storage, filename);

      try {
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
      } catch (error) {
        console.error("Error uploading image: ", error);
        throw error;
      }
    }
    return null;
  };
  const validateForm = () => {
    let isValid = true;
    let newErrors = {};

    // Check required fields
    const requiredFields = ['title', 'date', 'heureDebut', 'heureFin', 'lieu', 'region', 'nature', 'anneeConseillee', 'tarifEtudiant', 'tarifMedecin', 'domaine', 'affiliationDIU'];    
    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = 'Ce champ est obligatoire';
        isValid = false;
      }
    });

    // Check if 'autre' fields are filled when their corresponding main fields are 'Autre'
    if (formData.domaine === 'Autre' && !formData.autresDomaine) {
      newErrors.autresDomaine = 'Veuillez spécifier le domaine';
      isValid = false;
    }
    if (formData.lieu === 'Autre' && !formData.autreLieu) {
      newErrors.autreLieu = 'Veuillez spécifier le lieu';
      isValid = false;
    }
    if (formData.region === 'Autre' && !formData.autreRegion) {
      newErrors.autreRegion = 'Veuillez spécifier la région';
      isValid = false;
    }
    if (formData.nature === 'Autre' && !formData.autreNature) {
      newErrors.autreNature = 'Veuillez spécifier la nature de la formation';
      isValid = false;
    }
    if (formData.anneeConseillee === 'Autre' && !formData.autreAnneeConseillee) {
      newErrors.autreAnneeConseillee = 'Veuillez spécifier l\'année conseillée';
      isValid = false;
    }
    if (formData.affiliationDIU === 'Autre' && !formData.autreAffiliationDIU) {
      newErrors.autreAffiliationDIU = 'Veuillez spécifier l\'Affiliation DIU';
      isValid = false;
    }

    // Validate numeric fields
    if (isNaN(Number(formData.tarifEtudiant)) || formData.tarifEtudiant === '') {
      newErrors.tarifEtudiant = 'Le tarif doit être un nombre';
      isValid = false;
    }
    if (isNaN(Number(formData.tarifMedecin)) || formData.tarifMedecin === '') {
      newErrors.tarifMedecin = 'Le tarif doit être un nombre';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      Alert.alert(
        "Confirmation",
        route.params?.formation 
          ? "Voulez-vous vraiment modifier cette formation ?" 
          : "Voulez-vous vraiment ajouter cette formation ?",
        [
          {
            text: "Annuler",
            style: "cancel"
          },
          { 
            text: "OK", 
            onPress: () => uploadToFirebase() 
          }
        ]
      );
    } else {
      Alert.alert("Erreur", "Veuillez remplir correctement tous les champs obligatoires.");
    }
  };

  const uploadToFirebase = async () => {
      if (validateForm()) {
        try {
          const imageUrl = await uploadImage();
          const formattedData = {
            ...formData,
            date: formData.date.toISOString().split('T')[0],
            date_de_fin: formData.date_de_fin.toISOString().split('T')[0],
            heureDebut: formData.heureDebut.toTimeString().split(' ')[0].slice(0, 5),
            heureFin: formData.heureFin.toTimeString().split(' ')[0].slice(0, 5),

            domaine: formData.domaine === 'Autre' ? formData.autresDomaine : formData.domaine,
            lieu: formData.lieu === 'Autre' ? formData.autreLieu : formData.lieu,
            region: formData.region === 'Autre' ? formData.autreRegion : formData.region,
            nature: formData.nature === 'Autre' ? formData.autreNature : formData.nature,
            anneeConseillee: formData.anneeConseillee === 'Autre' ? formData.autreAnneeConseillee : formData.anneeConseillee,
            affiliationDIU: formData.affiliationDIU === 'Autre' ? formData.autreAffiliationDIU : formData.affiliationDIU,

            image: imageUrl || formData.image,
          };
  
          await set(ref_d(database, `formations/${formData.id}`), formattedData);
          Alert.alert("Succès", route.params?.formation 
            ? "La formation a été modifiée avec succès."
            : "La formation a été ajoutée avec succès.");
          navigation.goBack();
        } catch (error) {
          Alert.alert("Erreur", "Une erreur s'est produite lors de l'opération.");
          console.error(error);
        }
      } else {
        Alert.alert("Erreur", "Veuillez remplir correctement tous les champs obligatoires.");
      }
    };
  

  const renderInput = (label, name, placeholder, keyboardType = 'default', multiline = false) => (
    <View>
      <Text style={styles.label}>{label} {requiredFields.includes(name) ? '*' : ''}</Text>
      <TextInput
        style={[styles.input, errors[name] && styles.inputError, multiline && styles.multilineInput]}
        value={formData[name]}
        onChangeText={(text) => handleInputChange(name, text)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
      />
      {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
    </View>
  );

  const requiredFields = ['title', 'date', 'date_de_fin', 'heureDebut', 'heureFin', 'lieu', 'nature', 'anneeConseillee', 'tarifEtudiant', 'tarifMedecin', 'domaine', 'affiliationDIU'];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {route.params?.formation ? "Modifier la formation" : "Ajouter une nouvelle formation"}
      </Text>

      {renderInput('Titre', 'title', 'Titre de la formation')}

      <Text style={styles.label}>Date de début *</Text>
      <TouchableOpacity style={[styles.input, errors.date && styles.inputError]} onPress={() => setShowDatePicker(true)}>
        <Text>{formData.date.toLocaleDateString()}</Text>
      </TouchableOpacity>
      {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
      {showDatePicker && (
        <DateTimePicker
          value={formData.date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => handleDateChange(event, selectedDate)}
        />
      )}

      <Text style={styles.label}>Date de fin *</Text>
      <TouchableOpacity style={[styles.input, errors.date_de_fin && styles.inputError]} onPress={() => setShowEndDatePicker(true)}>
        <Text>{formData.date_de_fin.toLocaleDateString()}</Text>
      </TouchableOpacity>
      {errors.date_de_fin && <Text style={styles.errorText}>{errors.date_de_fin}</Text>}
      {showEndDatePicker && (
        <DateTimePicker
          value={formData.date_de_fin}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => handleDateChange(event, selectedDate, true)}
        />
      )}

      <Text style={styles.label}>Heure de début *</Text>
      <TouchableOpacity style={[styles.input, errors.heureDebut && styles.inputError]} onPress={() => setShowStartTimePicker(true)}>
        <Text>{formData.heureDebut.toLocaleTimeString().slice(0, 5)}</Text>
      </TouchableOpacity>
      {errors.heureDebut && <Text style={styles.errorText}>{errors.heureDebut}</Text>}
      {showStartTimePicker && (
        <DateTimePicker
          value={formData.heureDebut}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, 'start')}
        />
      )}

      <Text style={styles.label}>Heure de fin *</Text>
      <TouchableOpacity style={[styles.input, errors.heureFin && styles.inputError]} onPress={() => setShowEndTimePicker(true)}>
        <Text>{formData.heureFin.toLocaleTimeString().slice(0, 5)}</Text>
      </TouchableOpacity>
      {errors.heureFin && <Text style={styles.errorText}>{errors.heureFin}</Text>}
      {showEndTimePicker && (
        <DateTimePicker
          value={formData.heureFin}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => handleTimeChange(event, selectedTime, 'end')}
        />
      )}

<Text style={styles.label}>Type de formation *</Text>
      <Picker
        selectedValue={formData.nature}
        style={[styles.picker, errors.nature && styles.inputError]}
        onValueChange={(itemValue) => handleInputChange('nature', itemValue)}
      >
        <Picker.Item label="Sélectionnez un type de formation" value="" />
        {natureOptions.map((natureOption, index) => (
          <Picker.Item key={index} label={natureOption} value={natureOption} />
        ))}

        
      </Picker>
      {errors.nature && <Text style={styles.errorText}>{errors.nature}</Text>}

      {formData.nature === 'Autre' && renderInput('Spécifier le type de formation', 'autreNature', 'Spécifier le type de formation')}

      <Text style={styles.label}>Lieu *</Text>
      <Picker
        selectedValue={formData.lieu}
        style={[styles.picker, errors.lieu && styles.inputError]}
        onValueChange={(itemValue) => handleInputChange('lieu', itemValue)}
      >
        <Picker.Item label="Sélectionnez un lieu" value="" />
        {lieuOptions.map((lieuOption, index) => (
          <Picker.Item key={index} label={lieuOption} value={lieuOption} />
        ))}
        {/* <Picker.Item label="Autre" value="Autre" /> */}
      </Picker>
      {errors.lieu && <Text style={styles.errorText}>{errors.lieu}</Text>}
      {formData.lieu === 'Autre' && renderInput('Spécifier le lieu', 'autreLieu', 'Spécifier le lieu')}



      <Text style={styles.label}>Région *</Text>
      <Picker
        selectedValue={formData.region}
        style={[styles.picker, errors.region && styles.inputError]}
        onValueChange={(itemValue) => handleInputChange('region', itemValue)}
      >
        <Picker.Item label="Sélectionnez une région" value="" />
        {regionOptions.map((regionOption, index) => (
          <Picker.Item key={index} label={regionOption} value={regionOption} />
        ))}
        {/* <Picker.Item label="Autre" value="Autre" /> */}
      </Picker>
      {errors.region && <Text style={styles.errorText}>{errors.region}</Text>}
      {formData.region === 'Autre' && renderInput('Spécifier la région', 'autreRegion', 'Spécifier la région')}



      <Text style={styles.label}>Année d'études conseillée *</Text>
      <Picker
        selectedValue={formData.anneeConseillee}
        style={[styles.picker, errors.anneeConseillee && styles.inputError]}
        onValueChange={(itemValue) => handleInputChange('anneeConseillee', itemValue)}
      >
        <Picker.Item label="Sélectionnez une année d'études" value="" />
        {anneeOptions.map((annee, index) => (
          <Picker.Item key={index} label={annee} value={annee} />
        ))}
        {/* <Picker.Item label="Autre" value="Autre" /> */}
      </Picker>
      {errors.anneeConseillee && <Text style={styles.errorText}>{errors.anneeConseillee}</Text>}
      {formData.anneeConseillee === 'Autre' && renderInput('Spécifier l\'année d\'études conseillée', 'autreAnneeConseillee', 'Spécifier l\'année d\'études conseillée')}


      
      {renderInput('Tarif étudiant DIU', 'tarifEtudiant', 'Tarif étudiant DIU', 'numeric')}
      {renderInput('Tarif médecin', 'tarifMedecin', 'Tarif médecin', 'numeric')}

      <Text style={styles.label}>Domaine *</Text>
      <Picker
        selectedValue={formData.domaine}
        style={[styles.picker, errors.domaine && styles.inputError]}
        onValueChange={(itemValue) => handleInputChange('domaine', itemValue)}
      >
        <Picker.Item label="Sélectionnez un domaine" value="" />
        {categoryOptions.map((annee, index) => (
          <Picker.Item key={index} label={annee} value={annee} />
        ))}
        {/* <Picker.Item label="Autre" value="Autre" /> */}
      </Picker>

      {errors.domaine && <Text style={styles.errorText}>{errors.domaine}</Text>}

      {formData.domaine === 'Autre' && renderInput('Spécifier le domaine', 'domaine', 'Spécifier le domaine')}

      <Text style={styles.label}>Affiliation DIU Université *</Text>
      <Picker
        selectedValue={formData.affiliationDIU}
        style={[styles.picker, errors.affiliationDIU && styles.inputError]}
        onValueChange={(itemValue) => handleInputChange('affiliationDIU', itemValue)}
      >
        <Picker.Item label="Sélectionnez une affiliation" value="" />
        {affiliationOptions.map((affiliation, index) => (
          <Picker.Item key={index} label={affiliation} value={affiliation} />
        ))}

        {/* PACA, Occitanie, Ile de France, Champagnes Ardennes, Loire Atlantique, Bretagne */}
      </Picker>
      {errors.affiliationDIU && <Text style={styles.errorText}>{errors.affiliationDIU}</Text>}

      {formData.affiliationDIU === 'Autre' && renderInput('Spécifier l\'affiliation DIU', 'affiliationDIU', 'Spécifier l\'affiliation DIU')}
      {/* {renderInput('Catégorie', 'category', 'Catégorie de la formation')} */}
      {renderInput('Compétences acquises', 'competencesAcquises', 'Compétences acquises', 'default', true)}
      {renderInput('Prérequis', 'prerequis', 'Prérequis', 'default', true)}
      {renderInput('Instructions', 'instructions', 'Instructions', 'default', true)}

      <Text style={styles.label}>Image de la formation</Text>
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        ) : (
          <Text>Sélectionner une image</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>
          {route.params?.formationId ? "Modifier la formation" : "Ajouter la formation"}
        </Text>
      </TouchableOpacity>

      {Object.keys(errors).length > 0 && (
        <Text style={styles.errorSummary}>
          Veuillez corriger les erreurs ci-dessus avant de soumettre le formulaire.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  inputError: {
    borderColor: 'red',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#1a53ff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imagePicker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: 10,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});

export default AjoutFormationScreen;