const functions = require('firebase-functions');
const admin = require("firebase-admin");
admin.initializeApp();
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
  console.log('video path is ', data);
  console.log('reactiontestId is ', reactionTestId);

  if (!data.video_recording) {
    console.log('No video recording found');
    return null;
  }

  const tempFilePath = path.join(tmpdir(), `input-${reactionTestId}.mp4`);
  const outputFilePath = path.join(tmpdir(), `output-${reactionTestId}.mp4`);

  try {
    const bucket = admin.storage().bucket();
    const videoPath = `reaction-test/${userId}/${reactionTestId}/video_recording`;

    console.log('videoPath', videoPath);
    console.log('tempFilePath', tempFilePath);
    console.log('outputFilePath', outputFilePath);

    // Download the file
    await bucket.file(videoPath).download({
      destination: tempFilePath
    });

    // Get video dimensions
    const videoInfo = await getVideoInfo(tempFilePath);
    const { width, height } = videoInfo;

    // Validate dimensions
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('Invalid video dimensions detected');
    }

    // Calculate crop dimensions with validation
    const cropHeight = Math.max(Math.floor(height * 0.4), 1); // Ensure at least 1px height
    const topOffset = Math.min(Math.floor(height * 0.3), height - cropHeight); // Ensure offset doesn't exceed bounds

    console.log('Crop dimensions:', {
      originalWidth: width,
      originalHeight: height,
      cropHeight: cropHeight,
      topOffset: topOffset
    });

    // Process the video with more specific filter settings
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .outputOptions([
          '-y', // Overwrite output files without asking
          '-filter:v', `crop=${width}:${cropHeight}:0:${topOffset}`,
          '-c:a copy' // Copy audio stream without re-encoding
        ])
        .output(outputFilePath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', () => {
          console.log('FFmpeg processing finished successfully');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .run();
    });

    // Verify the output file exists and has size > 0
    const stats = fs.statSync(outputFilePath);
    if (stats.size === 0) {
      throw new Error('Output file is empty');
    }

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
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);

    console.log('Video processing completed successfully');
    
    await admin.database().ref(`reaction-test/${reactionTestId}/video_processed`).set(true);

  } catch (error) {
    console.error('Error processing video:', error);
    
    // Clean up temporary files in case of error
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);

    await admin.database().ref(`reaction-test/${reactionTestId}/video_processed`).set(false);
    await admin.database().ref(`reaction-test/${reactionTestId}/processing_error`).set(error.message);
  }
});

// Helper function to get video dimensions with validation
function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`FFprobe error: ${err.message}`));
        return;
      }
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      if (!videoStream.width || !videoStream.height) {
        reject(new Error('Invalid video dimensions'));
        return;
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height
      });
    });
  });
}