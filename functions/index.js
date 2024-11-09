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
  ref: "/reaction-test/{reactionTestId}/video_recording",
  instance: "esculappl-france-default-rtdb",
  region: "europe-west1"
}, async (event) => {
  const reactionTestId = event.params.reactionTestId;
  const data = event.data.val();

  // Check if video_recording exists in the data
  if (!data.video_recording) {
    console.log('No video recording found');
    return null;
  }

  try {
    // Get the video file from Storage
    const bucket = admin.storage().bucket();
    const videoPath = `/reaction-test/${reactionTestId}/video_recording`;
    const tempFilePath = path.join(tmpdir(), 'input.mp4');
    const outputFilePath = path.join(tmpdir(), 'output.mp4');

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