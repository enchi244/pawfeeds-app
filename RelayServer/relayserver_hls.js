const http = require('http');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const HlsServer = require('hls-server');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// --- CONFIGURATION ---
const PORT = 8080;
const CAMERA_IPS = {
  1: 'http://192.168.1.183', // IP for Bowl 1 Camera
  2: 'http://192.168.1.187', // IP for Bowl 2 Camera
};
const HLS_OUTPUT_DIR = path.join(__dirname, 'hls');

const app = express();
const server = http.createServer(app);

// Keep track of active FFmpeg processes
const activeStreams = new Map();

// Ensure ffmpeg executable path is set
ffmpeg.setFfmpegPath(ffmpegStatic);

// Clean up HLS directory on start
fs.emptyDirSync(HLS_OUTPUT_DIR);
console.log(`[Relay] Cleaned HLS output directory: ${HLS_OUTPUT_DIR}`);

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[Relay] HTTP Request: ${req.method} ${req.url}`);
  next();
});

// Endpoint to start a stream session
app.get('/stream/:bowlNumber', (req, res) => {
  const { bowlNumber } = req.params;
  const cameraIp = CAMERA_IPS[bowlNumber];

  if (!cameraIp) {
    console.error(`[Relay] No camera configured for bowl number: ${bowlNumber}`);
    return res.status(404).send(`Camera for bowl ${bowlNumber} not found.`);
  }

  const streamUrl = `${cameraIp}/stream`;
  const outputDir = path.join(HLS_OUTPUT_DIR, bowlNumber);

  // If a stream process for this bowl already exists, do nothing.
  if (activeStreams.has(bowlNumber)) {
    console.log(`[Relay] HLS stream for bowl ${bowlNumber} is already running.`);
    // The hls-server will handle serving the existing manifest.
    return res.status(200).send(`Stream for bowl ${bowlNumber} already active.`);
  }

  console.log(`[Relay] Starting new HLS stream for bowl ${bowlNumber} from ${streamUrl}`);

  try {
    fs.ensureDirSync(outputDir);

    const ffmpegProcess = ffmpeg(streamUrl, { timeout: 43200 })
      .addOptions([
        '-c:v mjpeg', // Specify input codec
        '-hls_time 2', // 2-second segments
        '-hls_list_size 5', // Keep 5 segments in the playlist
        '-hls_flags delete_segments', // Delete old segments
        '-g 10', // Group of pictures - keyframe every 10 frames
        '-c:v libx264', // Output codec
        '-preset ultrafast', // Optimize for speed
        '-tune zerolatency', // Optimize for low latency
        '-pix_fmt yuv420p', // Pixel format for compatibility
        '-an', // No audio
      ])
      .output(path.join(outputDir, 'index.m3u8'))
      .on('start', (commandLine) => {
        console.log(`[FFmpeg Bowl ${bowlNumber}] Spawned FFmpeg with command: ${commandLine}`);
      })
      .on('error', (err, stdout, stderr) => {
        console.error(`[FFmpeg Bowl ${bowlNumber}] Error:`, err.message);
        console.error(`[FFmpeg Bowl ${bowlNumber}] stderr:`, stderr);
        // Clean up on error
        if (activeStreams.has(bowlNumber)) {
          activeStreams.get(bowlNumber).kill('SIGKILL');
          activeStreams.delete(bowlNumber);
        }
      })
      .on('end', () => {
        console.log(`[FFmpeg Bowl ${bowlNumber}] Stream processing finished.`);
        activeStreams.delete(bowlNumber);
      });

    ffmpegProcess.run();
    activeStreams.set(bowlNumber, ffmpegProcess);

    res.status(200).send(`Stream for bowl ${bowlNumber} started.`);

  } catch (error) {
    console.error(`[Relay] Failed to start stream for Bowl ${bowlNumber}:`, error.message);
    res.status(500).send(`Failed to start stream for Bowl ${bowlNumber}.`);
  }
});

// Endpoint to stop a stream session
// This is useful for saving resources if the app knows it's closing the stream.
app.get('/stop/:bowlNumber', (req, res) => {
  const { bowlNumber } = req.params;

  if (activeStreams.has(bowlNumber)) {
    console.log(`[Relay] Stopping HLS stream for bowl ${bowlNumber}.`);
    activeStreams.get(bowlNumber).kill('SIGKILL');
    activeStreams.delete(bowlNumber);
    fs.removeSync(path.join(HLS_OUTPUT_DIR, bowlNumber)); // Clean up segment files
    return res.status(200).send(`Stream for bowl ${bowlNumber} stopped.`);
  } else {
    return res.status(404).send(`Stream for bowl ${bowlNumber} not found or not active.`);
  }
});

// Configure and start HLS server
new HlsServer(server, {
  provider: {
    exists: (req, cb) => {
      const ext = path.extname(req.url);
      if (ext !== '.m3u8' && ext !== '.ts') {
        return cb(null, false);
      }
      fs.access(path.join(HLS_OUTPUT_DIR, req.url), fs.constants.F_OK, (err) => {
        cb(null, !err);
      });
    },
    getManifestStream: (req, cb) => {
      const streamPath = path.join(HLS_OUTPUT_DIR, req.url);
      cb(null, fs.createReadStream(streamPath));
    },
    getSegmentStream: (req, cb) => {
      const streamPath = path.join(HLS_OUTPUT_DIR, req.url);
      cb(null, fs.createReadStream(streamPath));
    }
  }
});

server.listen(PORT, () => {
  console.log(`[PawFeeds Relay] HLS Relay Server listening on port ${PORT}`);
});