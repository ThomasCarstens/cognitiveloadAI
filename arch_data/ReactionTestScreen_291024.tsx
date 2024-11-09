import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Dimensions, Image, PermissionsAndroid, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { 
  CameraView, 
  CameraType,
  FlashMode,
  useCameraPermissions, 
  useMicrophonePermissions 
} from 'expo-camera';
import { RNCamera } from 'react-native-camera';
import ViewShot from 'react-native-view-shot';
import { storage, database, auth } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set } from 'firebase/database';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";


const CIRCLE_SIZE = 60;
const TOTAL_CIRCLES = 6;
const SEQUENCES = 10;
const MAX_TEST_DURATION = 60000; // 1 minute
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Separate AnimatedCircle component
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
    // const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [voiceURL, setVoiceURL] = useState(null);
    // const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    // const [timeLeft, setTimeLeft] = useState(60);
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    // Reaction test states
    const [showReactionTest, setShowReactionTest] = useState(false);
    const [activeCircle, setActiveCircle] = useState(null);
    const [sequence, setSequence] = useState(0);
    const [reactionTimes, setReactionTimes] = useState([]);
    const [testStarted, setTestStarted] = useState(false);
    const [testComplete, setTestComplete] = useState(false);
    
    // Camera controls
    // const [cameraFacing, setCameraFacing] = useState("front");
    // const [cameraTorch, setCameraTorch] = useState(false);
    // const [cameraFlash, setCameraFlash] = useState("off");
    
    // ViewShot states
    const viewShotRef = useRef(null);
    const [screenCaptures, setScreenCaptures] = useState([]);
    const lastActivationTime = useRef(0);
    const captureInterval = useRef(null);

        const [isRecording, setIsRecording] = useState(false);
        const [timeLeft, setTimeLeft] = useState(60);
        const [cameraPermission, setCameraPermission] = useState(null);
        
        // Camera states
        const [cameraFacing, setCameraFacing] = useState('front');
        const [cameraTorch, setCameraTorch] = useState(RNCamera.Constants.FlashMode.off);
        const [cameraFlash, setCameraFlash] = useState(RNCamera.Constants.FlashMode.off);
        const cameraRef = useRef(null);
        
    
        const requestCameraPermission = async () => {
            if (Platform.OS === 'android') {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.CAMERA,
                        {
                            title: "Camera Permission",
                            message: "App needs camera permission to capture video",
                            buttonNeutral: "Ask Me Later",
                            buttonNegative: "Cancel",
                            buttonPositive: "OK"
                        }
                    );
                    return granted === PermissionsAndroid.RESULTS.GRANTED;
                } catch (err) {
                    console.warn(err);
                    return false;
                }
            } else {
                // iOS permissions are handled through Info.plist
                return true;
            }
        };
        
        // Update your useEffect to use this
        useEffect(() => {
            const setupPermissions = async () => {
                try {
                    const cameraGranted = await requestCameraPermission();
                    setCameraPermission(cameraGranted);
                    
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
            return () => {
                if (captureInterval.current) {
                    clearInterval(captureInterval.current);
                }
            };
        }, []);

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
        return () => {
            if (captureInterval.current) {
                clearInterval(captureInterval.current);
            }
        };
    }, []);

    const startScreenCapture = () => {
        // Capture screen every 100ms
        console.log('started screen capture')
        console.log('isRecording value: ', isRecording)

        // setIsRecording(true);

        captureInterval.current = setInterval(async () => {
            if (viewShotRef.current) {
                console.log('screenshot');
                try {
                    const uri = await viewShotRef.current.capture();
                    setScreenCaptures(prev => [...prev, uri]);
                } catch (error) {
                    console.error('Screen capture error:', error);
                }
            }
        }, 100);
    };
    
    const startReactionTest = () => {  // Removed async since we're not using await
        
        const sequence = generateRandomSequence();
        
        // Start recording and screen capture before the sequence begins
        // setTimeout(() => {
        // setIsRecording(true);

        // }, 2000);
        startScreenCapture();
        // useEffect(() => {
            

        // }, [isRecording]);
        
        // Then set up the test states
        setTestStarted(true);
        setTestComplete(false);
        setReactionTimes([]);
        setSequence(0);
        setScreenCaptures([]);
        
        let totalDelay = 0;
        sequence.forEach(({ circle, delay }, index) => {
            setTimeout(() => {
                setActiveCircle(circle);
                lastActivationTime.current = Date.now();
                
                setTimeout(() => {
                    if (activeCircle === circle) {
                        setActiveCircle(null);
                        setReactionTimes(prev => [...prev, -1]);
                    }
                }, 1500);
                
                setSequence(index + 1);
                
                // End screen capture and complete test after the last circle
                if (index === sequence.length - 1) {
                    setTimeout(() => {
                        setTestComplete(true);
                        setIsRecording(false);
                        stopScreenCapture();
                    }, 1500);
                }
            }, totalDelay);
            totalDelay += delay;
        });
    };
    const stopScreenCapture = () => {
        if (captureInterval.current) {
            clearInterval(captureInterval.current);
            captureInterval.current = null;
        }
    };

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
            setShowReactionTest(true);
        } catch (err) {
            Alert.alert('Failed to stop recording', err.message);
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

    const handleCirclePress = (index) => {
        if (index === activeCircle && !testComplete) {
            const reactionTime = Date.now() - lastActivationTime.current;
            setReactionTimes(prev => [...prev, reactionTime]);
            setActiveCircle(null);
        }
    };
    const handleComplete = async () => {
        try {
            const timestamp = Date.now();
            const uid = auth.currentUser.uid;
    
            
            // Upload voice recording
            const voicePath = `reaction-test/${uid}/${timestamp}/voice_recording`;
            const voiceStorageURL = await uploadToStorage(voiceURL, voicePath);

            console.log('Starting upload with screenCaptures:', screenCaptures.length);

            // Upload all screen captures
            const screenCaptureURLs = await Promise.all(
                screenCaptures.map(async (uri, index) => {
                    const path = `reaction-test/${uid}/${timestamp}/screen_capture_${index}`;
                    try {
                        return await uploadToStorage(uri, path);
                    } catch (error) {
                        console.error(`Failed to upload capture ${index}:`, error);
                        throw error;
                    }
                })
            );

            console.log('Uploads complete, saving to database');


            const reactionTestRef = dbRef(database, `reaction-test/${timestamp}`);
            await set(reactionTestRef, {
                id_data: timestamp,
                date: timestamp,
                game_nb: 23,
                reactiontime: reactionTimes,
                voice_recording: voiceStorageURL,
                screen_captures: screenCaptureURLs,
                userId: uid
            });
    
            Alert.alert('Success', 'Test completed and uploaded successfully');
            navigation.goBack();
        } catch (err) {
            Alert.alert('Upload failed', err.message);
        }
    };
    
    // const startReactionTest = async () => {
    //     const sequence = generateRandomSequence();
    //     setTestStarted(true);
    //     setTestComplete(false);
    //     setReactionTimes([]);
    //     setSequence(0);
    //     setScreenCaptures([]);
    //     setIsRecording(true);
    //     startScreenCapture();
        
    //     let totalDelay = 0;
    //     sequence.forEach(({ circle, delay }, index) => {
    //         setTimeout(() => {
    //             setActiveCircle(circle);
    //             lastActivationTime.current = Date.now();
                
    //             setTimeout(() => {
    //                 if (activeCircle === circle) {
    //                     setActiveCircle(null);
    //                     setReactionTimes(prev => [...prev, -1]);
    //                 }
    //             }, 1500);
                
    //             setSequence(index + 1);
                
    //             // End screen capture and complete test after the last circle
    //             if (index === sequence.length - 1) {
    //                 setTimeout(() => {
    //                     stopScreenCapture();
    //                     setIsRecording(false);
    //                     setTestComplete(true);
    //                 }, 1500);
    //             }
    //         }, totalDelay);
    //         totalDelay += delay;
    //     });
    // };

    const uploadToStorage = async (uri, path) => {
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


    
        const renderCameraControls = () => (
            <View style={styles.cameraControls}>
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => setCameraFacing(current => 
                        current === RNCamera.Constants.Type.back 
                            ? RNCamera.Constants.Type.front 
                            : RNCamera.Constants.Type.back
                    )}
                >
                    <Text style={styles.controlButtonText}>Flip Camera</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => setCameraTorch(current => 
                        current === RNCamera.Constants.FlashMode.torch 
                            ? RNCamera.Constants.FlashMode.off 
                            : RNCamera.Constants.FlashMode.torch
                    )}
                >
                    <Text style={styles.controlButtonText}>
                        {cameraTorch === RNCamera.Constants.FlashMode.torch ? 'Torch Off' : 'Torch On'}
                    </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => setCameraFlash(current => 
                        current === RNCamera.Constants.FlashMode.off 
                            ? RNCamera.Constants.FlashMode.on 
                            : RNCamera.Constants.FlashMode.off
                    )}
                >
                    <Text style={styles.controlButtonText}>
                        Flash: {cameraFlash === RNCamera.Constants.FlashMode.off ? 'Off' : 'On'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    
        const renderReactionTest = () => (
            <ViewShot ref={viewShotRef} style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.upperCirclesContainer}>
                        <View style={styles.circleRow}>
                            {[...Array(3)].map((_, index) => (
                                <AnimatedCircle
                                    key={index}
                                    isActive={activeCircle === index}
                                    onPress={() => handleCirclePress(index)}
                                />
                            ))}
                        </View>
                    </View>
    
                    <View style={styles.cameraSection}>
                        <RNCamera
                            ref={cameraRef}
                            style={styles.camera}
                            type={cameraFacing}
                            flashMode={cameraFlash}
                            torchMode={cameraTorch}
                            androidCameraPermissionOptions={{
                                title: 'Permission to use camera',
                                message: 'We need your permission to use your camera',
                                buttonPositive: 'Ok',
                                buttonNegative: 'Cancel',
                            }}
                        >
                            {renderCameraControls()}
                        </RNCamera>
                    </View>
    
                    <View style={styles.lowerCirclesContainer}>
                        <View style={styles.circleRow}>
                            {[...Array(3)].map((_, index) => (
                                <AnimatedCircle
                                    key={index + 3}
                                    isActive={activeCircle === index + 3}
                                    onPress={() => handleCirclePress(index + 3)}
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
            </ViewShot>
        );
    
        // if (!cameraPermission) {
        //     return (
        //         <View style={styles.container}>
        //             <Text style={styles.text}>Requesting camera permission...</Text>
        //         </View>
        //     );
        // }

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
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 20,
    },
    upperCirclesContainer: {
        alignItems: 'center',
        paddingTop: 20,
    },
    lowerCirclesContainer: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    circleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        marginTop: 10,
    },
    eyeLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        backgroundColor: '#ddd',
        padding: 5,
        borderRadius: 5,
    },
    cameraSection: {
        height: SCREEN_HEIGHT * 0.35,
        marginVertical: 20,
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#333',
    },
    camera: {
        flex: 1,
        width: '100%',
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
    controls: {
        alignItems: 'center',
        padding: 20,
    },
    button: {
        padding: 15,
        borderRadius: 10,
        marginVertical: 10,
        width: '80%',
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
    progressText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    cameraControls: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    controlButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 5,
    },
    controlButtonText: {
        color: 'white',
        fontSize: 12,
    },
    // container: {
    //     flex: 1,
    //     backgroundColor: '#f0f0f0',
    // },
    // content: {
    //     flex: 1,
    //     position: 'relative',
    // },
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
    // circleContainer: {
    //     margin: 10,
    // },
    // circle: {
    //     width: CIRCLE_SIZE,
    //     height: CIRCLE_SIZE,
    //     borderRadius: CIRCLE_SIZE / 2,
    //     backgroundColor: '#00008B',
    // },
    // progressText: {
    //     fontSize: 18,
    //     fontWeight: 'bold',
    //     color: '#333',
    // },
    // container: {
    //     flex: 1,
    //     backgroundColor: '#f0f0f0',
    // },
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
    // camera: {
    //     flex: 1,
    //     width: '100%',
    // },
    buttonContainer: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        margin: 20,
    },
    // cameraControls: {
    //     flexDirection: 'row',
    //     justifyContent: 'space-around',
    //     padding: 10,
    //     backgroundColor: 'rgba(0,0,0,0.3)',
    // },
    // controlButton: {
    //     padding: 10,
    //     backgroundColor: 'rgba(255,255,255,0.3)',
    //     borderRadius: 5,
    // },
    // controlButtonText: {
    //     color: 'white',
    //     fontSize: 12,
    // },
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
    // button: {
    //     padding: 15,
    //     borderRadius: 10,
    //     marginVertical: 10,
    //     width: '100%',
    //     alignItems: 'center',
    // },
    // startButton: {
    //     backgroundColor: '#1a53ff',
    // },
    // stopButton: {
    //     backgroundColor: '#ff4444',
    // },
    // completeButton: {
    //     backgroundColor: '#4CAF50',
    // },
    // buttonText: {
    //     color: 'white',
    //     fontSize: 16,
    //     fontWeight: 'bold',
    // },
    
});

export default ReactionTestScreen;