import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { 
  CameraView, 
  CameraType,
  FlashMode,
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
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const EYE_BOX_WIDTH = SCREEN_WIDTH * 0.8; // 80% of screen width
const EYE_BOX_HEIGHT = 120; // Fixed height for eye area

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

// Eye position guide component
const EyePositionGuide = () => (
    <View style={styles.eyeGuideContainer}>
        <View style={styles.eyeGuideBox}>
            <Text style={styles.eyeGuideText}>Position eyes here</Text>
        </View>
        <View style={styles.eyeGuidelines}>
            <View style={[styles.eyeGuideCorner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
            <View style={[styles.eyeGuideCorner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
            <View style={[styles.eyeGuideCorner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
            <View style={[styles.eyeGuideCorner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
        </View>
    </View>
  );

  
const EyeRecorder = ({ isRecording, onRecordingComplete }) => {
    const cameraRef = useRef(null);
    const recordingRef = useRef(null);

    useEffect(() => {
        if (isRecording) {
            startRecording();
        } else if (recordingRef.current) {
            stopRecording();
        }
    }, [isRecording]);

    const startRecording = async () => {
        if (!cameraRef.current) return;

        try {
            // Calculate the eye zone position
            const eyeZoneY = (SCREEN_HEIGHT * 0.3); // Position from top
            const eyeZoneX = (SCREEN_WIDTH - EYE_BOX_WIDTH) / 2;

            const recordingOptions = {
                quality: '720p',
                maxDuration: 120,
                maxFileSize: 50 * 1024 * 1024,
                mute: true,
                // Define recording area to match eye box dimensions
                cropRect: {
                    x: eyeZoneX,
                    y: eyeZoneY,
                    width: EYE_BOX_WIDTH,
                    height: EYE_BOX_HEIGHT
                }
            };

            recordingRef.current = await cameraRef.current.recordAsync(recordingOptions);
        } catch (error) {
            console.error("Error starting eye recording:", error);
            Alert.alert('Recording Error', 'Failed to start eye recording');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        try {
            await cameraRef.current.stopRecording();
            onRecordingComplete(recordingRef.current.uri);
            recordingRef.current = null;
        } catch (error) {
            console.error("Error stopping eye recording:", error);
            Alert.alert('Recording Error', 'Failed to stop eye recording');
        }
    };

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
                <View style={styles.container}>
                    <EyeRecorder
                        isRecording={isRecording}
                        onRecordingComplete={handleEyeRecordingComplete}
                    />
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
            )}
        </View>
    );
};


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
    const recordingInProgress = useRef(false);
    const testSequence = useRef([]);

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
      console.log('Starting video recording...');
      if (cameraRef.current && !recordingInProgress.current) {
          try {
              recordingInProgress.current = true;
              const recordingOptions = {
                  maxDuration: 120000,
                  quality: '1080p',
                  flashMode: cameraFlash,
                  zoom: cameraZoom,
              };
              
              setIsRecording(true);
              const data = await cameraRef.current.recordAsync(recordingOptions);
              console.log('Recording started successfully');
              setVideoRecordingUri(data.uri);
          } catch (error) {
              console.error("Error recording video:", error);
              recordingInProgress.current = false;
              Alert.alert('Recording Error', 'Failed to start video recording');
          }
      }
  };

  const stopVideoRecording = async () => {
      console.log('Stopping video recording...');
      if (cameraRef.current && recordingInProgress.current) {
          try {
              await cameraRef.current.stopRecording();
              recordingInProgress.current = false;
              setIsRecording(false);
              console.log('Recording stopped successfully');
          } catch (err) {
              console.error("Error stopping recording:", err);
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
//     const startReactionTest = async () => {
//       try {
//           // Generate and store sequence
//           const sequence = generateRandomSequence();
//           testSequence.current = sequence;
          
//           // Reset test states
//           setTestStarted(true);
//           setTestComplete(false);
//           setReactionTimes([]);
//           setSequence(0);
          
//           // Start recording first
//           await startVideoRecording();
          
//           // Wait a moment to ensure recording has started
//           await new Promise(resolve => setTimeout(resolve, 1000));
          
//           // Now start the sequence
//           let totalDelay = 0;
//           sequence.forEach(({ circle, delay }, index) => {
//               setTimeout(() => {
//                   if (!testComplete) {
//                       setActiveCircle(circle);
//                       lastActivationTime.current = Date.now();
                      
//                       // Reset circle after 1.5 seconds if not clicked
//                       setTimeout(() => {
//                           if (activeCircle === circle) {
//                               setActiveCircle(null);
//                               setReactionTimes(prev => [...prev, -1]); // -1 indicates missed circle
//                           }
//                       }, 1500);
                      
//                       setSequence(index + 1);
                      
//                       // If this is the last sequence
//                       if (index === sequence.length - 1) {
//                           setTimeout(async () => {
//                               setTestComplete(true);
//                               // Wait a moment before stopping recording
//                               await new Promise(resolve => setTimeout(resolve, 2000));
//                               await stopVideoRecording();
//                           }, 1500);
//                       }
//                   }
//               }, totalDelay);
              
//               totalDelay += delay;
//           });
//       } catch (error) {
//           console.error("Error in reaction test:", error);
//           Alert.alert('Test Error', 'Failed to start the reaction test');
//           setTestStarted(false);
//           setTestComplete(false);
//           await stopVideoRecording();
//       }
//   };

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
              <View style={styles.cameraWrapper}>
                  <CameraView 
                      style={styles.camera} 
                      ref={cameraRef}
                      facing="front"
                      mode={cameraMode}
                      zoom={0.5} // Adjust zoom to focus more on eye area
                      enableTorch={cameraTorch}
                      flash={cameraFlash}
                  >
                      <SafeAreaView style={styles.cameraContainer}>
                          <EyePositionGuide />
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
              </View>
              
              {/* Instructions for proper eye positioning */}
              <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionsText}>
                      Please position your eyes within the guide box and maintain a stable position
                  </Text>
              </View>
          </Animated.View>
      );
  };

  const [eyeRecordingUri, setEyeRecordingUri] = useState(null);
    
  const handleEyeRecordingComplete = (uri) => {
      setEyeRecordingUri(uri);
  };

  const startReactionTest = async () => {
      try {
          const sequence = generateRandomSequence();
          testSequence.current = sequence;
          
          setTestStarted(true);
          setTestComplete(false);
          setReactionTimes([]);
          setSequence(0);
          
          // Start eye recording
          setIsRecording(true);
          
          let totalDelay = 0;
          sequence.forEach(({ circle, delay }, index) => {
              setTimeout(() => {
                  if (!testComplete) {
                      setActiveCircle(circle);
                      lastActivationTime.current = Date.now();
                      
                      setTimeout(() => {
                          if (activeCircle === circle) {
                              setActiveCircle(null);
                              setReactionTimes(prev => [...prev, -1]);
                          }
                      }, 1500);
                      
                      setSequence(index + 1);
                      
                      if (index === sequence.length - 1) {
                          setTimeout(() => {
                              setTestComplete(true);
                              setIsRecording(false);
                          }, 1500);
                      }
                  }
              }, totalDelay);
              
              totalDelay += delay;
          });
      } catch (error) {
          console.error("Error in reaction test:", error);
          Alert.alert('Test Error', 'Failed to start the reaction test');
          setTestStarted(false);
          setTestComplete(false);
          setIsRecording(false);
      }
  };

  const handleComplete = async () => {
      if (!voiceURL || !eyeRecordingUri) {
          Alert.alert('Error', 'Please complete all recordings first');
          return;
      }

      try {
          const timestamp = Date.now();
          const uid = auth.currentUser.uid;

          const voicePath = `reaction-test/${uid}/${timestamp}/voice_recording`;
          const voiceStorageURL = await uploadToStorage(voiceURL, voicePath);

          const eyePath = `reaction-test/${uid}/${timestamp}/eye_recording`;
          const eyeStorageURL = await uploadToStorage(eyeRecordingUri, eyePath);

          const reactionTestRef = dbRef(database, `reaction-test/${timestamp}`);
          await set(reactionTestRef, {
              id_data: timestamp,
              date: timestamp,
              game_nb: 23,
              reactiontime: reactionTimes,
              voice_recording: voiceStorageURL,
              eye_recording: eyeStorageURL,
              userId: uid
          });

          Alert.alert('Success', 'Test completed and uploaded successfully');
          navigation.goBack();
      } catch (err) {
          console.error("Error completing test:", err);
          Alert.alert('Upload failed', err.message);
        }
    };

// Clean up function
useEffect(() => {
    return () => {
        if (recordingInProgress.current) {
            stopVideoRecording().catch(console.error);
        }
    };
}, []);

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
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    
    // Recording Container Styles
    recordingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    
    // Camera and Eye Recording Styles
    eyeRecorderContainer: {
        height: SCREEN_HEIGHT * 0.4,
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    cameraContainer: {
        flex: 1,
        paddingTop: 40,
    },
    
    // Eye Guide Overlay Styles
    eyeGuideOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    eyeGuideBox: {
        width: EYE_BOX_WIDTH,
        height: EYE_BOX_HEIGHT,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        position: 'relative',
        backgroundColor: 'transparent',
    },
    
    // Corner Marker Styles
    cornerTL: {
        position: 'absolute',
        top: -2,
        left: -2,
        width: 20,
        height: 20,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#fff',
    },
    cornerTR: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 20,
        height: 20,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderColor: '#fff',
    },
    cornerBL: {
        position: 'absolute',
        bottom: -2,
        left: -2,
        width: 20,
        height: 20,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#fff',
    },
    cornerBR: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderColor: '#fff',
    },
    
    // Guide Text Styles
    guideText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        position: 'absolute',
        top: -30,
        width: '100%',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    
    // Reaction Test Circle Styles
    circlesContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    circleGrid: {
        width: SCREEN_WIDTH * 0.8,
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
    
    // Button Styles
    buttonContainer: {
        flexDirection: 'column',
        justifyContent: 'flex-end',
        margin: 20,
        gap: 10,
    },
    button: {
        padding: 15,
        borderRadius: 10,
        marginVertical: 10,
        width: '100%',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
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
        textAlign: 'center',
    },
    
    // Controls and Progress Styles
    controls: {
        width: '100%',
        padding: 20,
        alignItems: 'center',
    },
    progressText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginVertical: 10,
    },
    
    // Text and Title Styles
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
        textAlign: 'center',
    },
    timer: {
        fontSize: 18,
        marginBottom: 20,
        color: '#666',
        textAlign: 'center',
    },
    text: {
        fontSize: 16,
        textAlign: 'center',
        margin: 20,
        color: '#333',
    },
    
    // Instructions Styles
    instructionsContainer: {
        padding: 15,
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        margin: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
    },
    instructionsText: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        lineHeight: 20,
    },

    // Permission Screen Styles
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        padding: 20,
    },
    permissionText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#1a53ff',
        padding: 15,
        borderRadius: 10,
        width: '80%',
        marginVertical: 10,
    },
    permissionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
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
    cameraWrapper: {
      height: Dimensions.get('window').height * 0.4, // Reduce camera preview height
      width: '100%',
      overflow: 'hidden',
  },
  
  eyeBoxContainer: {
    height: Dimensions.get('window').height * 0.3,
    width: '100%',
    overflow: 'hidden',
},
eyeBoxCamera: {
    flex: 1,
    width: '100%',
},
eyeGuideContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [
        { translateX: -EYE_BOX_WIDTH / 2 },
        { translateY: -EYE_BOX_HEIGHT / 2 }
    ],
    width: EYE_BOX_WIDTH,
    height: EYE_BOX_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
},
eyeGuideBox: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 10,
    width: '100%',
    height: '100%',
    position: 'absolute',
},
  
  eyeGuidelines: {
      position: 'absolute',
      width: '100%',
      height: '100%',
  },
  
  eyeGuideCorner: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderColor: '#fff',
  },
  
  eyeGuideText: {
      color: '#fff',
      fontSize: 14,
      textAlign: 'center',
      position: 'absolute',
      top: -25,
      width: '100%',
  },
  
  instructionsContainer: {
      padding: 15,
      backgroundColor: '#f8f8f8',
      borderRadius: 10,
      margin: 10,
  },
  
  instructionsText: {
      fontSize: 14,
      color: '#333',
      textAlign: 'center',
  },
});

export default ReactionTestScreen;