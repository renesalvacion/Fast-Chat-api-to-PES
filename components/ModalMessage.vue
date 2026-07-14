<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style="background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px)"
        @click.self="close"
      >
        <div
          class="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <!-- ── Timer progress bar (top edge of card) ── -->
          <div
            v-if="autoClose && timer > 0"
            class="relative h-1 w-full bg-slate-100"
          >
            <div
              class="absolute inset-y-0 left-0"
              :style="{
                width: progressWidth,
                background: headerGradient,
                transition: barReady ? `width ${timer}ms linear` : 'none',
              }"
            />
          </div>

          <!-- Header -->
          <div
            class="px-6 py-5 flex items-center gap-4"
            :style="{ background: headerGradient }"
          >
            <div
              class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"
            >
              <slot name="header-icon">
                <svg
                  class="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </slot>
            </div>
            <div class="flex-1">
              <h3 class="text-white font-bold text-sm">{{ title }}</h3>
              <p v-if="subtitle" class="text-white/60 text-xs mt-0.5">
                {{ subtitle }}
              </p>
            </div>

            <!-- Close button: shows countdown ring when autoClose is on -->
            <button
              @click="close"
              class="cursor-pointer relative w-7 h-7 flex items-center justify-center flex-shrink-0"
            >
              <!-- Countdown SVG ring -->
              <svg
                v-if="autoClose && timer > 0"
                class="absolute inset-0 w-7 h-7 -rotate-90"
                viewBox="0 0 28 28"
              >
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  stroke-width="2"
                />
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  fill="none"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="dashOffset"
                  style="transition: stroke-dashoffset 1s linear"
                />
              </svg>
              <!-- Plain rounded bg when no timer -->
              <div
                v-if="!autoClose || timer === 0"
                class="absolute inset-0 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
              />
              <!-- X icon -->
              <svg
                class="relative z-10 w-3 h-3 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 text-center">
            <!-- Icon block -->
            <div class="relative w-16 h-16 mx-auto mb-4">
              <div
                class="w-16 h-16 rounded-2xl flex items-center justify-center icon-bounce"
                :class="iconBgClass"
              >
                <slot name="body-icon">
                  <svg
                    class="w-8 h-8"
                    :class="iconColorClass"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </slot>
              </div>
              <div
                class="absolute inset-0 rounded-2xl opacity-40 animate-ping"
                :class="pingClass"
              />
            </div>

            <!-- Badge -->
            <div
              v-if="badge"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
              style="
                background: rgba(37, 99, 235, 0.08);
                border: 1px solid rgba(37, 99, 235, 0.15);
              "
            >
              <slot name="badge-icon">
                <svg
                  class="w-3 h-3 text-blue-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </slot>
              <span class="text-xs font-semibold text-blue-600">{{
                badge
              }}</span>
            </div>

            <!-- Message -->
            <slot name="message">
              <p class="text-slate-700 font-semibold text-sm mb-1.5">
                {{ message }}
              </p>
            </slot>
            <p
              v-if="description"
              class="text-slate-400 text-xs leading-relaxed px-2"
            >
              {{ description }}
            </p>

            <!-- "Closing in Xs" countdown label -->
            <p
              v-if="autoClose && timer > 0 && showCountdownLabel"
              class="text-[11px] text-slate-300 mt-3"
            >
              Closing in {{ secondsLeft }}s
            </p>

            <slot name="body" />
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 flex gap-2">
            <button
              v-if="showDismiss"
              @click="close"
              class="cursor-pointer flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {{ dismissLabel }}
            </button>
            <button
              v-if="showConfirm"
              @click="confirm"
              :disabled="loading"
              class="cursor-pointer flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl text-white transition-all hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-70"
              :class="confirmButtonClass"
              :style="!confirmButtonClass ? { background: headerGradient } : {}"
            >
              <svg
                v-if="loading"
                class="w-3.5 h-3.5 spinner"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              {{ loading ? loadingLabel : confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;

    // Header
    title?: string;
    subtitle?: string;
    headerGradient?: string;

    // Body icon
    iconBgClass?: string;
    iconColorClass?: string;
    pingClass?: string;

    // Badge
    badge?: string;

    // Message
    message?: string;
    description?: string;

    // Footer
    showDismiss?: boolean;
    showConfirm?: boolean;
    dismissLabel?: string;
    confirmLabel?: string;
    confirmButtonClass?: string;

    // Loading state
    loading?: boolean;
    loadingLabel?: string;

    // Auto-close
    autoClose?: boolean; // enable auto-dismiss
    timer?: number; // ms until auto-close  (default 5000)
    showCountdownLabel?: boolean; // show "Closing in Xs" text
  }>(),
  {
    title: "Notification",
    headerGradient:
      "linear-gradient(120deg,#1d4ed8 0%,#6d28d9 55%,#9f1239 100%)",
    iconBgClass: "bg-green-50",
    iconColorClass: "text-green-600",
    pingClass: "bg-green-200",
    showDismiss: true,
    showConfirm: true,
    dismissLabel: "Dismiss",
    confirmLabel: "Got it",
    loading: false,
    loadingLabel: "Please wait…",
    autoClose: false,
    timer: 5000,
    showCountdownLabel: true,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: false): void;
  (e: "confirm"): void;
  (e: "dismiss"): void;
  (e: "timeout"): void;
}>();

// ── Progress bar ──────────────────────────────────────────────────────────────
// barReady gates the CSS transition so the bar always starts visually at 100%
// before sliding to 0%.  Without this, when a second notification opens the
// browser reuses the same DOM node and never sees a width change to animate.
const progressWidth = ref("100%");
const barReady = ref(false);

// ── Countdown ring ────────────────────────────────────────────────────────────
const radius = 11;
const circumference = +(2 * Math.PI * radius).toFixed(2); // ≈ 69.12
const secondsLeft = ref(0);
const dashOffset = computed(() => {
  const total = props.timer / 1000;
  const fraction = secondsLeft.value / total;
  return circumference * (1 - fraction);
});

// ── Timer state ───────────────────────────────────────────────────────────────
let closeTimeout: ReturnType<typeof setTimeout> | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;

function clearAll() {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function startTimer() {
  if (!props.autoClose || props.timer <= 0) return;

  secondsLeft.value = Math.ceil(props.timer / 1000);

  // Step 1 — disable transition and snap to 100% (paint frame 1)
  barReady.value = false;
  progressWidth.value = "100%";

  // Step 2 — after the browser paints 100%, enable transition and go to 0%
  // Two nextTicks ensure the first frame (100%, no transition) is committed
  // before the second frame (0%, with transition) starts animating.
  nextTick(() => {
    nextTick(() => {
      barReady.value = true;
      progressWidth.value = "0%";
    });
  });

  // Tick the seconds label every second
  tickInterval = setInterval(() => {
    secondsLeft.value = Math.max(0, secondsLeft.value - 1);
  }, 1000);

  // Auto-close after full duration
  closeTimeout = setTimeout(() => {
    clearAll();
    emit("update:modelValue", false);
    emit("timeout");
  }, props.timer);
}

function resetTimer() {
  clearAll();
  barReady.value = false;
  progressWidth.value = "100%";
  secondsLeft.value = 0;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetTimer();
      nextTick(startTimer);
    } else {
      resetTimer();
    }
  },
  { immediate: true },
);

onBeforeUnmount(clearAll);

// ── Button actions ────────────────────────────────────────────────────────────
function close() {
  resetTimer();
  emit("update:modelValue", false);
  emit("dismiss");
}

function confirm() {
  if (props.loading) return;
  resetTimer();
  emit("update:modelValue", false);
  emit("confirm");
}
</script>

<style scoped>
/* ── Modal backdrop + card entrance ──────────────────────────────────────── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-card {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease;
}
.modal-enter-from .modal-card {
  transform: scale(0.85) translateY(32px);
  opacity: 0;
}

/* ── Icon pop-in ─────────────────────────────────────────────────────────── */
.icon-bounce {
  animation: iconPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s both;
}
@keyframes iconPop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* ── Ping ring ───────────────────────────────────────────────────────────── */
.animate-ping {
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* ── Confirm button spinner ──────────────────────────────────────────────── */
.spinner {
  animation: spin 0.75s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
