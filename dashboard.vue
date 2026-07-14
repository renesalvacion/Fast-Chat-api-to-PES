<template>
  <div class=":min-h-screen bg-slate-50 font-poppins flex">
    <!-- Sidebar: Users List / Messenger -->
    <div
      class="minimizeUser"
      style="width: 100%; display: flex; justify-content: flex-end"
    >
      <aside
        :class="[
          'fixed bottom-4 right-4 z-50 flex flex-col bg-white border border-gray-200 shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden',
          isOpen ? 'h-[480px] w-80' : 'h-14 w-14',
        ]"
      >
        <!-- Header / Toggle Button -->
        <div
          class="flex items-center justify-between bg-blue-600 px-4 py-3 flex-shrink-0 cursor-pointer"
          @click="!isOpen && (isOpen = true)"
        >
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-white flex-shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
              />
            </svg>
            <h2 v-if="isOpen" class="text-sm font-semibold text-white">
              Chats
            </h2>
          </div>

          <button
            v-if="isOpen"
            @click.stop="isOpen = false"
            class="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-500 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        <!-- Search -->
        <div v-if="isOpen" class="p-3 border-b border-gray-100 flex-shrink-0">
          <div
            class="flex items-center bg-gray-100 rounded-full px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-gray-500 mr-2 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search Messenger"
              class="bg-transparent flex-1 text-sm outline-none"
              @keyup.enter="performSearch"
            />
            <div
              v-if="isSearching"
              class="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin flex-shrink-0"
            ></div>
          </div>
        </div>

        <!-- Recent Chats (shown only when NOT searching) -->
        <div
          v-if="isOpen && !searchQuery.trim()"
          class="flex-1 overflow-y-auto"
        >
          <div
            v-if="authStore.isLoadingChatHistory"
            class="flex justify-center py-6"
          >
            <div
              class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
            ></div>
          </div>

          <ul
            v-else-if="authStore.chatHistory.length"
            class="px-2 py-2 space-y-1"
          >
            <li
              v-for="chat in authStore.chatHistory"
              :key="chat.userId"
              @click="viewMessage(chat.userId)"
              class="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition hover:bg-gray-100"
            >
              <!-- Avatar -->
              <div class="relative flex-shrink-0">
                <div
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm"
                >
                  {{ (chat.name || "?").charAt(0).toUpperCase() }}
                </div>
                <span
                  class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
                  :class="
                    messengerStore.isUserOnline(chat.userId)
                      ? messengerStore.isUserActive(chat.userId)
                        ? 'bg-green-500'
                        : 'bg-yellow-400'
                      : 'bg-gray-400'
                  "
                ></span>
              </div>

              <!-- Name + last message preview -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">
                  {{ chat.name || "Unknown" }}
                </p>
                <p class="text-xs text-gray-500 truncate">
                  <span v-if="chat.hasAttachment">📎 </span
                  >{{ chat.lastMessage }}
                </p>
              </div>

              <!-- Timestamp -->
              <span class="text-[10px] text-gray-400 flex-shrink-0">
                {{ formatChatTime(chat.lastMessageAt) }}
              </span>
            </li>
          </ul>

          <p v-else class="text-xs text-gray-400 text-center py-6">
            No recent chats
          </p>
        </div>

        <!-- Users List (shown only WHILE searching) -->
        <div v-if="isOpen && searchQuery.trim()" class="flex-1 overflow-y-auto">
          <!-- No results state -->
          <div
            v-if="!isSearching && authStore.isNoPeople"
            class="flex flex-col items-center justify-center text-gray-400 gap-2 py-10 px-4 text-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-10 h-10 text-gray-200"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
            <p class="text-xs font-medium text-gray-400">
              {{ authStore.message || "No users found" }}
            </p>
          </div>

          <ul v-else class="px-2 py-2 space-y-1">
            <li
              v-for="user in displayedPeople"
              :key="user.userid ?? user.userId"
              @click="viewMessage(user.userid ?? user.userId)"
              class="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition hover:bg-gray-100"
            >
              <!-- Avatar -->
              <div class="relative flex-shrink-0">
                <div
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm"
                >
                  {{
                    (user.fullname || user.name || "?").charAt(0).toUpperCase()
                  }}
                </div>
                <!-- Online Status -->
                <span
                  class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
                  :class="
                    messengerStore.isUserOnline(user.userid ?? user.userId)
                      ? messengerStore.isUserActive(user.userid ?? user.userId)
                        ? 'bg-green-500'
                        : 'bg-yellow-400'
                      : 'bg-gray-400'
                  "
                ></span>
              </div>
              <!-- Name -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">
                  {{ user.fullname || user.name || "Unknown" }}
                </p>
                <p class="text-xs text-gray-500 truncate">Tap to chat</p>
              </div>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <!-- Chat stack: minimized tabs (if any) sit directly above the open chat
         windows via flexbox. No guessed pixel offsets — flexbox naturally
         collapses the gap when there's nothing below, so the tabs sit right
         at the bottom when no chat is open, and lift up cleanly when one is. -->
    <div
      class="fixed bottom-0 z-40 flex flex-col items-end gap-2 max-w-full transition-all duration-300"
      :style="`right: ${isOpen ? '22rem' : '5rem'};`"
    >
      <!-- Minimized tabs -->
      <div
        v-if="openChats.some((c) => c.isOpen && c.minimized)"
        class="flex flex-row-reverse gap-2 px-2"
      >
        <button
          v-for="chat in openChats.filter((c) => c.isOpen && c.minimized)"
          :key="chat.partnerId"
          @click="onRestoreChat(chat.partnerId)"
          :title="partnerName(chat.partnerId)"
          class="flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full pl-1 pr-1.5 py-1.5 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <div
            class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
          >
            {{ partnerName(chat.partnerId).charAt(0).toUpperCase() }}
          </div>
          <span
            class="text-xs font-medium text-slate-700 max-w-[100px] truncate"
          >
            {{ partnerName(chat.partnerId) }}
          </span>
          <span
            v-if="chat.unread"
            class="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"
          ></span>
          <span
            @click.stop="messengerStore.closeChat(chat.partnerId)"
            title="Close"
            class="w-4 h-4 rounded-full flex items-center justify-center cursor-pointer text-slate-400 hover:bg-red-100 hover:text-red-600 flex-shrink-0 transition-colors"
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
          </span>
        </button>
      </div>

      <!-- Full chat windows (only what fits on screen) -->
      <div
        ref="chatRailEl"
        class="flex flex-row-reverse items-end gap-3 overflow-x-auto max-w-full px-2"
      >
        <MessengerModal
          v-for="(chat, index) in openChats.filter(
            (c) => c.isOpen && !c.minimized,
          )"
          :key="chat.partnerId"
          :chat="chat"
          :index="index"
          @close="messengerStore.closeChat"
          @minimize="messengerStore.minimizeChat"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "~/stores/auth";
import { storeToRefs } from "#imports";
import { useMessengerStore } from "~/stores/messenger";
import MessengerModal from "~/components/MessengerModal.vue";

const authStore = useAuthStore();

const people = ref<any[]>([]);
const isOpen = ref(true);
const searchQuery = ref("");
const isSearching = ref(false);
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const messengerStore = useMessengerStore();
const { openChats } = storeToRefs(messengerStore);

const partnerName = (partnerId: number) => {
  const p = people.value.find(
    (u: any) => u.userid === partnerId || u.id === partnerId,
  );
  return p?.fullname || "Unknown";
};

// The list actually rendered in the sidebar while searching.
const displayedPeople = computed(() => {
  return authStore.searchPeopleData;
});

const performSearch = async () => {
  const q = searchQuery.value.trim();
  if (!q) {
    authStore.searchPeopleData = [];
    authStore.isNoPeople = false;
    return;
  }
  isSearching.value = true;
  try {
    await authStore.searchPeople(q);
  } finally {
    isSearching.value = false;
  }
};

// Debounced live search as the user types, in addition to Enter-to-search
watch(searchQuery, (val) => {
  if (searchDebounceTimer.value) clearTimeout(searchDebounceTimer.value);

  const q = val.trim();
  if (!q) {
    authStore.searchPeopleData = [];
    authStore.isNoPeople = false;
    return;
  }

  searchDebounceTimer.value = setTimeout(() => {
    performSearch();
  }, 350);
});

const viewMessage = async (partnerId: number) => {
  if (!authStore.user?.userId) {
    await authStore.fetchSession();
  }
  const userId = authStore.user?.userId;
  if (!userId) return;

  await messengerStore.viewMessagesPerson(Number(userId), Number(partnerId));

  await nextTick();
  recalcCapacity();
};

const onRestoreChat = (partnerId: number) => {
  messengerStore.restoreChat(partnerId);
  recalcCapacity();
};

onMounted(async () => {
  await authStore.fethItPeople();
  people.value = authStore.peopleData;

  await messengerStore.initSignalR();
});

onMounted(async () => {
  if (authStore.user?.userId) {
    await authStore.fetchChatHistory(authStore.user.userId);
  }
});

// ── Responsive chat capacity ─────────────────────────────
const chatRailEl = ref<HTMLElement | null>(null);
const windowWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 1280,
);

const sidebarReserved = computed(() => (isOpen.value ? 320 + 16 : 56 + 16));
const CHAT_WIDTH = 396;
const GUTTER = 24;

const maxVisibleChats = computed(() => {
  const available = windowWidth.value - sidebarReserved.value - GUTTER;
  return Math.max(1, Math.floor(available / CHAT_WIDTH));
});

const recalcCapacity = () => {
  windowWidth.value = window.innerWidth;
  messengerStore.enforceChatCapacity(maxVisibleChats.value);
};

onMounted(() => {
  window.addEventListener("resize", recalcCapacity);
  recalcCapacity();
});
onUnmounted(() => {
  window.removeEventListener("resize", recalcCapacity);
  if (searchDebounceTimer.value) clearTimeout(searchDebounceTimer.value);
});

watch(
  () =>
    openChats.value
      .map((c) => `${c.partnerId}:${c.isOpen}:${c.minimized}`)
      .join(",") + `|${isOpen.value}`,
  () => recalcCapacity(),
);

function formatChatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return diffDay < 7 ? `${diffDay}d` : date.toLocaleDateString();
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap");
.font-poppins {
  font-family: "Poppins", sans-serif;
}
</style>
