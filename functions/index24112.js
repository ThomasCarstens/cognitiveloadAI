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
  const intermediateFilePath = path.join(tmpdir(), `normalized-${reactionTestId}.mp4`);
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
    console.log('Original video info:', videoInfo);

    // First pass: Normalize the video to ensure consistent format
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .outputOptions([
          '-y',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac'
        ])
        .output(intermediateFilePath)
        .on('start', (commandLine) => {
          console.log('First pass FFmpeg command:', commandLine);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('First pass FFmpeg stderr:', stderr);
          reject(new Error(`First pass FFmpeg error: ${err.message}`));
        })
        .on('end', () => {
          console.log('First pass completed successfully');
          resolve();
        })
        .run();
    });

    // Get normalized video dimensions
    const normalizedInfo = await getVideoInfo(intermediateFilePath);
    console.log('Normalized video info:', normalizedInfo);
    
    const { width, height } = normalizedInfo;
    const cropHeight = Math.floor(height * 0.4);
    const topOffset = Math.floor(height * 0.3);

    // Second pass: Apply the crop
    await new Promise((resolve, reject) => {
      ffmpeg(intermediateFilePath)
        .outputOptions([
          '-y',
          '-vf', `crop=${width}:${cropHeight}:0:${topOffset}`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac'
        ])
        .output(outputFilePath)
        .on('start', (commandLine) => {
          console.log('Second pass FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('error', (err, stdout, stderr) => {
          console.error('Second pass FFmpeg stderr:', stderr);
          reject(new Error(`Second pass FFmpeg error: ${err.message}`));
        })
        .on('end', () => {
          console.log('Second pass completed successfully');
          resolve();
        })
        .run();
    });

    // Verify the output file
    const stats = fs.statSync(outputFilePath);
    if (stats.size === 0) {
      throw new Error('Output file is empty');
    }

    // Upload the processed video
    await bucket.upload(outputFilePath, {
      destination: videoPath,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          firebaseStorageDownloadTokens: reactionTestId,
        }
      }
    });

    // Clean up
    [tempFilePath, intermediateFilePath, outputFilePath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    console.log('Video processing completed successfully');
    await admin.database().ref(`reaction-test/${reactionTestId}/video_processed`).set(true);

  } catch (error) {
    console.error('Error processing video:', error);
    
    // Clean up
    [tempFilePath, intermediateFilePath, outputFilePath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    await admin.database().ref(`reaction-test/${reactionTestId}/video_processed`).set(false);
    await admin.database().ref(`reaction-test/${reactionTestId}/processing_error`).set(error.message);
  }
});

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

      const width = parseInt(videoStream.width);
      const height = parseInt(videoStream.height);
      const duration = parseFloat(videoStream.duration);
      const frameRate = eval(videoStream.r_frame_rate);

      if (!width || !height || width <= 0 || height <= 0) {
        reject(new Error('Invalid video dimensions'));
        return;
      }

      resolve({
        width,
        height,
        duration,
        frameRate,
        codec: videoStream.codec_name,
        pixelFormat: videoStream.pix_fmt
      });
    });
  });
}