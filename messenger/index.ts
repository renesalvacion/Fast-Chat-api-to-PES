import { defineStore } from 'pinia';
import type { OpenChat, IncomingCall } from './types';
import { throttle } from 'lodash';
import * as signalR from './signalr';
import { HubConnectionState } from '@microsoft/signalr';
import {
  viewMessages as apiViewMessages,
  sendMessage as apiSendMessage,
  deleteMessage as apiDeleteMessage,
  reactionMessage as apiReactionMessage,
  loadOlderMessages as apiLoadOlderMessages
} from '../messenger/messages';
import { HubConnection } from '@microsoft/signalr';
import * as call from './call';

export const useMessengerStore = defineStore('chat', {
  state: () => ({
    openChats: [] as OpenChat[],
    incomingCall: null as IncomingCall | null,
    connection: null as HubConnection | null,
    peer: null as RTCPeerConnection | null,
    localStream: null as MediaStream | null,
    remoteStream: null as MediaStream | null,
    inCall: false,
    currentCallUserId: null as number | null,
    currentCallId: null as number | null,
    showCallScreen: false,
    showIncomingCallModal: false,
    iceQueue: [] as RTCIceCandidateInit[],
    onlineUsers: new Map<number, boolean>(),
    userLastActive: new Map<number, number>(),
    callStartTime: null as number | null,
    callErrors: [] as string[],
    recientName: '',

    currentCallIsVideo: false,
    typingUsers: new Set<number>() as Set<number>,

    signalRStarted: false,
  }),

  getters: {
    apiUrl: () => useRuntimeConfig().public.chatApi,
    isUserOnline: (state) => (userId: number) => state.onlineUsers.has(userId),
    isUserActive: (state) => (userId: number) => {
      const last = state.userLastActive.get(userId);
      return last ? (Date.now() - last) < 5 * 60 * 1000 : false;
    }
  },

  actions: {
    getSessionId() {
      return Number(useAuthStore().user?.userId)
    },

    // Small helper: true only when the connection is actually ready to invoke.
    isConnectionReady() {
      return !!this.connection && this.connection.state === HubConnectionState.Connected;
    },

    // ---------- SIGNALR ----------
    initSignalR() { return signalR.initSignalR(this); },

    // ---------- CHAT LIFECYCLE (single source of truth) ----------
    // Any code path that needs to "open or reopen" a chat — clicking a
    // contact, receiving a message, or sending one — should go through
    // this. It guarantees:
    //   1. Only one chat object per partnerId ever exists (no duplicates
    //      from Number()/string partnerId mismatches — always coerces).
    //   2. isOpen/minimized are reset so the chat is actually visible.
    //   3. The chat is moved to the END of openChats, so
    //      enforceChatCapacity (which evicts from the FRONT) treats it
    //      as "most recently used" and evicts it last, not first.
    openOrTouchChat(partnerId: number, patch: Partial<OpenChat> = {}) {
      const pid = Number(partnerId);
      let chat = this.openChats.find(c => c.partnerId === pid);

      if (chat) {
        Object.assign(chat, { isOpen: true, minimized: false, ...patch });
        this.openChats = this.openChats.filter(c => c.partnerId !== pid);
        this.openChats.push(chat);
      } else {
        chat = {
          partnerId: pid,
          messages: [],
          isOpen: true,
          minimized: false,
          unread: 0,
          page: 1,
          total: 0,
          ...patch,
        } as OpenChat;
        this.openChats.push(chat);
      }

      return chat;
    },

    // ---------- MESSAGES ----------
    async viewMessagesPerson(userId: number, partnerId: number) {
      return apiViewMessages(this, userId, partnerId);
    },
    sendMessage(receiverId: number, content: string, files: File[]) {
      return apiSendMessage(this, receiverId, content, files);
    },
    deleteMessage(messageId: number) {
      return apiDeleteMessage(messageId);
    },
    reactionMessage(messageId: number, reactionType: number) {
      return apiReactionMessage(messageId, reactionType);
    },
    loadOlderMessages(partnerId: number, userId: number) {
      return apiLoadOlderMessages(this, partnerId, userId);
    },

    // ---------- CALL ----------
    startCall(partnerId: number, video = false, remoteVideoEl?: HTMLVideoElement | null) {
      return call.startCall(this, partnerId, video, remoteVideoEl);
    },
    acceptCall(offerPayload: { type: string; sdp: string; callId?: string }, partnerId: number, remoteVideoEl?: HTMLVideoElement) {
      return call.acceptCall(this, offerPayload, partnerId, remoteVideoEl);
    },
    rejectIncomingCall(fromUserId?: number | string) {
      return call.rejectIncomingCall(this, fromUserId);
    },
    cleanupCall() { return call.cleanupCall(this); },
    endCall() { return call.endCall(this); },
    getCallDurationInSeconds(): number {
      if (!this.callStartTime) return 0;
      return Math.floor((Date.now() - this.callStartTime) / 1000);
    },

closeChat(partnerId: number) {
  const pid = Number(partnerId);
  const chat = this.openChats.find(c => c.partnerId === pid);
  if (!chat) return;

  chat.isOpen = false;
  chat.minimized = false; // fully closed, not "minimized" — avoid stale state

  // Force a new array reference so every consumer (storeToRefs, watchers,
  // computed filters in the dashboard) is guaranteed to re-evaluate,
  // matching the same pattern used by openOrTouchChat/restoreChat.
  this.openChats = [...this.openChats];
},

    // Hide a chat window without closing it (keeps messages/unread intact)
    minimizeChat(partnerId: number) {
      const chat = this.openChats.find(c => c.partnerId === Number(partnerId));
      if (chat) chat.minimized = true;
    },

    // Bring a minimized chat back, and bump it to "most recent"
    // so it's the last one auto-minimized if space runs out again
    restoreChat(partnerId: number) {
      this.openOrTouchChat(partnerId);
    },

    // Given how many full chat windows can fit on screen,
    // minimize the oldest visible ones until we're within capacity
    enforceChatCapacity(maxVisible: number) {
      const visible = this.openChats.filter(c => c.isOpen && !c.minimized);
      const excess = visible.length - maxVisible;
      if (excess > 0) {
        for (let i = 0; i < excess; i++) {
          visible[i].minimized = true;
        }
      }
    },

    // ---------- ACTIVITY TRACKING ----------
    updateMyActivity: throttle(function (this: any) {
      const myId = this.getSessionId();
      const now = Date.now();
      this.userLastActive.set(myId, now);

      if (!this.isConnectionReady()) return;

      this.connection.invoke('UpdateActivity', myId).catch((err: any) => {
        console.warn('UpdateActivity failed:', err);
      });
    }, 5000),

    initActivityTracking() {
      const events = ['mousemove', 'keydown', 'click', 'touchstart'];
      events.forEach(e =>
        window.addEventListener(e, () => this.updateMyActivity())
      );

      setInterval(() => this.updateMyActivity(), 30000);
    },
  }
});