<template>
  <div class="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden font-poppins">

    <!-- Remote Video (full background) -->
    <video
      ref="remoteVideo"
      autoplay
      playsinline
      class="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500"
      :class="remoteStream ? 'opacity-100' : 'opacity-0'"
    ></video>

    <!-- Gradient overlays for depth -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none z-1"></div>
    <div class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none z-1"></div>

    <!-- Avatar placeholder when no remote video -->
    <div v-if="!hasRemoteVideo" class="absolute inset-0 flex flex-col items-center justify-center z-2 gap-4">
      <div class="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center text-white text-5xl font-bold shadow-2xl ring-4 ring-white/20">
        ?
      </div>
      <div class="text-center">
        <p class="text-white font-semibold text-xl">Calling...</p>
        <p class="text-white/50 text-sm mt-1">Waiting for the other person</p>
      </div>
      <div class="absolute w-40 h-40 rounded-full border border-white/10 animate-ping" style="animation-duration: 2s;"></div>
      <div class="absolute w-56 h-56 rounded-full border border-white/5 animate-ping" style="animation-duration: 2.5s;"></div>
    </div>

    <!-- Top bar -->
    <div class="absolute top-0 left-0 right-0 z-10 px-5 pt-5 pb-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20">
          <svg v-if="hasVideo" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24">
            <path fill="currentColor" d="M17 10.5V7c0-1.1-.9-2-2-2H3C1.9 5 1 5.9 1 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24">
            <path fill="currentColor" d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.21c1.2.48 2.5.74 3.86.74a1 1 0 011 1V20a1 1 0 01-1 1c-9.39 0-17-7.61-17-17a1 1 0 011-1h3.5a1 1 0 011 1c0 1.36.26 2.66.74 3.86a1 1 0 01-.21 1.11l-2.2 2.2z"/>
          </svg>
          <span class="text-white text-xs font-medium">{{ hasVideo ? 'Video Call' : 'Voice Call' }}</span>
        </div>
      </div>

      <!-- Call timer -->
      <div class="flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20">
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <span class="text-white text-xs font-mono font-medium">{{ formattedDuration }}</span>
      </div>
    </div>

    <!-- Local Video (PiP) -->
    <div class="absolute top-20 right-4 z-10 group">
      <div class="relative w-32 h-24 sm:w-40 sm:h-28 rounded-2xl overflow-hidden shadow-2xl border border-white/20 ring-2 ring-white/10 transition-all duration-200 hover:scale-105 hover:ring-white/30">
        <video
          ref="localVideo"
          autoplay
          muted
          playsinline
          class="w-full h-full object-cover"
        ></video>
        <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
          <span class="text-white text-xs font-medium">You</span>
        </div>
        <div v-if="!videoEnabled && hasVideo" class="absolute inset-0 bg-slate-900 flex items-center justify-center rounded-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white/40" viewBox="0 0 24 24">
            <path fill="currentColor" d="M21 6.5l-4-4-15 15 4 4 2.54-2.54C9.29 19.62 10.61 20 12 20c4.42 0 8-3.58 8-8 0-1.39-.38-2.71-1.04-3.85L21 6.5zm-9 11c-.92 0-1.78-.25-2.53-.67l7.86-7.86c.42.75.67 1.61.67 2.53 0 3.31-2.69 6-6 6zM3.27 4.27L2 5.54 4.73 8.27C3.65 9.73 3 11.28 3 12c0 4.42 3.58 8 8 8 1.72 0 3.27-.55 4.54-1.46l2.73 2.73 1.27-1.27L3.27 4.27z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Bottom controls -->
    <div class="absolute bottom-0 left-0 right-0 z-10 pb-8 pt-6 px-6" style="background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)">
      <div class="flex items-center justify-center gap-4">

        <!-- Mic toggle -->
        <div class="flex flex-col items-center gap-1.5">
          <button
            @click="toggleMic"
            :class="[
              'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg active:scale-95',
              micEnabled
                ? 'bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20'
                : 'bg-red-500 hover:bg-red-600 border border-red-400'
            ]"
          >
            <svg v-if="micEnabled" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          </button>
          <span class="text-white/60 text-[10px] font-medium">{{ micEnabled ? 'Mute' : 'Unmute' }}</span>
        </div>

        <!-- Hang up -->
        <div class="flex flex-col items-center gap-1.5">
          <button
            @click="hangUp"
            class="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95 border border-red-400 ring-4 ring-red-500/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-white" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.99.99 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.997.997 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
          <span class="text-white/60 text-[10px] font-medium">End Call</span>
        </div>

        <!-- Camera toggle -->
        <div v-if="hasVideo" class="flex flex-col items-center gap-1.5">
          <button
            @click="toggleVideo"
            :class="[
              'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg active:scale-95',
              videoEnabled
                ? 'bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20'
                : 'bg-red-500 hover:bg-red-600 border border-red-400'
            ]"
          >
            <svg v-if="videoEnabled" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24">
              <path fill="currentColor" d="M17 10.5V7c0-1.1-.9-2-2-2H3C1.9 5 1 5.9 1 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24">
              <path fill="currentColor" d="M21 6.5l-4-4-15 15 4 4 2.54-2.54C9.29 19.62 10.61 20 12 20c4.42 0 8-3.58 8-8 0-1.39-.38-2.71-1.04-3.85L21 6.5z"/>
            </svg>
          </button>
          <span class="text-white/60 text-[10px] font-medium">{{ videoEnabled ? 'Camera' : 'No Cam' }}</span>
        </div>

        <!-- Speaker (voice call) -->
        <div v-if="!hasVideo" class="flex flex-col items-center gap-1.5">
          <button class="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all duration-200 shadow-lg active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24">
              <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
          <span class="text-white/60 text-[10px] font-medium">Speaker</span>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessengerStore } from '../stores/messenger/index'

const messengerStore = useMessengerStore()

// ── Use storeToRefs for reactive store properties ────────
const { remoteStream, localStream, currentCallIsVideo } = storeToRefs(messengerStore)

const remoteVideo = ref<HTMLVideoElement | null>(null)
const localVideo = ref<HTMLVideoElement | null>(null)
const videoEnabled = ref(true)
const micEnabled = ref(true)

// ── Call Timer ───────────────────────────────────────────
const callDuration = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

const formattedDuration = computed(() => {
  const m = Math.floor(callDuration.value / 60).toString().padStart(2, '0')
  const s = (callDuration.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

onMounted(() => {
  timerInterval = setInterval(() => { callDuration.value++ }, 1000)
})

// ── Computed ─────────────────────────────────────────────
const hasVideo = computed(() => currentCallIsVideo.value)

const hasRemoteVideo = computed(() => {
  if (!remoteStream.value) return false
  return remoteStream.value.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
})

// ── Controls ─────────────────────────────────────────────
const toggleMic = () => {
  const tracks = localStream.value?.getAudioTracks()
  if (!tracks?.length) return
  micEnabled.value = !micEnabled.value
  tracks.forEach(t => (t.enabled = micEnabled.value))
}

const toggleVideo = () => {
  const tracks = localStream.value?.getVideoTracks()
  if (!tracks?.length) return
  videoEnabled.value = !videoEnabled.value
  tracks.forEach(t => (t.enabled = videoEnabled.value))
}

const hangUp = () => messengerStore.endCall()

// ── Remote Video ─────────────────────────────────────────
let remoteVideoUpdateTimer: ReturnType<typeof setTimeout> | null = null
let remoteApplyToken = 0
let remoteAutoplayBound = false

const applyRemoteStreamAndPlay = async (stream: MediaStream) => {
  if (!remoteVideo.value) return
  stream.getAudioTracks().forEach(track => { track.enabled = true })
  // Avoid restarting playback if we already have this stream
  if (remoteVideo.value.srcObject !== stream) {
    remoteVideo.value.srcObject = stream
  }
  remoteVideo.value.autoplay = true
  remoteVideo.value.playsInline = true
  // Autoplay policies often block play() when audio is unmuted, which can look like a black video.
  // Start muted so video can render; unmute on first user gesture (see resumeAudio()).
  remoteVideo.value.muted = true

  // Ensure we trigger playback when metadata is ready (some browsers won't start decoding otherwise)
  if (!remoteAutoplayBound) {
    remoteAutoplayBound = true
    const tryPlay = () => {
      if (!remoteVideo.value) return
      remoteVideo.value.play().catch(err => console.warn('Remote video play() failed:', err))
    }
    remoteVideo.value.addEventListener('loadedmetadata', tryPlay)
    remoteVideo.value.addEventListener('canplay', tryPlay)
  }

  try {
    await remoteVideo.value.play()
  } catch (err) {
    console.warn('Remote video play() failed:', err)
  }
}

const updateRemoteVideo = async (stream: MediaStream | null) => {
  if (!stream || !remoteVideo.value) return
  const token = ++remoteApplyToken
  if (remoteVideoUpdateTimer) {
    clearTimeout(remoteVideoUpdateTimer)
    remoteVideoUpdateTimer = null
  }
  remoteVideoUpdateTimer = setTimeout(async () => {
    remoteVideoUpdateTimer = null
    // Only apply the latest update; prevents "play interrupted by new load request"
    if (token !== remoteApplyToken) return
    await applyRemoteStreamAndPlay(stream)
  }, 250)
}

watch(remoteStream, async (stream) => {
  await updateRemoteVideo(stream ?? null)
  if (stream && !remoteVideo.value) {
    await nextTick()
    await updateRemoteVideo(stream)
  }
}, { immediate: true })

// NOTE: do not deep-watch remote stream track counts; it causes repeated srcObject resets
// while tracks are still arriving, which frequently interrupts playback on some browsers.

// ── Local Video ──────────────────────────────────────────
watchEffect(async () => {
  const stream = localStream.value
  const video = localVideo.value
  if (!stream || !video) return
  await nextTick()
  video.srcObject = stream
  video.autoplay = true
  video.playsInline = true
  video.muted = true
  try { await video.play() } catch (err) { console.warn('Local video play blocked:', err) }
})

// ── Autoplay fix ─────────────────────────────────────────
const resumeAudio = () => {
  if (remoteVideo.value && remoteStream.value) {
    remoteVideo.value.srcObject = remoteStream.value
    remoteVideo.value.muted = false
    remoteVideo.value.play().catch(err => console.warn('Retry failed:', err))
  }
}

onMounted(async () => {
  window.addEventListener('click', resumeAudio, { once: true })
  if (remoteStream.value && remoteVideo.value) {
    await nextTick()
    await applyRemoteStreamAndPlay(remoteStream.value)
  }
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (remoteVideoUpdateTimer) clearTimeout(remoteVideoUpdateTimer)
  window.removeEventListener('click', resumeAudio)
  if (localVideo.value) localVideo.value.srcObject = null
  if (remoteVideo.value) remoteVideo.value.srcObject = null
})
</script>

<style scoped>
video { background-color: #0a0a0a; }
.z-1 { z-index: 1; }
.z-2 { z-index: 2; }
</style>