<template>
  <Teleport v-if="portalRoot" :to="portalRoot">
    <div :style="wrapperStyle">
      <iframe
        ref="frameEl"
        :src="chatUrl"
        allow="camera; microphone"
        style="
          width: 100%;
          height: 100%;
          border: none;
          background: transparent;
          display: block;
          pointer-events: auto;
        "
        @load="onFrameLoad"
      />
    </div>

    <ChatModalWidget
      :modals="modals"
      :sidebar-width="frameSize.width"
      :session-user-id="sessionUserId"
      :session-token="sessionToken"
      @close="closeModal"
      @minimize="minimizeModal"
      @restore="restoreModal"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "#imports";
import ChatModalWidget from "~/components/ChatModalWidget.vue";
import axios from "axios";
const authStore = useAuthStore();
const frameEl = ref<HTMLIFrameElement | null>(null);

const portalRoot = ref<HTMLElement | null>(null);

onMounted(() => {
  const el = document.createElement("div");
  el.id = "chat-widget-portal-root";
  el.style.cssText = `
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;
  document.body.appendChild(el);
  portalRoot.value = el;
});

onUnmounted(() => {
  portalRoot.value?.remove();
});

const viewport = reactive({ w: 0, h: 0 });
function updateViewport() {
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
}
onMounted(() => {
  updateViewport();
  window.addEventListener("resize", updateViewport);
});
onUnmounted(() => window.removeEventListener("resize", updateViewport));

const isWidgetOpen = ref(false);

const CHAT_ORIGIN = "https://apps.fastlogistics.com.ph"; // bare origin — used ONLY for e.origin checks & postMessage targetOrigin
const CHAT_BASE_URL = "https://apps.fastlogistics.com.ph/fastchat/#";
const chatUrl = `${CHAT_BASE_URL}/messenger-embed`;

const isCallActive = ref(false);
const frameSize = computed(() => {
  if (isCallActive.value) return { width: viewport.w, height: viewport.h };
  return isWidgetOpen.value
    ? { width: 352, height: 512 }
    : { width: 88, height: 88 };
});

const wrapperStyle = computed(() => {
  if (isCallActive.value) {
    return `position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: ${viewport.w}px; height: ${viewport.h}px; z-index: 99999; pointer-events: auto;`;
  }
  return `position: fixed; right: 0; bottom: 0; width: ${frameSize.value.width}px; height: ${frameSize.value.height}px; z-index: 9997; pointer-events: none; overflow: hidden;`;
});

interface ModalChat {
  partnerId: number;
  name: string;
  minimized: boolean;
}
const modals = reactive<ModalChat[]>([]);

// NEW — session state lives here, source of truth, passed down as props
// to ChatModalWidget so it can push it into every modal iframe too.
const sessionUserId = ref<number | null>(null);
const sessionToken = ref<string | null>(null);

function openModal(partnerId: number, name: string) {
  const existing = modals.find((m) => m.partnerId === partnerId);
  if (existing) {
    existing.minimized = false;
    return;
  }
  modals.push({ partnerId, name, minimized: false });
}
function closeModal(partnerId: number) {
  const i = modals.findIndex((m) => m.partnerId === partnerId);
  if (i !== -1) modals.splice(i, 1);
}
function minimizeModal(partnerId: number) {
  const m = modals.find((m) => m.partnerId === partnerId);
  if (m) m.minimized = true;
}
function restoreModal(partnerId: number) {
  const m = modals.find((m) => m.partnerId === partnerId);
  if (m) m.minimized = false;
}

let mainAcked = false;
let sessionSent = false;

function sendHello() {
  frameEl.value?.contentWindow?.postMessage(
    { type: "chat:hello" },
    CHAT_ORIGIN,
  );
}

async function fetchAndForwardSession() {
  if (sessionSent) return;
  try {
    const res = await axios.get("http://localhost:5256/api/Chat/session", {
      withCredentials: true,
    });
    const userId = res.data?.userId;
    const token = res.data?.token ?? null;
    if (!userId) {
      console.error("[parent] session fetch returned no userId");
      return;
    }

    // NEW — store it locally so ChatModalWidget can forward it to modal iframes.
    sessionUserId.value = Number(userId);
    sessionToken.value = token;

    frameEl.value?.contentWindow?.postMessage(
      { type: "chat:session", userId, token },
      CHAT_ORIGIN,
    );
    sessionSent = true;
  } catch (err) {
    console.error("[parent] failed to fetch session", err);
  }
}
let helloInterval: ReturnType<typeof setInterval> | null = null;
function onFrameLoad() {
  mainAcked = false;
  sessionSent = false;
  let attempts = 0;
  if (helloInterval) clearInterval(helloInterval);
  helloInterval = setInterval(() => {
    if (mainAcked || attempts >= 15) {
      if (helloInterval) clearInterval(helloInterval);
      helloInterval = null;
      return;
    }
    sendHello();
    attempts++;
  }, 300);
}

function handleMessage(e: MessageEvent) {
  if (e.origin !== CHAT_ORIGIN) return;

  if (e.data?.type === "chat:hello-ack") {
    mainAcked = true;
    if (helloInterval) {
      clearInterval(helloInterval);
      helloInterval = null;
    }
    fetchAndForwardSession();
  }
  if (e.data?.type === "chat:open-modal") {
    openModal(Number(e.data.partnerId), e.data.name || "Unknown");
  }
  if (e.data?.type === "chat:widget-open") {
    isWidgetOpen.value = !!e.data.open;
  }
  if (e.data?.type === "chat:call-start") {
    isCallActive.value = true;
  }
  if (e.data?.type === "chat:call-end") {
    isCallActive.value = false;
  }
}

onMounted(() => window.addEventListener("message", handleMessage));
onUnmounted(() => {
  window.removeEventListener("message", handleMessage);
  if (helloInterval) clearInterval(helloInterval);
});

function openChatWith(partnerId: number, name = "Unknown") {
  openModal(Number(partnerId), name);
}
defineExpose({ openChatWith });
</script>
