import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { RNCamera } from 'react-native-camera';

const CameraScreen = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [flash, setFlash] = useState(RNCamera.Constants.FlashMode.off);
  const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.back);
  const cameraRef = useRef(null);

  const toggleFlash = () => {
    setFlash(
      flash === RNCamera.Constants.FlashMode.off
        ? RNCamera.Constants.FlashMode.on
        : RNCamera.Constants.FlashMode.off
    );
  };

  const toggleCameraType = () => {
    setCameraType(
      cameraType === RNCamera.Constants.Type.back
        ? RNCamera.Constants.Type.front
        : RNCamera.Constants.Type.back
    );
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = {
          quality: 0.85,
          base64: true,
          skipProcessing: true,
        };
        const data = await cameraRef.current.takePictureAsync(options);
        Alert.alert('Success', `Photo taken! ${data.uri}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const recordVideo = async () => {
    if (cameraRef.current) {
      if (isRecording) {
        cameraRef.current.stopRecording();
      } else {
        setIsRecording(true);
        try {
          const data = await cameraRef.current.recordAsync({
            quality: RNCamera.Constants.VideoQuality['480p'],
            maxDuration: 60,
          });
          Alert.alert('Success', `Video recorded! ${data.uri}`);
        } catch (error) {
          Alert.alert('Error', 'Failed to record video');
        }
        setIsRecording(false);
      }
    }
  };

  const PendingView = () => (
    <View style={styles.pendingContainer}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.preview}
        type={cameraType}
        flashMode={flash}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        androidRecordAudioPermissionOptions={{
          title: 'Permission to use audio recording',
          message: 'We need your permission to use your audio',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        onGoogleVisionBarcodesDetected={({ barcodes }) => {
          console.log(barcodes);
        }}
      >
        {({ camera, status }) => {
          if (status !== 'READY') return <PendingView />;
          return (
            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={toggleFlash} style={styles.button}>
                <Text style={styles.buttonText}>
                  Flash: {flash === RNCamera.Constants.FlashMode.off ? 'Off' : 'On'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleCameraType} style={styles.button}>
                <Text style={styles.buttonText}>
                  {cameraType === RNCamera.Constants.Type.back ? 'Front' : 'Back'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={recordVideo}
                style={[styles.captureButton, isRecording && styles.recordingButton]}
              >
                <Text style={styles.buttonText}>
                  {isRecording ? 'Stop Recording' : 'Record Video'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      </RNCamera>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'black',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  buttonContainer: {
    flex: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  button: {
    flex: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 10,
  },
  captureButton: {
    flex: 0,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 10,
  },
  recordingButton: {
    backgroundColor: '#ff0000',
  },
  buttonText: {
    fontSize: 14,
    color: '#fff',
  },
  pendingContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CameraScreen;