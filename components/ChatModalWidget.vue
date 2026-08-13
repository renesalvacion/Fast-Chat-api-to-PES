<!-- ITPRF /compontens/ChatModalWidget.vue -->

<template>
  <div
    v-for="(m, idx) in visibleModals"
    :key="m.partnerId"
    :style="modalWrapperStyle(idx, m.partnerId)"
  >
    <iframe
      :ref="(el) => setModalRef(m.partnerId, el as HTMLIFrameElement)"
      :src="modalUrl(m.partnerId, m.name)"
      allow="camera; microphone"
      style="
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        display: block;
      "
      @load="() => onModalLoad(m.partnerId)"
    />
  </div>

  <div v-if="minimizedModals.length" :style="minimizedRailStyle">
    <button
      v-for="m in minimizedModals"
      :key="m.partnerId"
      @click="$emit('restore', m.partnerId)"
      class="minimized-pill"
    >
      {{ m.name }}
      <span @click.stop="$emit('close', m.partnerId)">✕</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useAuthStore } from "#imports";

const fullscreenPartnerId = ref<number | null>(null);

function modalWrapperStyle(idxFromRight: number, partnerId: number) {
  if (fullscreenPartnerId.value === partnerId) {
    return `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 99999; pointer-events: auto;`;
  }
  const right = props.sidebarWidth + GAP + idxFromRight * (MODAL_W + GAP);
  return `position: fixed; right: ${right}px; bottom: 0; width: ${MODAL_W}px; height: ${MODAL_H}px; z-index: 9999; pointer-events: auto;`;
}

const props = defineProps<{
  modals: { partnerId: number; name: string; minimized: boolean }[];
  sidebarWidth: number;
  // NEW — session comes down from the parent widget so modal iframes don't
  // have to rely solely on cookies to identify themselves.
  sessionUserId?: number | null;
  sessionToken?: string | null;
}>();
const emit = defineEmits(["close", "minimize", "restore"]);

const authStore = useAuthStore();
const router = useRouter();

const CHAT_ORIGIN = "https://apps.fastlogistics.com.ph"; // bare origin — used ONLY for e.origin checks & postMessage targetOrigin
const CHAT_BASE_URL = "https://apps.fastlogistics.com.ph/fastchat/#";
const modalUrl = (partnerId: number, name: string) =>
  `${CHAT_BASE_URL}/messenger-modal-embed?partnerId=${partnerId}&name=${encodeURIComponent(name)}`;

const MODAL_W = 384;
const MODAL_H = 520;
const GAP = 12;

const visibleModals = computed(() => props.modals.filter((m) => !m.minimized));
const minimizedModals = computed(() => props.modals.filter((m) => m.minimized));

const modalRefs = new Map<number, HTMLIFrameElement>();
function setModalRef(partnerId: number, el: HTMLIFrameElement | null) {
  if (el) {
    modalRefs.set(partnerId, el);
  } else {
    modalRefs.delete(partnerId);
    ackedModals.delete(partnerId); // covers both close AND minimize unmounts
    sessionSentTo.delete(partnerId); // NEW — resend session if this modal remounts
  }
}

function modalStyle(idxFromRight: number) {
  const right = props.sidebarWidth + GAP + idxFromRight * (MODAL_W + GAP);
  return `position: fixed; right: ${right}px; bottom: 0; width: ${MODAL_W}px; height: ${MODAL_H}px; border: none; z-index: 9999; background: transparent;`;
}

const minimizedRailStyle = computed(
  () =>
    `position: fixed; right: ${props.sidebarWidth + GAP}px; bottom: 0; z-index: 9998; display: flex; flex-direction: row-reverse; gap: 8px;`,
);

const ackedModals = new Set<number>();
// NEW — track which modals already got a session push, so we don't spam
// them but can retry per-modal if the session prop arrives after mount.
const sessionSentTo = new Set<number>();

// ChatModalWidget.vue — replace sendHello and sendSessionTo

function sendHello(iframe: HTMLIFrameElement | undefined) {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage({ type: "chat:hello" }, CHAT_ORIGIN);
  } catch (err) {
    // iframe not ready yet (about:blank) — swallow, next interval tick retries
  }
}

function sendSessionTo(partnerId: number) {
  if (!props.sessionUserId) return;
  const el = modalRefs.get(partnerId);
  if (!el?.contentWindow) return;
  try {
    el.contentWindow.postMessage(
      {
        type: "chat:session",
        userId: props.sessionUserId,
        token: props.sessionToken ?? null,
      },
      CHAT_ORIGIN,
    );
    sessionSentTo.add(partnerId);
  } catch (err) {
    // not ready yet — will retry on next interval tick
  }
}

function onModalLoad(partnerId: number) {
  const el = modalRefs.get(partnerId);
  let attempts = 0;
  const interval = setInterval(() => {
    if (ackedModals.has(partnerId) || attempts >= 15) {
      clearInterval(interval);
      return;
    }
    // skip ticks where the iframe genuinely isn't ready yet
    if (el?.contentWindow) {
      sendHello(el);
      sendSessionTo(partnerId);
    }
    attempts++;
  }, 300);
}

// NEW — whenever session arrives/changes (e.g. resolved late from parent's
// fetchAndForwardSession), push it to every currently open modal that
// hasn't received it yet.
watch(
  () => [props.sessionUserId, props.sessionToken],
  () => {
    for (const m of props.modals) {
      sendSessionTo(m.partnerId);
    }
  },
);

function handleMessage(e: MessageEvent) {
  if (e.origin !== CHAT_ORIGIN) return;

  if (e.data?.type === "chat:ready") {
    const pid = Number(e.data.partnerId);
    sendHello(modalRefs.get(pid));
    sendSessionTo(pid); // NEW — modal signals it's ready, give it session immediately
  }
  if (e.data?.type === "chat:hello-ack") {
    ackedModals.add(Number(e.data.partnerId));
  }
  if (e.data?.type === "chat:close-modal") {
    const pid = Number(e.data.partnerId);
    if (fullscreenPartnerId.value === pid) fullscreenPartnerId.value = null;
    emit("close", pid);
    modalRefs.delete(pid);
    ackedModals.delete(pid);
    sessionSentTo.delete(pid);
  }
  if (e.data?.type === "chat:minimize-modal") {
    emit("minimize", Number(e.data.partnerId));
    ackedModals.delete(Number(e.data.partnerId));
  }
  if (e.data?.type === "chat:navigate") router.push(e.data.path);

  if (e.data?.type === "chat:call-start") {
    fullscreenPartnerId.value = Number(e.data.partnerId);
  }
  if (e.data?.type === "chat:call-end") {
    if (fullscreenPartnerId.value === Number(e.data.partnerId)) {
      fullscreenPartnerId.value = null;
    }
  }
}

onMounted(() => window.addEventListener("message", handleMessage));
onUnmounted(() => window.removeEventListener("message", handleMessage));
</script>

<style scoped>
.minimized-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
  padding: 6px 10px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  pointer-events: auto;
}
</style>
