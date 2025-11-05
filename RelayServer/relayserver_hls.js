const http = require('http');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const os = require('os');

// --- CONFIGURATION ---
const PORT = 8080;
const CAMERA_IPS = {
  1: 'http://192.168.1.183', // IP for Bowl 1 Camera
  2: 'http://192.168.1.187', // IP for Bowl 2 Camera
};
const HLS_OUTPUT_DIR = path.join(__dirname, 'hls');

const app = express();
const server = http.createServer(app);
const activeStreams = new Map();

ffmpeg.setFfmpegPath(ffmpegStatic);
fs.emptyDirSync(HLS_OUTPUT_DIR);
console.log(`[Relay] Cleaned HLS output directory: ${HLS_OUTPUT_DIR}`);

// --- MIDDLEWARE ---
app.use((req, res, next) => {
  console.log(`[Relay] Request Received: ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
  next();
});

// --- STABILITY FIX: Add CORS headers to allow cross-domain requests ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.static(HLS_OUTPUT_DIR)); // Serve the HLS files

// --- ROUTES ---
app.get('/', (req, res) => {
  res.status(200).send('PawFeeds Relay Server is running and accessible.');
});

app.get('/stream/:bowlNumber', (req, res) => {
  const { bowlNumber } = req.params;
  const cameraIp = CAMERA_IPS[bowlNumber];
  const outputDir = path.join(HLS_OUTPUT_DIR, bowlNumber);
  const manifestPath = path.join(outputDir, 'index.m3u8');

  if (!cameraIp) {
    console.error(`[Relay] ERROR: Request for invalid bowl number: ${bowlNumber}`);
    return res.status(404).send(`Camera for bowl ${bowlNumber} not found.`);
  }

  if (activeStreams.has(bowlNumber)) {
    console.log(`[Relay] Stream for bowl ${bowlNumber} is already active.`);
    // The stream is active, so the manifest *should* exist. Respond immediately.
    return res.status(200).send(`Stream for bowl ${bowlNumber} is already active.`);
  }

  console.log(`[Relay] Starting HLS stream for bowl ${bowlNumber} from camera at ${cameraIp}/stream`);
  fs.ensureDirSync(outputDir);

  // --- We need to capture these variables for the error handler ---
  let watcher = null; // Declare watcher here to be accessible in all scopes
  let ffmpegProcess = null; // Declare process here

  const clearWatcher = () => {
    if (watcher) {
      clearInterval(watcher);
      watcher = null;
    }
  };

  ffmpegProcess = ffmpeg(`${cameraIp}/stream`, { timeout: 43200 })
    // --- STABILITY FIX 1: Tell ffmpeg the input format is MJPEG ---
    .inputFormat('mjpeg')
    // --- STABILITY FIX 2: Tell ffmpeg to read the stream at its native rate (10fps) ---
    // This is CRITICAL for stability with a "bursty" source like our ESP32.
    .inputOption('-re')
    // --- STABILITY FIX 3: Tell ffmpeg the input FPS is 10 (to match delay(100)) ---
    .inputFPS(10)
    .addOptions([
      // Tell ffmpeg to skip bad frames instead of stalling
      '-fflags +discardcorrupt',
      // Keep 2-second segments
      '-hls_time 2',
      // ==========================================================
      // === STABILITY FIX 4: Increase buffer to 20 seconds (10 chunks * 2s)
      // ==========================================================
      '-hls_list_size 10',
      '-hls_flags delete_segments',
      // Keyframe every 10 frames (1 per sec)
      '-g 10', 
      '-c:v libx264',
      '-preset ultrafast',
      '-tune zerolatency',
      '-pix_fmt yuv420p',
      '-an', // No audio
    ])
    .output(manifestPath)
    .on('start', (commandLine) => {
      console.log(`[FFmpeg Bowl ${bowlNumber}] Successfully spawned.`);
      console.log(`[FFmpeg Bowl ${bowlNumber}] Command: ${commandLine}`); // Log the full command
    })
    .on('error', (err, stdout, stderr) => {
      console.error(`[FFmpeg Bowl ${bowlNumber}] FATAL ERROR: ${err.message}`);
      console.error(`[FFmpeg Bowl ${bowlNumber}] STDERR:\n${stderr}`);
      activeStreams.delete(bowlNumber);
      clearWatcher(); // Clear the watcher on error
      if (!res.headersSent) {
        res.status(500).send('Failed to start FFmpeg process.');
      }
    })
    .on('end', () => {
      console.log(`[FFmpeg Bowl ${bowlNumber}] Stream processing finished.`);
      activeStreams.delete(bowlNumber);
      clearWatcher(); // Clear the watcher on end
    });

  ffmpegProcess.run();
  activeStreams.set(bowlNumber, ffmpegProcess);

  // --- Increase timeout to 30 seconds ---
  const timeout = 30000; // 30 seconds
  const interval = 100; // Check every 100ms
  let timeElapsed = 0;

  watcher = setInterval(() => {
    if (fs.existsSync(manifestPath)) {
      clearWatcher();
      if (!res.headersSent) {
        console.log(`[Relay] Manifest for bowl ${bowlNumber} created. Sending 200 OK.`);
        res.status(200).send(`Stream initiation for bowl ${bowlNumber} successful.`);
      }
    } else {
      timeElapsed += interval;
      if (timeElapsed > timeout) {
        clearWatcher();
        console.error(`[Relay] Timeout: Manifest for bowl ${bowlNumber} not created after ${timeout/1000}s.`);
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL'); // Kill the hung process
        }
        activeStreams.delete(bowlNumber);
        if (!res.headersSent) {
          res.status(500).send('FFmpeg process timed out, failed to create manifest.');
        }
      }
    }
  }, interval);
});

// --- SERVER START ---
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
}

server.listen(PORT, () => {
  const ipAddress = getLocalIpAddress();
  console.log(`[PawFeeds Relay] HLS Relay Server listening on port ${PORT}`);
  console.log(`[PawFeeds Relay] Network access at: http://${ipAddress}:${PORT}`);
});