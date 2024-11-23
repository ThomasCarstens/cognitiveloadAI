const functions = require('firebase-functions');
const admin = require("firebase-admin");
admin.initializeApp();
// const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpeg_static = require('ffmpeg-static');
const { tmpdir } = require('os');
const fs = require('fs');
const {onValueCreated} = require("firebase-functions/v2/database");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpeg_static);

exports.onReactionTestVideoUpload = onValueCreated({
  ref: "/reaction-test/{reactionTestId}",
  instance: "esculappl-france-default-rtdb",
  region: "europe-west1"
}, async (event) => {
  
  const reactionTestId = event.params.reactionTestId;
  const data = event.data.val();
  const userId = data.userId;
    console.log('video path is ', data)
    console.log('reactiontestId is ', reactionTestId)
  // Check if video_recording exists in the data
  if (!data.video_recording) {
    console.log('No video recording found');
    return null;
  }

  try {
    // Get the video file from Storage
    const bucket = admin.storage().bucket();
    // const videoPath = data.video_recording.split('https://firebasestorage.googleapis.com/v0/b/esculappl-france.appspot.com/')[1]
    // const videoPath = data.video_recording 
    const videoPath = `reaction-test/${userId}/${reactionTestId}/video_recording`
    /*
    esculappl-france.appspot.com/https://firebasestorage.googleapis.com/v0/b/esculappl-france.appspot.com/
    o/reaction-test%2FiWZ5nUDp86X5bW1k9GsfR6iJIkh1%2F1732389401983%2Fvideo_recording?alt=media&amp
    ;token=95b18ba7-6b10-4948-a91c-2ea54c97a26b
    gs://esculappl-france.appspot.com/reaction-test/iWZ5nUDp86X5bW1k9GsfR6iJIkh1/1729190522037/video_recording
    reaction-test/iWZ5nUDp86X5bW1k9GsfR6iJIkh1/1729190522037/video_recording 
    reaction-test/${userId}/${reactionTestId}/video_recording
    */
    const tempFilePath = path.join(tmpdir(), 'input.mp4');
    
    const outputFilePath = path.join(tmpdir(), 'output.mp4');

    console.log('videoPath', videoPath)
    console.log('tempFilePath', tempFilePath)

    console.log('outputFilePath', outputFilePath)

    // Download the file
    await bucket.file(videoPath).download({
      destination: tempFilePath
    });

    // Get video dimensions
    const videoInfo = await getVideoInfo(tempFilePath);
    const { width, height } = videoInfo;
    
    // Calculate crop dimensions (removing top and bottom 30%)
    const cropHeight = Math.floor(height * 0.4); // 40% of original height
    const topOffset = Math.floor(height * 0.3); // Start at 30% from top

    // Process the video
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .outputOptions([
          `-filter:v crop=${width}:${cropHeight}:0:${topOffset}` // crop=width:height:x:y
        ])
        .output(outputFilePath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Upload the processed video back to Storage
    await bucket.upload(outputFilePath, {
      destination: videoPath,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          firebaseStorageDownloadTokens: reactionTestId,
        }
      }
    });

    // Clean up temporary files
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(outputFilePath);

    console.log('Video processing completed successfully');
    
    // Update the database to indicate processing is complete
    await admin.database().ref(`reaction-test/${reactionTestId}/video_processed`).set(true);

  } catch (error) {
    console.error('Error processing video:', error);
    // Update the database to indicate processing failed
    await admin.database().ref(`reaction-test/${reactionTestId}/video_processed`).set(false);
    await admin.database().ref(`reaction-test/${reactionTestId}/processing_error`).set(error.message);
  }
});

// Helper function to get video dimensions
function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      resolve({
        width: videoStream.width,
        height: videoStream.height
      });
    });
  });
}