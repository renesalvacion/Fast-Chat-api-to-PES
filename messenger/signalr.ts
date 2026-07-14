import * as signalR from '@microsoft/signalr';
import type { SdpDto, IceCandidateDto } from './types';
import type { useMessengerStore } from './index'

export async function initSignalR(store: ReturnType<typeof useMessengerStore>) {
  // Use the store's own reactive flag, not a module-local variable —
  // a module-local `let` doesn't reflect per-store/session state and
  // meant this guard was always false, causing needless reconnects.
  if (store.signalRStarted && store.connection?.state === signalR.HubConnectionState.Connected) return

  store.signalRStarted = true

  if (store.connection) {
    try { await store.connection.stop() } catch {}
    store.connection = null
  }

  store.connection = new signalR.HubConnectionBuilder()
    .withUrl(`${store.apiUrl}/hubs/messenger`, { withCredentials: true })
    .withAutomaticReconnect()
    .build()

  setupMessageEvents(store)
  setupCallEvents(store)
  setupStatusEvents(store)

  await store.connection.start()
}

function setupMessageEvents(store: ReturnType<typeof useMessengerStore>) {
  store.connection?.on('ReceiveMessage', (msg: any) => {
    const normalized = {
      id: msg.id,
      senderId: msg.senderId ?? msg.senderid,
      recipientId: msg.recipientId ?? msg.recipientid,
      content: msg.content,
      createdAt: msg.createdAt ?? msg.createdat,
      attachments: msg.attachments ?? []
    }

    if (normalized.senderId === store.getSessionId()) return

    const partnerId = Number(normalized.senderId)
    let chat = store.openChats.find(c => c.partnerId === partnerId)
    const wasVisible = !!chat && chat.isOpen && !chat.minimized

    if (!chat) {
      chat = {
        partnerId,
        messages: [],
        isOpen: true,
        minimized: false,   // new incoming chat → tab, not a popped-open window
        unread: 1,
        page: 1,
        total: 1
      }
      store.openChats.push(chat)
    } else if (!chat.isOpen) {
      // was closed → reopen as a tab so it's visible again
      chat.isOpen = true
      chat.minimized = false
    }
    // if chat.isOpen was already true (open window OR minimized tab),
    // leave isOpen/minimized exactly as-is — don't steal focus

    const exists = chat.messages.some((m: any) => m.id === normalized.id)
    if (!exists) {
      chat.messages = [...chat.messages, normalized]
      if (!wasVisible) chat.unread++
    }
  })
}

function setupCallEvents(store: ReturnType<typeof useMessengerStore>) {
  // Buffer for offer that arrives before IncomingCall
  let pendingOffer: { type: string; sdp: string } | null = null

  store.connection?.on('IncomingCall', (fromUserId: number, video: boolean, callId: number) => {
    store.incomingCall = {
      fromUserId,
      video,
      callId,
      offer: pendingOffer ?? { type: '', sdp: '' }
    }
    store.showIncomingCallModal = true

    if (pendingOffer) {
      pendingOffer = null
    }
  })

  store.connection?.on('ReceiveOffer', (offer: any, fromUserId: number) => {
    const offerPayload = {
      type: offer.Type ?? offer.type ?? 'offer',
      sdp: offer.Sdp ?? offer.sdp ?? ''
    }

    if (!offerPayload.sdp) {
      console.error('❌ SDP is empty after parsing — check server serialization')
      return
    }

    if (store.incomingCall) {
      store.incomingCall = { ...store.incomingCall, offer: offerPayload }
    } else {
      pendingOffer = offerPayload
    }
  })

  store.connection?.on('ReceiveAnswer', async (answer: any) => {
    if (!store.peer) return

    const normalized = {
      type: (answer?.Type ?? answer?.type ?? '').toString().toLowerCase() as RTCSdpType,
      sdp: (answer?.Sdp ?? answer?.sdp ?? '').toString()
    }

    if (!normalized.type || !normalized.sdp) {
      return
    }

    try {
      await store.peer.setRemoteDescription(new RTCSessionDescription(normalized))
      for (const candidate of store.iceQueue ?? []) {
        await store.peer.addIceCandidate(new RTCIceCandidate(candidate))
      }
      store.iceQueue = []
    } catch (err) {
      console.error('❌ ReceiveAnswer error:', err, normalized)
    }
  })

  store.connection?.on('ReceiveIce', async (candidate: IceCandidateDto) => {
    const rtcCandidate: RTCIceCandidateInit = {
      candidate: candidate.Candidate,
      sdpMid: candidate.SdpMid ?? undefined,
      sdpMLineIndex: candidate.SdpMLineIndex ?? undefined
    }

    if (!rtcCandidate.sdpMid && (rtcCandidate.sdpMLineIndex === undefined || rtcCandidate.sdpMLineIndex === null)) {
      console.warn('🧊 ReceiveIce: skipping invalid ICE candidate (missing sdpMid and sdpMLineIndex)')
      return
    }
    if (!store.peer || !store.peer.remoteDescription) {
      store.iceQueue = [...(store.iceQueue ?? []), rtcCandidate]
      return
    }
    try {
      await store.peer.addIceCandidate(new RTCIceCandidate(rtcCandidate))
    } catch (err) {
      console.error('❌ addIceCandidate error:', err)
    }
  })

  store.connection?.on('CallEnded', (callId: number, durationInSeconds: number, endedAt: string) => {
    pendingOffer = null
    store.cleanupCall()
  })

  store.connection?.on('CallRejected', () => {
    pendingOffer = null
    alert('Call was declined.')
    store.cleanupCall()
  })

  store.connection?.on('CallHungUp', (fromUserId: string) => {
    pendingOffer = null
    store.cleanupCall()
  })

  store.connection?.on('UserTyping', (fromUserId: number) => {
    store.typingUsers = new Set([...store.typingUsers, fromUserId])
  })

  store.connection?.on('UserStoppedTyping', (fromUserId: number) => {
    const updated = new Set(store.typingUsers)
    updated.delete(fromUserId)
    store.typingUsers = updated
  })
}

function setupStatusEvents(store: ReturnType<typeof useMessengerStore>) {
  store.connection?.on('OnlineUsersList', (ids: number[]) => {
    const online = new Map<number, boolean>()
    const activity = new Map<number, number>()
    ids.forEach(id => {
      online.set(Number(id), true)
      activity.set(Number(id), Date.now())
    })
    store.onlineUsers = online
    store.userLastActive = activity
  })

  store.connection?.on('UserOnline', (id: number) => {
    const online = new Map(store.onlineUsers)
    online.set(Number(id), true)
    store.onlineUsers = online

    const activity = new Map(store.userLastActive)
    activity.set(Number(id), Date.now())
    store.userLastActive = activity
  })

  store.connection?.on('UserOffline', (id: number) => {
    const online = new Map(store.onlineUsers)
    online.delete(Number(id))
    store.onlineUsers = online
  })

  store.connection?.on('UserActive', (id: number) => {
    const activity = new Map(store.userLastActive)
    activity.set(Number(id), Date.now())
    store.userLastActive = activity
  })
}

export async function ensureSignalRConnection(
  store: ReturnType<typeof useMessengerStore>,
  force = false
) {
  if (force && store.connection) {
    try { await store.connection.stop() } catch {}
    store.connection = null
    store.signalRStarted = false
  }

  if (!store.connection || store.connection.state !== signalR.HubConnectionState.Connected) {
    await store.initSignalR()
  }
}