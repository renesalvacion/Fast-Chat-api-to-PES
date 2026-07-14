<!-- ─── components/OwnerSearchList.vue ───────────────────────────────────────
     Reusable search bar + draggable owner/proxy row list.
     Used by both the Add Approver modal and the Edit Approver modal.

     Props
     ──────
     modelValue       – the current owners array (v-model)
     approverTypeData – [{id, name}] list for the role <select>
     placeholder      – optional search input placeholder text
     emptyLabel       – "No approvers assigned yet" / "No proxy assigned yet"
     emptySubLabel    – sub-text shown in the empty state
     showDragHint     – whether to show the "↕ Drag to reorder" hint (default true)
-->

<template>
  <div class="space-y-3 w-full">
    <!-- Search bar -->
    <div class="relative" ref="searchContainer">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors"
        :class="isSearching ? 'text-blue-400' : 'text-slate-400'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
      </svg>

      <span
        v-if="isSearching"
        class="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
      />

      <input
        v-model="searchQuery"
        @input="onSearch"
        @focus="showDropdown = true"
        @keydown.escape="showDropdown = false"
        type="text"
        :placeholder="placeholder"
        class="font-bold w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
      />

      <!-- Dropdown -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 -translate-y-1 scale-95"
      >
        <div
          v-if="showDropdown && (searchResults.length || noResults)"
          class="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
        >
          <div v-if="noResults" class="px-4 py-5 text-center">
            <p class="text-sm text-slate-400">
              No users found for "{{ searchQuery }}"
            </p>
          </div>
          <ul v-else class="max-h-52 overflow-y-auto divide-y divide-slate-50">
            <li
              v-for="user in searchResults"
              :key="user.userid"
              class="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer group transition"
              @mousedown.prevent="handleAdd(user)"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  :style="{ background: avatarGradient(user.name) }"
                >
                  {{ user.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-700">
                    {{ user.name }}
                  </p>
                  <p class="text-xs text-slate-400">{{ user.email }}</p>
                </div>
              </div>
              <span
                v-if="isAlreadyOwner(user.userid)"
                class="text-xs text-slate-400 italic"
                >Added</span
              >
              <button
                v-else
                class="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition px-2 py-1 rounded-lg bg-blue-50"
              >
                + Add
              </button>
            </li>
          </ul>
        </div>
      </transition>
    </div>

    <!-- Owner rows -->
    <div class="space-y-2" ref="ownerListRef">
      <div
        v-for="(owner, index) in modelValue"
        :key="owner.userId ?? owner.userName"
        class="owner-row flex items-center px-4 py-3 rounded-xl border group select-none"
        :class="[
          isTouchDevice
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing',
          dragOverIndex === index && draggingIndex !== index
            ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-slate-300',
          draggingIndex === index ? 'opacity-40 shadow-lg' : 'opacity-100',
        ]"
        style="
          transition:
            transform 0.15s,
            opacity 0.15s,
            border-color 0.15s;
        "
        :draggable="!isTouchDevice"
        @dragstart="onDragStart(index)"
        @dragover.prevent="onDragOver(index)"
        @dragend="onDragEnd"
      >
        <!-- Drag handle -->
        <div
          class="mr-3 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors hidden sm:flex"
          @touchstart.prevent="onTouchStart($event, index)"
          @touchmove.prevent="onTouchMove($event)"
          @touchend.prevent="onTouchEnd"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>

        <!-- Sort badge -->
        <div
          class="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 mr-3 transition-all"
        >
          {{ owner.sort }}
        </div>

        <!-- Avatar -->
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mr-3"
          :style="{ background: avatarGradient(owner.userName) }"
        >
          {{ owner.userName.charAt(0).toUpperCase() }}
        </div>

        <!-- Name + status -->
        <div class="flex-1 min-w-0 mr-3">
          <p class="text-sm font-semibold text-slate-700 truncate">
            {{ owner.userName }}
          </p>
          <span
            class="text-xs font-medium px-1.5 py-0.5 rounded-md"
            :class="
              owner.status === 1
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500'
            "
          >
            {{ owner.status === 1 ? "Active" : "Inactive" }}
          </span>
        </div>

        <!-- Role select -->
        <div class="flex-shrink-0 mr-2" @dragstart.stop @touchstart.stop>
          <select
            v-model="owner.approverType"
            class="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 transition-colors cursor-pointer"
            :class="
              !owner.approverType
                ? 'border-rose-300 bg-rose-50 text-rose-400'
                : ''
            "
            @click.stop
          >
            <option :value="null" disabled>Role</option>
            <option
              v-for="item in approverTypeData"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </div>

        <!-- Desktop remove -->
        <button
          @click.stop="emit('remove', index)"
          @dragstart.stop
          @touchstart.stop
          class="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition flex-shrink-0 ml-1 cursor-pointer"
        >
          <svg
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
          Remove
        </button>

        <!-- Mobile remove -->
        <button
          @click.stop="emit('remove', index)"
          @touchstart.stop
          class="sm:hidden flex-shrink-0 ml-1 w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 active:scale-95 transition cursor-pointer"
          title="Remove"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="!modelValue.length"
        class="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50"
      >
        <svg
          class="w-8 h-8 text-slate-300 mb-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p class="text-sm text-slate-400">{{ emptyLabel }}</p>
        <p class="text-xs text-slate-300 mt-0.5">{{ emptySubLabel }}</p>
      </div>
    </div>

    <!-- Drag hint -->
    <template v-if="showDragHint && modelValue.length > 1">
      <p class="hidden sm:block text-xs text-slate-400 text-center">
        ↕ Drag any row to reorder
      </p>
      <p class="sm:hidden text-xs text-slate-400 text-center">
        ↕ Hold and drag to reorder
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { avatarGradient } from "~/utils/approverHelpers";
import { useOwnerSearch } from "~/composables/useOwnerSearch";
import { ref, onMounted } from "vue";
import type { OwnerRow } from "~/composables/useOwnerList";

// ── Props & emits ─────────────────────────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    modelValue: OwnerRow[];
    approverTypeData: { id: number; name: string }[];
    placeholder?: string;
    emptyLabel?: string;
    emptySubLabel?: string;
    showDragHint?: boolean;
  }>(),
  {
    placeholder: "Search users…",
    emptyLabel: "No approvers assigned yet",
    emptySubLabel: "Search above to add approvers",
    showDragHint: true,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: OwnerRow[]): void;
  (e: "remove", index: number): void;
}>();

// ── Touch device detection ────────────────────────────────────────────────────
const isTouchDevice = ref(false);
onMounted(() => {
  isTouchDevice.value = window.matchMedia("(pointer: coarse)").matches;
});

// ── Drag state ────────────────────────────────────────────────────────────────
const draggingIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const ownerListRef = ref<HTMLElement | null>(null);

function reorder(fromIndex: number, toIndex: number) {
  const items = [...props.modelValue];
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  items.forEach((o, i) => (o.sort = i + 1));
  emit("update:modelValue", items);
}

function onDragStart(index: number) {
  draggingIndex.value = index;
}
function onDragOver(index: number) {
  if (draggingIndex.value === null || draggingIndex.value === index) return;
  dragOverIndex.value = index;
  reorder(draggingIndex.value, index);
  draggingIndex.value = index;
}
function onDragEnd() {
  draggingIndex.value = null;
  dragOverIndex.value = null;
}

let touchDraggingIndex: number | null = null;
function onTouchStart(e: TouchEvent, index: number) {
  touchDraggingIndex = index;
  draggingIndex.value = index;
}
function onTouchMove(e: TouchEvent) {
  if (touchDraggingIndex === null || !ownerListRef.value) return;
  const touchY = e.touches[0].clientY;
  ownerListRef.value
    .querySelectorAll<HTMLElement>(".owner-row")
    .forEach((row, i) => {
      const rect = row.getBoundingClientRect();
      if (
        touchY >= rect.top &&
        touchY <= rect.bottom &&
        i !== touchDraggingIndex
      ) {
        dragOverIndex.value = i;
        reorder(touchDraggingIndex!, i);
        touchDraggingIndex = i;
        draggingIndex.value = i;
      }
    });
}
function onTouchEnd() {
  draggingIndex.value = null;
  dragOverIndex.value = null;
  touchDraggingIndex = null;
}

// ── Search ────────────────────────────────────────────────────────────────────
function isAlreadyOwner(userId: number) {
  return props.modelValue.some((o) => o.userId === userId);
}

const {
  searchQuery,
  showDropdown,
  isSearching,
  noResults,
  searchResults,
  searchContainer,
  onSearch,
  clearSearch,
} = useOwnerSearch(isAlreadyOwner);

function handleAdd(user: { userid: number; name: string; email: string }) {
  if (isAlreadyOwner(user.userid)) return;
  const updated = [
    ...props.modelValue,
    {
      userId: user.userid,
      userName: user.name,
      sort: props.modelValue.length + 1,
      status: 1,
      approverType: null,
    },
  ];
  emit("update:modelValue", updated);
  clearSearch();
}
</script>
