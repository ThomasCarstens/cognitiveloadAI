import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { Audio } from 'expo-av';
import { 
  CameraView, 
  CameraType,
  FlashMode,
  CameraMode,
  useCameraPermissions, 
  useMicrophonePermissions 
} from 'expo-camera';
import { storage, database, auth } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

const ReactionTestScreen = ({ navigation }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [voiceURL, setVoiceURL] = useState(null);
    const [showVideoRecorder, setShowVideoRecorder] = useState(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [timeLeft, setTimeLeft] = useState(60);
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    // Camera controls (from HomeScreen)
    const [cameraMode, setCameraMode] = useState<CameraMode>("video");
    const [cameraTorch, setCameraTorch] = useState<boolean>(false);
    const [cameraFlash, setCameraFlash] = useState<FlashMode>("off");
    const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
    const [cameraZoom, setCameraZoom] = useState<number>(0);
    const [videoRecordingUri, setVideoRecordingUri] = useState<string | null>(null);
    
    const cameraRef = useRef(null);

    useEffect(() => {
        const setupPermissions = async () => {
            try {
                if (!cameraPermission?.granted) {
                    await requestCameraPermission();
                }
                
                if (!micPermission?.granted) {
                    await requestMicPermission();
                }

                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
            } catch (err) {
                Alert.alert('Permission Error', 'Failed to get required permissions');
                console.error('Permission error:', err);
            }
        };

        setupPermissions();
    }, [cameraPermission, micPermission]);

    const startVoiceRecording = async () => {
        if (!micPermission?.granted) {
            Alert.alert('Permission Required', 'Microphone permission is required to record audio');
            return;
        }

        try {
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            setRecording(recording);
            setIsRecording(true);
            setTimeLeft(60);

            setTimeout(() => {
                stopVoiceRecording();
            }, 60000);
        } catch (err) {
            Alert.alert('Failed to start recording', err.message);
        }
    };

    const stopVoiceRecording = async () => {
        if (!recording) return;
        
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setVoiceURL(uri);
            setIsRecording(false);
            setShowVideoRecorder(true);
        } catch (err) {
            Alert.alert('Failed to stop recording', err.message);
        }
    };

    const startVideoRecording = async () => {
        if (cameraRef.current) {
            try {
                const recordingOptions = {
                    maxDuration: 120000,
                    quality: '1080p',
                    flashMode: cameraFlash,
                    zoom: cameraZoom,
                };
                
                setIsRecording(true);
                const data = await cameraRef.current.recordAsync(recordingOptions);
                setVideoRecordingUri(data.uri);
            } catch (error) {
                console.error("Error recording video:", error);
                Alert.alert('Recording Error', 'Failed to start video recording');
            }
        }
    };

    const stopVideoRecording = async () => {
        if (cameraRef.current) {
            try {
                await cameraRef.current.stopRecording();
                setIsRecording(false);
            } catch (err) {
                Alert.alert('Failed to stop video recording', err.message);
            }
        }
    };

    const handleComplete = async () => {
        if (!voiceURL || !videoRecordingUri) {
            Alert.alert('Error', 'Please complete both recordings first');
            return;
        }

        try {
            const timestamp = Date.now();
            const uid = auth.currentUser.uid;

            const voicePath = `reaction-test/${uid}/${timestamp}/voice-recording.m4a`;
            const voiceStorageURL = await uploadToStorage(voiceURL, voicePath);

            const videoPath = `reaction-test/${uid}/${timestamp}/video-recording.mp4`;
            const videoStorageURL = await uploadToStorage(videoRecordingUri, videoPath);

            const docRef = doc(database, 'reaction-test', `${timestamp}`);
            await setDoc(docRef, {
                id_data: timestamp,
                date: timestamp,
                'game-nb': 23,
                reactiontime: [304, 33, 493],
                'fatigue-opinion': '55%',
                'voice-recording': voiceStorageURL,
                'video-recording': videoStorageURL
            });

            Alert.alert('Success', 'Test completed and uploaded successfully');
            navigation.goBack();
        } catch (err) {
            Alert.alert('Upload failed', err.message);
        }
    };

    const renderCameraControls = () => (
        <View style={styles.cameraControls}>
            <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setCameraFacing(current => 
                    current === "back" ? "front" : "back"
                )}
            >
                <Text style={styles.controlButtonText}>Flip Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setCameraTorch(!cameraTorch)}
            >
                <Text style={styles.controlButtonText}>
                    {cameraTorch ? 'Torch Off' : 'Torch On'}
                </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setCameraFlash(current => 
                    current === "off" ? "on" : "off"
                )}
            >
                <Text style={styles.controlButtonText}>
                    Flash: {cameraFlash}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderVideoRecorder = () => {
        if (!cameraPermission || !cameraPermission.granted) return null;

        return (
            <Animated.View
                layout={LinearTransition}
                entering={FadeIn.duration(1000)}
                exiting={FadeOut.duration(1000)}
                style={styles.container}
            >
                <CameraView 
                    style={styles.camera} 
                    ref={cameraRef}
                    facing={cameraFacing}
                    mode={cameraMode}
                    zoom={cameraZoom}
                    enableTorch={cameraTorch}
                    flash={cameraFlash}
                >
                    <SafeAreaView style={styles.cameraContainer}>
                        {renderCameraControls()}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, isRecording ? styles.stopButton : styles.startButton]}
                                onPress={isRecording ? stopVideoRecording : startVideoRecording}
                            >
                                <Text style={styles.buttonText}>
                                    {isRecording ? 'Stop Recording' : 'Start Video Recording'}
                                </Text>
                            </TouchableOpacity>
                            
                            {videoRecordingUri && !isRecording && (
                                <TouchableOpacity
                                    style={[styles.button, styles.completeButton]}
                                    onPress={handleComplete}
                                >
                                    <Text style={styles.buttonText}>Complete Test</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </SafeAreaView>
                </CameraView>
            </Animated.View>
        );
    };

    if (!cameraPermission || !micPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Requesting permissions...</Text>
            </View>
        );
    }

    if (!cameraPermission?.granted || !micPermission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Required Permissions</Text>
                {!cameraPermission?.granted && (
                    <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
                        <Text style={styles.buttonText}>Grant Camera Permission</Text>
                    </TouchableOpacity>
                )}
                {!micPermission?.granted && (
                    <TouchableOpacity style={styles.button} onPress={requestMicPermission}>
                        <Text style={styles.buttonText}>Grant Microphone Permission</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!showVideoRecorder ? (
                <View style={styles.recordingContainer}>
                    <Text style={styles.title}>Voice Recording</Text>
                    <Text style={styles.timer}>Time remaining: {timeLeft}s</Text>
                    <TouchableOpacity
                        style={[styles.button, isRecording ? styles.stopButton : styles.startButton]}
                        onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
                    >
                        <Text style={styles.buttonText}>
                            {isRecording ? 'Stop Recording' : 'Start Voice Recording'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                renderVideoRecorder()
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    recordingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    cameraContainer: {
        flex: 1,
        paddingTop: 40,
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        margin: 20,
    },
    cameraControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    controlButton: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 5,
    },
    controlButtonText: {
        color: 'white',
        fontSize: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    timer: {
        fontSize: 18,
        marginBottom: 20,
    },
    text: {
        fontSize: 16,
        textAlign: 'center',
        margin: 20,
    },
    button: {
        padding: 15,
        borderRadius: 10,
        marginVertical: 10,
        width: '100%',
        alignItems: 'center',
    },
    startButton: {
        backgroundColor: '#1a53ff',
    },
    stopButton: {
        backgroundColor: '#ff4444',
    },
    completeButton: {
        backgroundColor: '#4CAF50',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ReactionTestScreen;