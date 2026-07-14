<template>
  <transition name="chat">
    <div
      v-if="chat.isOpen"
      class="static sm:relative w-full sm:w-60 md:w-96 h-[480px] bg-white rounded-t-lg sm:rounded-lg shadow-xl overflow-hidden flex flex-col flex-shrink-0"
    >
      <!-- Header -->
      <div
        class="bg-blue-600 text-white p-3 flex justify-between items-center flex-shrink-0"
      >
        <div class="chat-header">
          <div
            class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold"
          >
            {{ peopleName.charAt(0).toUpperCase() }}
          </div>
          <a href="/messenger" class="username">{{ peopleName }}</a>
          <span :class="['status-dot', partnerStatus]" />
        </div>
        <div class="flex items-center gap-3">
          <svg
            @click="startVoiceCall"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            class="w-5 h-5 cursor-pointer hover:text-green-300"
          >
            <path
              d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.21c1.2.48 2.5.74 3.86.74a1 1 0 011 1V20a1 1 0 01-1 1c-9.39 0-17-7.61-17-17a1 1 0 011-1h3.5a1 1 0 011 1c0 1.36.26 2.66.74 3.86a1 1 0 01-.21 1.11l-2.2 2.2z"
            />
          </svg>
          <svg
            @click="startVideoCall"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            class="w-5 h-5 cursor-pointer hover:text-green-300"
          >
            <path
              d="M17 10.5V7c0-1.1-.9-2-2-2H3C1.9 5 1 5.9 1 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"
            />
          </svg>
          <button
            class="cursor-pointer"
            title="Minimize"
            @click="$emit('minimize', chat.partnerId)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 13H5v-2h14v2z" />
            </svg>
          </button>
          <button
            class="cursor-pointer"
            @click="$emit('close', chat.partnerId)"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Loading older messages -->
      <div
        v-if="isLoadingOlder"
        class="text-xs text-center text-gray-400 py-1 flex-shrink-0"
      >
        Loading older messages...
      </div>

      <!-- Messages -->
      <div
        ref="messagesEl"
        @scroll="onScroll"
        class="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
      >
        <!-- Empty state -->
        <div
          v-if="!formattedMessages.length"
          class="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 h-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-12 h-12 text-slate-200"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
            />
          </svg>
          <p class="text-sm font-medium text-slate-400">No messages yet</p>
          <p class="text-xs text-slate-300 flex items-center gap-1">
            Say hello!
            <svg
              class="text-yellow-300"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M12.8 23q-2.05 0-3.85-.937T6 19.45l-4.425-6.5q-.175-.25-.137-.537t.237-.488q.5-.525 1.238-.6t1.337.35l2.75 1.9V4q0-.425.288-.712T8 3t.713.288T9 4v8h2V2q0-.425.288-.712T12 1t.713.288T13 2v10h2V3q0-.425.288-.712T16 2t.713.288T17 3v9h2V5q0-.425.288-.712T20 4t.713.288T21 5v9.8q0 3.425-2.387 5.813T12.8 23"
              />
            </svg>
          </p>
        </div>

        <div v-for="(msg, i) in formattedMessages" :key="msg.id">
          <!-- DAY HEADER -->
          <div v-if="msg.showDay" class="w-full flex justify-center my-4">
            <span
              class="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full"
            >
              {{ msg.formattedDay }}
            </span>
          </div>

          <!-- Message row -->
          <div
            class="relative flex w-full"
            :class="msg.isSender ? 'justify-end' : 'justify-start'"
          >
            <!-- Reaction menu -->
            <div
              v-if="activeReactionId === msg.id"
              :class="[
                'absolute bottom-full mb-1 z-50',
                'flex gap-1 bg-white border border-gray-200 shadow-lg rounded-full px-2 py-1',
                msg.isSender ? 'right-0' : 'left-0',
              ]"
            >
              <svg
                @click.stop="
                  reactionTyp(msg.id, 1);
                  activeReactionId = null;
                "
                class="w-7 h-7 cursor-pointer text-blue-400 hover:scale-125 transition-transform"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M23 10a2 2 0 0 0-2-2h-6.32l.96-4.57c.02-.1.03-.21.03-.32c0-.41-.17-.79-.44-1.06L14.17 1L7.59 7.58C7.22 7.95 7 8.45 7 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73zM1 21h4V9H1z"
                />
              </svg>
              <img
                @click.stop="
                  reactionTyp(msg.id, 2);
                  activeReactionId = null;
                "
                :src="heart"
                class="w-7 h-7 cursor-pointer hover:scale-125 transition-transform"
              />
              <img
                @click.stop="
                  reactionTyp(msg.id, 3);
                  activeReactionId = null;
                "
                :src="laugh"
                class="w-7 h-7 cursor-pointer hover:scale-125 transition-transform"
              />
              <img
                @click.stop="
                  reactionTyp(msg.id, 4);
                  activeReactionId = null;
                "
                :src="sad"
                class="w-7 h-7 cursor-pointer hover:scale-125 transition-transform"
              />
              <img
                @click.stop="
                  reactionTyp(msg.id, 5);
                  activeReactionId = null;
                "
                :src="angry"
                class="w-7 h-7 cursor-pointer hover:scale-125 transition-transform"
              />
            </div>

            <!-- Message bubble -->
            <div
              @click="toggleReaction(msg.id)"
              :class="[
                msg.isSender
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-900',
                'relative px-3 py-2 rounded-lg break-words whitespace-pre-wrap cursor-pointer',
              ]"
              style="max-width: 75%; min-height: 2.5rem; margin: 0.25rem 0"
            >
              <!-- 3-dot menu -->
              <div class="absolute top-0 right-0 z-40">
                <button
                  class="text-xs opacity-60 hover:opacity-100"
                  @click.stop="
                    openMenuIndex = openMenuIndex === msg.id ? null : msg.id
                  "
                  style="
                    font-size: 1rem;
                    font-weight: bolder;
                    cursor: pointer;
                    padding: 0 4px;
                  "
                >
                  ⋯
                </button>
                <div
                  v-if="openMenuIndex === msg.id"
                  class="absolute right-0 mt-5 bg-white text-black rounded shadow-md text-xs z-50 min-w-[80px]"
                >
                  <button
                    class="block px-3 py-1 hover:bg-gray-100 w-full text-left"
                    @click.stop="
                      deleteUserMessage(msg.id);
                      openMenuIndex = null;
                    "
                  >
                    Delete
                  </button>
                  <button
                    class="block px-3 py-1 hover:bg-gray-100 w-full text-left"
                    @click.stop="openMenuIndex = null"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Content -->
              <div class="pr-4">{{ msg.content }}</div>

              <!-- Permanent reaction -->
              <div
                v-if="msg.reactiontype"
                class="absolute -bottom-3 text-sm bg-white rounded-full px-1 shadow"
                :class="msg.isSender ? 'right-1' : 'left-1'"
              >
                {{ reactionEmoji(msg.reactiontype) }}
              </div>

              <!-- Time -->
              <div class="text-[10px] opacity-70 mt-1 text-right">
                {{ formatTime(msg.createdAt) }}
              </div>

              <!-- Attachments -->
              <div
                v-if="msg.attachments?.length"
                class="mt-1 flex flex-col gap-1"
              >
                <template v-for="att in msg.attachments" :key="att.filepath">
                  <img
                    v-if="isImage(att.filename)"
                    :src="att.filepath"
                    class="max-w-full rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                    loading="lazy"
                    @click.stop="openLightbox(att.filepath)"
                  />
                  <a
                    v-else
                    :href="att.filepath"
                    target="_blank"
                    class="text-blue-300 underline text-xs break-words"
                    >{{ att.filename }}</a
                  >
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Attachment previews -->
      <transition name="slide-up">
        <div
          v-if="selectedFiles.length"
          class="px-3 py-2 flex gap-2 overflow-x-auto border-t border-gray-100 bg-gray-50 flex-shrink-0 scrollbar-hide"
        >
          <div
            v-for="(file, idx) in selectedFiles"
            :key="idx"
            class="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white group"
          >
            <img
              v-if="file.type.startsWith('image/')"
              :src="previewUrl(file)"
              class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div
              v-else
              class="w-full h-full flex flex-col items-center justify-center gap-1 p-1 bg-blue-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6 text-blue-400"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                />
              </svg>
              <span
                class="text-[9px] text-blue-500 text-center leading-tight break-all line-clamp-2 px-1"
                >{{ file.name }}</span
              >
            </div>
            <button
              @click="selectedFiles.splice(idx, 1)"
              class="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow transition-colors duration-150 z-10"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3 h-3"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
            <div
              v-if="file.type.startsWith('image/')"
              class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"
            />
          </div>
          <div
            v-if="selectedFiles.length > 1"
            class="flex-shrink-0 self-end mb-1"
          >
            <span class="text-xs text-gray-400"
              >{{ selectedFiles.length }} files</span
            >
          </div>
        </div>
      </transition>

      <!-- Camera Modal -->
      <transition name="slide-up">
        <div
          v-if="showCameraModal"
          class="absolute inset-0 z-50 bg-black flex flex-col"
        >
          <!-- Camera Header -->
          <div
            class="flex items-center justify-between px-4 py-3 bg-black flex-shrink-0"
          >
            <button
              @click="closeCamera"
              class="text-white/70 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
            <span class="text-white text-sm font-medium">Camera</span>
            <!-- Flip camera -->
            <button
              @click="flipCamera"
              class="text-white/70 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 11V8l6 4-6 4z"
                />
              </svg>
            </button>
          </div>

          <!-- Video Preview -->
          <div class="flex-1 relative overflow-hidden">
            <video
              ref="cameraVideoEl"
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
            />
            <!-- Captured photo preview -->
            <div
              v-if="capturedPhoto"
              class="absolute inset-0 bg-black flex items-center justify-center"
            >
              <img
                :src="capturedPhoto"
                class="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          <!-- Hidden canvas for capture -->
          <canvas ref="canvasEl" class="hidden" />

          <!-- Camera Controls -->
          <div
            class="flex items-center justify-around px-6 py-5 bg-black flex-shrink-0"
          >
            <!-- Retake / Gallery -->
            <button
              v-if="capturedPhoto"
              @click="retakePhoto"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
                />
              </svg>
            </button>
            <div v-else class="w-10 h-10" />

            <!-- Shutter / Send -->
            <button
              v-if="!capturedPhoto"
              @click="capturePhoto"
              class="w-16 h-16 rounded-full bg-white border-4 border-white/40 hover:scale-95 transition-transform shadow-lg"
            />
            <button
              v-else
              @click="sendCapturedPhoto"
              class="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-7 h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>

            <div class="w-10 h-10" />
          </div>
        </div>
      </transition>

      <!-- Input -->
      <div class="border-t p-2 flex items-center gap-2 flex-shrink-0">
        <!-- Attach file -->
        <button
          @click="triggerFileInput('file')"
          class="cursor-pointer p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-blue-600 flex-shrink-0"
          title="Attach file"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
            />
          </svg>
        </button>
        <!-- Attach image -->
        <button
          @click="triggerFileInput('image')"
          class="cursor-pointer p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-blue-600 flex-shrink-0"
          title="Attach image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
            />
          </svg>
        </button>
        <!-- Camera capture -->
        <button
          @click="openCamera"
          class="cursor-pointer p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-blue-600 flex-shrink-0"
          title="Take photo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" />
            <path
              d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
            />
          </svg>
        </button>

        <input
          type="file"
          ref="fileInput"
          class="hidden"
          @change="onFileChange"
        />
        <input
          type="file"
          ref="imageInput"
          accept="image/*"
          class="hidden"
          @change="onFileChange"
        />

        <input
          ref="messageInput"
          v-model="message"
          placeholder="Type a message..."
          class="flex-1 text-sm px-3 py-2 border rounded-full focus:outline-none focus:ring-1 focus:ring-blue-500"
          @keyup.enter="sendMessage"
        />
        <button
          @click="sendMessage"
          class="bg-blue-600 p-2 rounded-full text-white hover:bg-blue-700 flex-shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  </transition>

  <!-- ======== LIGHTBOX ======== -->
  <teleport to="body">
    <transition name="lightbox">
      <div
        v-if="lightboxSrc"
        class="fixed inset-0 z-[9999] flex items-center justify-center"
        @click="closeLightbox"
      >
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div
          class="relative z-10 flex flex-col items-center gap-3 p-4 max-w-[95vw] max-h-[95vh]"
          @click.stop
        >
          <div class="flex items-center justify-between w-full">
            <span class="text-white/60 text-xs">Image preview</span>
            <div class="flex items-center gap-3">
              <a
                :href="lightboxSrc"
                download
                class="text-white/70 hover:text-white transition-colors"
                title="Download"
                @click.stop
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"
                  />
                </svg>
              </a>
              <button
                @click="closeLightbox"
                class="text-white/70 hover:text-white transition-colors"
                title="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-6 h-6"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <img
            :src="lightboxSrc"
            class="max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl object-contain select-none"
            draggable="false"
          />
        </div>
      </div>
    </transition>
  </teleport>

  <!-- Call Screen -->
  <CallScreen ref="callScreen" v-if="messengerStore.inCall" />
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "#imports";
import { useMessengerStore } from "../stores/messenger/index";
import CallScreen from "./CallScreen.vue";

import laugh from "../../public/laugh.gif";
import heart from "../../public/heart.gif";
import sad from "../../public/sad.gif";
import angry from "../../public/angry.gif";

const props = defineProps<{ chat: any; index: number }>();
const emit = defineEmits(["close", "minimize"]);

const authStore = useAuthStore();
const messengerStore = useMessengerStore();

const message = ref("");
const selectedFiles = ref<File[]>([]);
const messagesEl = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const isMobile = ref(false);
const isLoadingOlder = ref(false);
const openMenuIndex = ref<number | string | null>(null);
const activeReactionId = ref<number | string | null>(null);
const callScreen = ref<any>(null);
const lastScrollAtBottom = ref(true);
const messageInput = ref<HTMLInputElement | null>(null);

// ------------------ Camera ------------------
const showCameraModal = ref(false);
const cameraVideoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const capturedPhoto = ref<string | null>(null);
const cameraStream = ref<MediaStream | null>(null);
const facingMode = ref<"environment" | "user">("environment");

const openCamera = async () => {
  capturedPhoto.value = null;
  showCameraModal.value = true;
  await nextTick();
  await startStream();
};

const startStream = async () => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach((t) => t.stop());
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value },
      audio: false,
    });
    cameraStream.value = stream;
    if (cameraVideoEl.value) {
      cameraVideoEl.value.srcObject = stream;
    }
  } catch (err) {
    console.error("Camera error:", err);
    alert("Could not access camera. Please allow camera permission.");
    showCameraModal.value = false;
  }
};

const flipCamera = async () => {
  facingMode.value =
    facingMode.value === "environment" ? "user" : "environment";
  await startStream();
};

const capturePhoto = () => {
  if (!cameraVideoEl.value || !canvasEl.value) return;
  const video = cameraVideoEl.value;
  const canvas = canvasEl.value;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, 0, 0);
  capturedPhoto.value = canvas.toDataURL("image/jpeg", 0.92);
};

const retakePhoto = () => {
  capturedPhoto.value = null;
};

const sendCapturedPhoto = async () => {
  if (!capturedPhoto.value) return;

  // Convert base64 to File
  const res = await fetch(capturedPhoto.value);
  const blob = await res.blob();
  const file = new File([blob], `photo_${Date.now()}.jpg`, {
    type: "image/jpeg",
  });

  closeCamera();

  // Send directly
  await messengerStore.initSignalR();
  await messengerStore.sendMessage(props.chat.partnerId, message.value, [file]);
  message.value = "";
};

const closeCamera = () => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach((t) => t.stop());
    cameraStream.value = null;
  }
  capturedPhoto.value = null;
  showCameraModal.value = false;
};

// ------------------ Lightbox ------------------
const lightboxSrc = ref<string | null>(null);
const openLightbox = (src: string) => {
  lightboxSrc.value = src;
  document.body.style.overflow = "hidden";
};
const closeLightbox = () => {
  lightboxSrc.value = null;
  document.body.style.overflow = "";
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (showCameraModal.value) closeCamera();
    else closeLightbox();
  }
};
onMounted(() => window.addEventListener("keydown", onKeyDown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  closeCamera();
});

const modalOffset = computed(() => 24 + props.index * 360);
const peopleStore = useAuthStore();

watch(
  () => props.chat,
  async (newChat) => {
    if (newChat) {
      await nextTick();
      messageInput.value?.focus();
    }
  },
  { immediate: true },
);

const getSessionId = () => authStore.user?.userId;

const toggleReaction = (msgId: number | string) => {
  activeReactionId.value = activeReactionId.value === msgId ? null : msgId;
};

const reactionEmoji = (type: number | null | undefined) => {
  switch (type) {
    case 1:
      return "👍";
    case 2:
      return "❤️";
    case 3:
      return "😂";
    case 4:
      return "😢";
    case 5:
      return "😡";
    default:
      return null;
  }
};

const previewUrl = (file: File) => window.URL.createObjectURL(file);
const isImage = (file: string) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(file);
const formatTime = (time: string) =>
  time
    ? new Date(time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const updateScreen = () => (isMobile.value = window.innerWidth < 640);
onMounted(() => {
  updateScreen();
  window.addEventListener("resize", updateScreen);
});
onUnmounted(() => window.removeEventListener("resize", updateScreen));

const formatDay = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formattedMessages = computed(() => {
  const userId = getSessionId();
  const msgs = [...(props.chat?.messages || [])]
    .map((m: any) => ({ ...m, createdAt: m.createdAt ?? m.createdat ?? null }))
    .filter((m) => m.createdAt)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  let lastDay = "";
  return msgs.map((msg: any) => {
    const currentDayKey = new Date(msg.createdAt).toDateString();
    const showDay = currentDayKey !== lastDay;
    lastDay = currentDayKey;
    return {
      ...msg,
      showDay,
      formattedDay: formatDay(msg.createdAt),
      isSender: Number(msg.senderId ?? msg.senderid) === Number(userId),
    };
  });
});

const scrollToBottom = async (smooth = false) => {
  await nextTick();
  if (!messagesEl.value) return;
  messagesEl.value.scrollTo({
    top: messagesEl.value.scrollHeight,
    behavior: smooth ? "smooth" : "auto",
  });
};

const onScroll = () => {
  if (!messagesEl.value) return;
  if (messagesEl.value.scrollTop < 20) loadOlderMessages();
};

const loadOlderMessages = async () => {
  if (!props.chat || isLoadingOlder.value) return;
  const scrollEl = messagesEl.value;
  if (!scrollEl) return;
  isLoadingOlder.value = true;
  const previousScrollHeight = scrollEl.scrollHeight;
  await messengerStore.loadOlderMessages(
    props.chat.partnerId,
    Number(getSessionId()),
  );
  await nextTick();
  scrollEl.scrollTop = scrollEl.scrollHeight - previousScrollHeight;
  isLoadingOlder.value = false;
};

const triggerFileInput = (type: "file" | "image") => {
  if (type === "file") fileInput.value?.click();
  else imageInput.value?.click();
};

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) selectedFiles.value = Array.from(input.files);
};

const sendMessage = async () => {
  if (!props.chat || !Number(props.chat.partnerId)) return;
  if (!message.value.trim() && !selectedFiles.value.length) return;
  await messengerStore.initSignalR();
  await messengerStore.sendMessage(
    props.chat.partnerId,
    message.value,
    selectedFiles.value,
  );
  message.value = "";
  selectedFiles.value = [];
};

const reactionTyp = async (messageId: number, type: number) => {
  await messengerStore.reactionMessage(messageId, type);
  const msg = props.chat.messages.find((m: any) => m.id === messageId);
  if (msg) msg.reactiontype = msg.reactiontype === type ? null : type;
};

const deleteUserMessage = (messageId: number) => {
  messengerStore.deleteMessage(messageId);
};

const startVoiceCall = async () => {
  await messengerStore.startCall(props.chat.partnerId, false);
  localStorage.setItem("messenger_inCall", "true");
  localStorage.setItem("messenger_callType", "voice");
  localStorage.setItem("messenger_partnerId", String(props.chat.partnerId));
  if (callScreen.value?.remoteVideo && messengerStore.remoteStream)
    callScreen.value.remoteVideo.srcObject = messengerStore.remoteStream;
};

const startVideoCall = async () => {
  await messengerStore.startCall(Number(props.chat.partnerId), true);
  localStorage.setItem("messenger_inCall", "true");
  localStorage.setItem("messenger_callType", "video");
  localStorage.setItem("messenger_partnerId", String(props.chat.partnerId));
  if (callScreen.value?.remoteVideo && messengerStore.remoteStream)
    callScreen.value.remoteVideo.srcObject = messengerStore.remoteStream;
};

watch(
  () => props.chat?.messages,
  async (newMessages, oldMessages) => {
    if (!messagesEl.value) return;
    const scrollEl = messagesEl.value;
    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;
    const realNewMessages = newMessages.filter(
      (m: any) => !m.isTemp && m.senderId !== getSessionId(),
    );
    const realOldMessages =
      oldMessages?.filter(
        (m: any) => !m.isTemp && m.senderId !== getSessionId(),
      ) || [];
    lastScrollAtBottom.value =
      prevScrollHeight - prevScrollTop - scrollEl.clientHeight < 50;
    await nextTick();
    await nextTick();
    const newScrollHeight = scrollEl.scrollHeight;
    if (
      realNewMessages.length > realOldMessages.length &&
      !lastScrollAtBottom.value
    ) {
      scrollEl.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
    } else if (lastScrollAtBottom.value) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  },
  { deep: true },
);

watch(
  () => props.chat?.partnerId,
  async (pid) => {
    if (!pid) return;
    await messengerStore.viewMessagesPerson(
      Number(getSessionId()),
      Number(pid),
    );
    await nextTick();
    await scrollToBottom(false);
  },
  { immediate: true },
);

const localChat = ref({ ...props.chat });
watch(
  () => props.chat,
  (newChat) => {
    localChat.value = { ...newChat };
  },
  { deep: true, immediate: true },
);

const peopleName = ref("");
onMounted(async () => {
  await peopleStore.getRecipientName(props.chat.partnerId);
  peopleName.value = peopleStore.recipientName;
});

const partnerStatus = computed(() => {
  if (!messengerStore.isUserOnline(props.chat.partnerId)) return "offline";
  return messengerStore.isUserActive(props.chat.partnerId) ? "active" : "idle";
});

const offerAvailable = computed(
  () => !!messengerStore.incomingCall?.offer?.sdp,
);
</script>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.username {
  font-weight: 600;
  font-size: 0.95rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.active {
  background: #22c55e;
}
.status-dot.idle {
  background: #facc15;
}
.status-dot.offline {
  background: #6b7280;
}

.chat-enter-active,
.chat-leave-active {
  transition: all 0.25s ease;
}
.chat-enter-from,
.chat-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.lightbox-enter-active {
  transition: all 0.2s ease;
}
.lightbox-leave-active {
  transition: all 0.15s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
