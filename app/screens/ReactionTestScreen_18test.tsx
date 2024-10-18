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
  useSharedValue,
} from "react-native-reanimated";

const CIRCLE_SIZE = 60;
const SEQUENCES = 6;
const TOTAL_CIRCLES = 6;
const MAX_TEST_DURATION = 60000;

const ReactionTestScreen = ({ navigation }) => {
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    const [isRecording, setIsRecording] = useState(false);
    const [videoRecordingUri, setVideoRecordingUri] = useState(null);
    const [activeCircle, setActiveCircle] = useState(null);
    const [sequence, setSequence] = useState(0);
    const [reactionTimes, setReactionTimes] = useState([]);
    const [testStarted, setTestStarted] = useState(false);
    const [testComplete, setTestComplete] = useState(false);
    
    const [cameraMode] = useState("video");
    const [cameraTorch] = useState(false);
    const [cameraFlash] = useState("off");
    const [cameraFacing] = useState("front");
    const [cameraZoom] = useState(0);
    
    const cameraRef = useRef(null);
    const lastActivationTime = useRef(0);
    const testInterval = useRef(null);

    useEffect(() => {
        const setupPermissions = async () => {
            if (!cameraPermission?.granted) {
                await requestCameraPermission();
            }
            if (!micPermission?.granted) {
                await requestMicPermission();
            }
        };

        setupPermissions();
        
        return () => {
            if (testInterval.current) {
                clearInterval(testInterval.current);
            }
        };
    }, []);

    const generateRandomSequence = () => {
        const sequence = [];
        let totalTime = 0;
        
        // Generate one activation for each circle in random order
        const circles = [...Array(TOTAL_CIRCLES).keys()];
        for (let i = circles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [circles[i], circles[j]] = [circles[j], circles[i]];
        }
        
        circles.forEach(circle => {
            const delay = Math.random() * 3000 + 1000; // 1-4 seconds delay
            totalTime += delay;
            if (totalTime <= MAX_TEST_DURATION) {
                sequence.push({ circle, delay });
            }
        });
        
        return sequence;
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

    const startTest = async () => {
        const sequence = generateRandomSequence();
        setTestStarted(true);
        setTestComplete(false);
        setReactionTimes([]);
        setSequence(0);
        
        // Start video recording
        await startVideoRecording();
        
        let currentSequence = 0;
        let totalDelay = 0;

        // Execute each sequence with delays
        for (const { circle, delay } of sequence) {
            setTimeout(() => {
                setActiveCircle(circle);
                lastActivationTime.current = Date.now();
                
                // Reset circle after 1 second if not clicked
                setTimeout(() => {
                    if (activeCircle === circle) {
                        setActiveCircle(null);
                        setReactionTimes(prev => [...prev, -1]); // -1 indicates missed circle
                    }
                }, 1000);
                
                currentSequence++;
                setSequence(currentSequence);
                
                if (currentSequence === sequence.length) {
                    setTimeout(() => {
                        setTestComplete(true);
                        stopVideoRecording();
                    }, 1000);
                }
            }, totalDelay);
            
            totalDelay += delay;
        }
    };

    const handleCirclePress = (index) => {
        if (index === activeCircle && !testComplete) {
            const reactionTime = Date.now() - lastActivationTime.current;
            setReactionTimes(prev => [...prev, reactionTime]);
            setActiveCircle(null); // Reset active circle immediately after successful click
        }
    };

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
    const handleComplete = async () => {
        if (!videoRecordingUri) {
            Alert.alert('Error', 'Video recording not found');
            return;
        }

        try {
            const timestamp = Date.now();
            const uid = auth.currentUser.uid;

            const videoPath = `reaction-test/${uid}/${timestamp}/video_recording`;
            const videoStorageURL = await uploadToStorage(videoRecordingUri, videoPath);

            // Create a reference to the specific location in the Realtime Database
            const reactionTestRef = dbRef(database, `reaction-test/${uid}/${timestamp}`);
            
            // Set the data in the Realtime Database
            await set(reactionTestRef, {
                id_data: timestamp,
                date: timestamp,
                game_nb: 23,
                reactiontime: reactionTimes,
                video_recording: videoStorageURL,
                userId: uid
            });

            Alert.alert('Success', 'Test completed and uploaded successfully');
            navigation.goBack();
        } catch (err) {
            Alert.alert('Upload failed', err.message);
        }
    };

    const renderCircle = (index) => {
        const animatedStyle = useAnimatedStyle(() => {
            return {
                backgroundColor: withTiming(
                    activeCircle === index ? '#FFA500' : '#00008B',
                    { duration: 200 }
                ),
            };
        });

        return (
            <TouchableOpacity
                key={index}
                onPress={() => handleCirclePress(index)}
                style={styles.circleContainer}
            >
                <Animated.View style={[styles.circle, animatedStyle]} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        ref={cameraRef}
                        facing={cameraFacing}
                        mode={cameraMode}
                    >
                        {isRecording && (
                            <View style={styles.previewContainer}>
                                <View style={styles.preview} />
                            </View>
                        )}
                    </CameraView>
                </View>
                
                <View style={styles.circlesContainer}>
                    <View style={styles.circleGrid}>
                        {[...Array(TOTAL_CIRCLES)].map((_, index) => renderCircle(index))}
                    </View>
                </View>

                <View style={styles.controls}>
                    {!testStarted ? (
                        <TouchableOpacity
                            style={[styles.button, styles.startButton]}
                            onPress={startTest}
                        >
                            <Text style={styles.buttonText}>Start Test</Text>
                        </TouchableOpacity>
                    ) : testComplete ? (
                        <TouchableOpacity
                            style={[styles.button, styles.completeButton]}
                            onPress={handleComplete}
                        >
                            <Text style={styles.buttonText}>Submit Results</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.progressText}>
                            Progress: {sequence}/{SEQUENCES}
                        </Text>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    cameraContainer: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 120,
        height: 160,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 1000,
        borderWidth: 2,
        borderColor: '#fff',
    },
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    previewContainer: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    preview: {
        flex: 1,
        backgroundColor: 'transparent',
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
    controls: {
        padding: 20,
        alignItems: 'center',
    },
    progressText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
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