<template>
  <teleport to="body">
    <transition name="incoming-call">
      <div
        class="fixed inset-0 flex items-end sm:items-center justify-center z-[9999] p-4"
        style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(6px)"
      >
        <div
          class="w-full max-w-sm bg-gradient-to-b from-blue-300 to-blue-500 rounded-3xl shadow-2xl overflow-hidden border border-white/10"
        >
          <div
            class="h-1 w-full"
            style="background: linear-gradient(90deg, #93c5fd, #ef4444)"
          ></div>

          <div class="px-6 pt-8 pb-6 flex flex-col items-center gap-5">
            <!-- Avatar with pulse -->
            <div class="relative">
              <div
                class="absolute inset-0 rounded-full animate-ping opacity-20"
                :class="isVideo ? 'bg-blue-500' : 'bg-red-500'"
                style="animation-duration: 1.8s"
              ></div>
              <div
                class="absolute -inset-3 rounded-full animate-ping opacity-10"
                :class="isVideo ? 'bg-blue-400' : 'bg-red-400'"
                style="animation-duration: 2.4s"
              ></div>
              <div
                :class="[
                  'w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl relative z-10 ring-4 ring-white/20',
                  isVideo
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                    : 'bg-gradient-to-br from-blue-800 to-green-700',
                ]"
              >
                {{ callerInitial }}
              </div>
            </div>

            <!-- Caller info -->
            <div class="text-center">
              <p
                class="text-white/60 text-sm font-medium tracking-wide uppercase mb-1"
              >
                Incoming {{ isVideo ? "Video" : "Voice" }} Call
              </p>
              <h2 class="text-white text-2xl font-bold tracking-tight">
                {{ callerName }}
              </h2>
              <div class="flex items-center justify-center gap-1 mt-2">
                <div
                  class="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                  style="animation-delay: 0s"
                ></div>
                <div
                  class="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                  style="animation-delay: 0.15s"
                ></div>
                <div
                  class="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                  style="animation-delay: 0.3s"
                ></div>
              </div>
            </div>

            <!-- Call type badge -->
            <div
              :class="[
                'flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium',
                isVideo
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : 'bg-green-500/10 border-green-800/30 text-white',
              ]"
            >
              <svg
                v-if="isVideo"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M17 10.5V7c0-1.1-.9-2-2-2H3C1.9 5 1 5.9 1 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"
                />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.21c1.2.48 2.5.74 3.86.74a1 1 0 011 1V20a1 1 0 01-1 1c-9.39 0-17-7.61-17-17a1 1 0 011-1h3.5a1 1 0 011 1c0 1.36.26 2.66.74 3.86a1 1 0 01-.21 1.11l-2.2 2.2z"
                />
              </svg>
              {{ isVideo ? "Video Call" : "Voice Call" }}
            </div>

            <!-- Waiting for signal indicator -->
            <div
              v-if="!offerReady"
              class="flex items-center gap-2 text-white/50 text-xs"
            >
              <div
                class="w-3 h-3 border-2 border-white/30 border-t-white/80 rounded-full animate-spin"
              ></div>
              Connecting signal...
            </div>

            <!-- Action buttons -->
            <div class="flex items-center justify-center gap-8 w-full mt-2">
              <!-- Reject -->
              <div class="flex flex-col items-center gap-2">
                <button
                  @click="handleReject"
                  class="cursor-pointer w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 ring-4 ring-red-500/30 border border-red-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="currentColor"
                      d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.99.99 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.997.997 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"
                    />
                  </svg>
                </button>
                <span class="text-white/50 text-xs font-medium">Decline</span>
              </div>

              <!-- Accept -->
              <div class="flex flex-col items-center gap-2">
                <button
                  class="cursor-pointer"
                  @click="handleAccept"
                  :disabled="!offerReady"
                  :class="[
                    'w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 border ring-4 disabled:opacity-40 disabled:cursor-not-allowed',
                    isVideo
                      ? 'bg-blue-500 hover:bg-blue-600 border-blue-400 ring-blue-500/30'
                      : 'bg-green-500 hover:bg-green-600 border-green-400 ring-green-500/30',
                  ]"
                >
                  <svg
                    v-if="isVideo"
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="currentColor"
                      d="M17 10.5V7c0-1.1-.9-2-2-2H3C1.9 5 1 5.9 1 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"
                    />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="currentColor"
                      d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.21c1.2.48 2.5.74 3.86.74a1 1 0 011 1V20a1 1 0 01-1 1c-9.39 0-17-7.61-17-17a1 1 0 011-1h3.5a1 1 0 011 1c0 1.36.26 2.66.74 3.86a1 1 0 01-.21 1.11l-2.2 2.2z"
                    />
                  </svg>
                </button>
                <span class="text-white/50 text-xs font-medium">Accept</span>
              </div>
            </div>
          </div>

          <div
            class="volume-button"
            style="
              display: flex;
              width: 100%;
              justify-content: flex-end;
              padding: 1rem;
            "
          >
            <!-- ✅ Mute button pinned to top-right inside the card -->
            <button
              @click="toggleMute"
              class="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 text-white/70 hover:text-white text-xs font-medium"
            >
              <!-- Unmuted -->
              <svg
                v-if="!isMuted"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77"
                />
              </svg>
              <!-- Muted -->
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 text-red-300"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63m2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21.5 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71M4.27 3L3 4.27L7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21L21 19.73l-9-9z"
                />
              </svg>
              {{ isMuted ? "Unmute" : "Mute" }}
            </button>
          </div>

          <div class="h-2 bg-slate-900/50"></div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useMessengerStore } from "../stores/messenger/index";
import { useAuthStore } from "#imports";

const messengerStore = useMessengerStore();
const peopleStore = useAuthStore();
const { $unlockAudio } = useNuxtApp();

const callerName = ref("Unknown");
const offerReady = ref(false);
const ringtone = ref<HTMLAudioElement | null>(null);

const isVideo = computed(() => {
  const sdp = messengerStore.incomingCall?.offer?.sdp;
  if (sdp) return sdp.includes("m=video");
  return !!messengerStore.incomingCall?.video;
});

const callerInitial = computed(() =>
  callerName.value !== "Unknown"
    ? callerName.value.charAt(0).toUpperCase()
    : "?",
);

const isMuted = ref(false);

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (ringtone.value) {
    ringtone.value.volume = isMuted.value ? 0 : 0.8;
  }
};

const stopRingtone = () => {
  if (ringtone.value) {
    ringtone.value.pause();
    ringtone.value.currentTime = 0;
    ringtone.value = null;
  }
};

const tryPlayRingtone = async () => {
  const { $unlockAudio } = useNuxtApp();

  console.log("$unlockAudio =", $unlockAudio);

  if (typeof $unlockAudio === "function") {
    $unlockAudio();
  }

  ringtone.value = new Audio("/sound/ringtone.mp3");
  ringtone.value.loop = true;
  ringtone.value.volume = 0.8;

  await new Promise((r) => setTimeout(r, 200));

  await ringtone.value.play().catch(console.warn);
};

watch(
  () => messengerStore.incomingCall?.offer?.sdp,
  (sdp) => {
    if (sdp) {
      offerReady.value = true;
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => messengerStore.incomingCall?.fromUserId,
  () => {
    offerReady.value = false;
  },
);

const nuxtApp = useNuxtApp();

onMounted(async () => {
  await tryPlayRingtone();

  console.log(nuxtApp);
  console.log(nuxtApp.$unlockAudio);
  console.log("Incoming Call:", messengerStore.incomingCall);
  const fromId = messengerStore.incomingCall?.fromUserId;
  console.log("fromId:", fromId);

  if (!fromId) return;
  try {
    await peopleStore.getRecipientName(fromId);
    callerName.value = peopleStore.name || `User ${fromId}`;
  } catch {
    callerName.value = `User ${fromId}`;
  }
});

onUnmounted(() => {
  stopRingtone();
});

const handleAccept = async () => {
  stopRingtone();
  const call = messengerStore.incomingCall;
  if (!call?.offer?.sdp) {
    console.error("❌ No offer SDP at accept time");
    return;
  }

  // Ensure CallScreen is in the right mode immediately (before it renders)
  messengerStore.currentCallIsVideo = call.offer.sdp.includes("m=video");

  await messengerStore.acceptCall(
    {
      type: call.offer.type?.toLowerCase() ?? "offer",
      sdp: call.offer.sdp,
      callId: String(call.callId ?? ""),
    },
    call.fromUserId,
  );
  messengerStore.incomingCall = null;
};

const handleReject = () => {
  stopRingtone();
  const call = messengerStore.incomingCall;
  if (!call) return;
  messengerStore.rejectIncomingCall(call.fromUserId);
  messengerStore.incomingCall = null;
  messengerStore.inCall = false;
};
</script>

<style scoped>
.incoming-call-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.incoming-call-leave-active {
  transition: all 0.2s ease;
}
.incoming-call-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}
.incoming-call-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}
</style>
