import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Dimensions } from 'react-native';
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
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set } from 'firebase/database';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

const CIRCLE_SIZE = 60;
const TOTAL_CIRCLES = 6;
const SEQUENCES = 10;
const MAX_TEST_DURATION = 60000; // 1 minute

// Separate AnimatedCircle component to avoid hook issues
const AnimatedCircle = React.memo(({ isActive, onPress }) => {
    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: withTiming(isActive ? '#FFA500' : '#00008B', { duration: 200 })
    }));

    return (
        <TouchableOpacity onPress={onPress} style={styles.circleContainer}>
            <Animated.View style={[styles.circle, animatedStyle]} />
        </TouchableOpacity>
    );
});

const ReactionTestScreen = ({ navigation }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [voiceURL, setVoiceURL] = useState(null);
    const [showVideoRecorder, setShowVideoRecorder] = useState(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [timeLeft, setTimeLeft] = useState(60);
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    // New states for reaction test
    const [showReactionTest, setShowReactionTest] = useState(false);
    const [activeCircle, setActiveCircle] = useState(null);
    const [sequence, setSequence] = useState(0);
    const [reactionTimes, setReactionTimes] = useState([]);
    const [testStarted, setTestStarted] = useState(false);
    const [testComplete, setTestComplete] = useState(false);
    
    // Camera controls
    const [cameraMode, setCameraMode] = useState("video");
    const [cameraTorch, setCameraTorch] = useState(false);
    const [cameraFlash, setCameraFlash] = useState("off");
    const [cameraFacing, setCameraFacing] = useState("front");
    const [cameraZoom, setCameraZoom] = useState(0);
    const [videoRecordingUri, setVideoRecordingUri] = useState(null);
    
    const cameraRef = useRef(null);
    const lastActivationTime = useRef(0);

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
                render  >
                <Text style={styles.controlButtonText}>
                    Flash: {cameraFlash}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const startVideoRecording = async () => {
        console.log('starting Video Recording...')
        if (cameraRef.current) {
            try {
                console.log('activating...')
                const recordingOptions = {
                    maxDuration: 120000,
                    quality: '1080p',
                    flashMode: cameraFlash,
                    zoom: cameraZoom,
                };
                
                setIsRecording(true);
                const data = await cameraRef.current.recordAsync(recordingOptions);
                setVideoRecordingUri(data.uri);
                console.log('recording...')
            } catch (error) {
                console.error("Error recording video:", error);
                Alert.alert('Recording Error', 'Failed to start video recording');
            }
        }
    };

    const stopVideoRecording = async () => {
        console.log('stopping Video Recording !')
        if (cameraRef.current) {
            try {
                await cameraRef.current.stopRecording();
                setIsRecording(false);
            } catch (err) {
                Alert.alert('Failed to stop video recording', err.message);
            }
        }
    };
    const uploadToStorage = async (uri, path) => {
        console.log('uploading to Storage')
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, blob);
          
          return await getDownloadURL(fileRef);
        } catch (error) {
          Alert.alert('Upload failed', error.message);
          throw error;
        }
    };
    const generateRandomSequence = () => {
        const sequence = [];
        let totalTime = 0;
        
        for (let i = 0; i < SEQUENCES; i++) {
            const circle = Math.floor(Math.random() * TOTAL_CIRCLES);
            const delay = Math.random() * 3000 + 1000; // 1-4 seconds delay
            totalTime += delay;
            
            if (totalTime <= MAX_TEST_DURATION) {
                sequence.push({ circle, delay });
            }
        }
        
        return sequence;
    };

    const startReactionTest = async () => {
        const sequence = generateRandomSequence();
        setTestStarted(true);
        setTestComplete(false);
        setReactionTimes([]);
        setSequence(0);
        
        // Start video recording
        await startVideoRecording();
        
        let totalDelay = 0;
        sequence.forEach(({ circle, delay }, index) => {
            setTimeout(() => {
                setActiveCircle(circle);
                lastActivationTime.current = Date.now();
                
                // Reset circle after 1.5 seconds if not clicked
                setTimeout(() => {
                    if (activeCircle === circle) {
                        setActiveCircle(null);
                        setReactionTimes(prev => [...prev, -1]); // -1 indicates missed circle
                    }
                }, 1500);
                
                setSequence(index + 1);
                
                if (index === sequence.length - 1) {
                    setTimeout(() => {
                        setTestComplete(true);
                        stopVideoRecording();
                    }, 1500);
                }
            }, totalDelay);
            
            totalDelay += delay;
        });
    };

    const handleCirclePress = (index) => {
        if (index === activeCircle && !testComplete) {
            const reactionTime = Date.now() - lastActivationTime.current;
            setReactionTimes(prev => [...prev, reactionTime]);
            setActiveCircle(null);
        }
    };

    // Modify the existing stopVoiceRecording function
    const stopVoiceRecording = async () => {
        if (!recording) return;
        
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setVoiceURL(uri);
            setIsRecording(false);
            setShowReactionTest(true); // Show reaction test instead of video recorder
        } catch (err) {
            Alert.alert('Failed to stop recording', err.message);
        }
    };

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

    // Modify the existing handleComplete function
    const handleComplete = async () => {
            // stopVideoRecording().then(()=>{
            if (!voiceURL || !videoRecordingUri) {

                Alert.alert('Error', 'Please complete all recordings first');
                return;
            }
    
            try {
                const timestamp = Date.now();
                const uid = auth.currentUser.uid;
    
                const voicePath = `reaction-test/${uid}/${timestamp}/voice_recording`;
                const voiceStorageURL = await uploadToStorage(voiceURL, voicePath);
    
                const videoPath = `reaction-test/${uid}/${timestamp}/video_recording`;
                const videoStorageURL = await uploadToStorage(videoRecordingUri, videoPath);
    
                const reactionTestRef = dbRef(database, `reaction-test/${timestamp}`);
                
                await set(reactionTestRef, {
                    id_data: timestamp,
                    date: timestamp,
                    game_nb: 23,
                    reactiontime: reactionTimes,
                    voice_recording: voiceStorageURL,
                    video_recording: videoStorageURL,
                    userId: uid
                });
    
                Alert.alert('Success', 'Test completed and uploaded successfully');
                navigation.goBack();
            } catch (err) {
                Alert.alert('Upload failed', err.message);
            }

        // })
        
    };

    const renderReactionTest = () => (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* <View style={styles.cameraPreview}>
                    <CameraView
                        style={styles.camera}
                        ref={cameraRef}
                        facing={cameraFacing}
                        mode={cameraMode}
                        zoom={cameraZoom}
                        enableTorch={cameraTorch}
                        flash={cameraFlash}
                    >
                        {renderCameraControls()}
                    </CameraView>
                </View> */}
                {(renderVideoRecorder())}
                
                <View style={styles.circlesContainer}>
                    <View style={styles.circleGrid}>
                        {[...Array(TOTAL_CIRCLES)].map((_, index) => (
                            <AnimatedCircle
                                key={index}
                                isActive={activeCircle === index}
                                onPress={() => handleCirclePress(index)}
                            />
                        ))}
                    </View>
                </View>

                <View style={styles.controls}>
                    {!testStarted ? (
                        <TouchableOpacity
                            style={[styles.button, styles.startButton]}
                            onPress={startReactionTest}
                        >
                            <Text style={styles.buttonText}>Start Reaction Test</Text>
                        </TouchableOpacity>
                    ) : testComplete ? (
                        <TouchableOpacity
                            style={[styles.button, styles.completeButton]}
                            onPress={handleComplete}
                        >
                            <Text style={styles.buttonText}>Complete Test</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.progressText}>
                            Progress: {sequence}/{SEQUENCES}
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );

    // Modify the main return statement
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
            {!showReactionTest ? (
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
                renderReactionTest()
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    // ... [keep existing styles] ...
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    cameraPreview: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 120,
        height: 160,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 1000,
        borderWidth: 2,
        borderColor: '#fff',
    },
    circlesContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circleGrid: {
        width: Dimensions.get('window').width * 0.8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    circleContainer: {
        margin: 10,
    },
    circle: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        backgroundColor: '#00008B',
    },
    progressText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
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