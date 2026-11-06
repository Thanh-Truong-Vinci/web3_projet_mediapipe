const video = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");
const statusDot = document.getElementById("status-dot");
const emptyState = document.getElementById("lab-empty-state");
const indexPosition = document.getElementById("index-position");
const handCount = document.getElementById("hand-count");

let handLandmarker = null;
let lastVideoTime = -1;
let trackedIndexTip = null;
let lastHandSeenAt = 0;
const LANDMARK_HOLD_MS = 180;

function setStatus(message, state) {
  status.textContent = message;
  statusDot.className = `lab-status-dot ${state}`;
}

async function createLandmarker(vision, fileset) {
  const options = {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  };

  try {
    return await vision.HandLandmarker.createFromOptions(fileset, options);
  } catch (gpuError) {
    console.warn("MediaPipe GPU indisponible, repli CPU :", gpuError);
    return vision.HandLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" }
    });
  }
}

async function startWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
  setStatus("Caméra active · levez la main", "is-ready");
  predict();
}

function drawIndexMarker(indexTip) {
  const x = indexTip.x * canvas.width;
  const y = indexTip.y * canvas.height;
  indexPosition.textContent = `${Math.round(x)} / ${Math.round(y)}`;

  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#22c55e";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.save();
  ctx.scale(-1, 1);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 14px Inter, sans-serif";
  ctx.fillText(`INDEX  X:${Math.round(x)}  Y:${Math.round(y)}`, -x + 20, y - 18);
  ctx.restore();
}

function predict() {
  if (!handLandmarker || video.readyState < 2) {
    window.requestAnimationFrame(predict);
    return;
  }

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const now = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, performance.now());
    const hands = results.landmarks || [];
    handCount.textContent = hands.length;
    if (hands[0]) {
      trackedIndexTip = hands[0][8];
      lastHandSeenAt = now;
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const markerIsFresh = trackedIndexTip && now - lastHandSeenAt <= LANDMARK_HOLD_MS;
  emptyState.classList.toggle("is-hidden", Boolean(markerIsFresh));
  if (markerIsFresh) drawIndexMarker(trackedIndexTip);
  window.requestAnimationFrame(predict);
}

async function init() {
  try {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
    const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    handLandmarker = await createLandmarker(vision, fileset);
    setStatus("Modèle prêt · activation caméra", "is-ready");
    await startWebcam();
  } catch (error) {
    setStatus("Ouvrez via localhost pour activer la caméra", "is-error");
    console.error("MediaPipe Lab:", error);
  }
}

init();
