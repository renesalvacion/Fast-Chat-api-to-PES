import type { useMessengerStore } from './index'
import type { IceCandidateDto, SdpDto } from './types'
import * as signalR from '@microsoft/signalr'

export async function startCall(
  store: ReturnType<typeof useMessengerStore>,
  partnerId: number,
  video = false,
  remoteVideoEl?: HTMLVideoElement | null
) {
  //console.group('📞 startCall')
  //console.log('Partner ID:', partnerId, 'Video enabled:', video, typeof video)

  if (store.inCall) {
    //console.warn('Already in a call')
    //console.groupEnd()
    return
  }

  if (!store.connection) {
    await store.initSignalR()
    if (!store.connection) {
      //console.error('SignalR not initialized')
      //console.groupEnd()
      return
    }
  }

  if (!partnerId || isNaN(Number(partnerId))) {
    //console.error('❌ Invalid partnerId, cannot start call')
    logCallError(store, 'Invalid partnerId: ' + partnerId)
    //console.groupEnd()
    return
  }

  try {
    // 0️⃣ Start call on server — explicitly cast video to boolean
    let callId: number | null = null
    try {
      const isVideo = video === true // ✅ ensure strict boolean, not truthy
      //console.log('🎥 Invoking StartCall with video:', isVideo)
      callId = await store.connection!.invoke<number>('StartCall', Number(partnerId), isVideo)
      store.currentCallId = callId
      store.currentCallIsVideo = isVideo // ✅ set on store for CallScreen UI
      store.callStartTime = Date.now()
      //console.log('✅ Call created with id', callId)
    } catch (err: any) {
      const serverError = err?.message ?? JSON.stringify(err)
      logCallError(store, 'StartCall HubException: ' + serverError)
      //console.error('❌ startCall failed (server error):', serverError)
      alert('Cannot start call: ' + serverError)
      //console.groupEnd()
      return
    }

    // 1️⃣ Get local media
    store.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: store.currentCallIsVideo
    })
    //console.log('Local media acquired:', store.localStream.getTracks().map(t => t.kind))

    // 2️⃣ Create remote stream
    store.remoteStream = new MediaStream()

    // 3️⃣ Create peer connection
    store.peer = new RTCPeerConnection({
      sdpSemantics: 'unified-plan',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    } as RTCConfiguration)

    // 4️⃣ Add local tracks
    store.localStream.getTracks().forEach(track => {
      store.peer!.addTrack(track, store.localStream!)
    })
    //console.log('Senders after addTrack:', store.peer.getSenders().map(s => s.track?.kind))

    // 5️⃣ Handle remote tracks
    store.peer.ontrack = (event) => {
      if (!store.remoteStream) store.remoteStream = new MediaStream()
      store.remoteStream.addTrack(event.track)
      // ✅ Reassign for Pinia reactivity
      store.remoteStream = new MediaStream(store.remoteStream.getTracks())

     /* console.log('📊 Remote stream tracks:', {
        total: store.remoteStream.getTracks().length,
        video: store.remoteStream.getVideoTracks().length,
        audio: store.remoteStream.getAudioTracks().length
      })*/

      if (remoteVideoEl && remoteVideoEl.srcObject !== store.remoteStream) {
        remoteVideoEl.srcObject = store.remoteStream
        remoteVideoEl.autoplay = true
        remoteVideoEl.playsInline = true
        remoteVideoEl.muted = false
        remoteVideoEl.play().catch(err => console.warn('Remote video play failed', err))
      }
    }

    // 6️⃣ ICE candidates
    store.peer.onicecandidate = (event) => {
      if (!event.candidate) return
      const payload: IceCandidateDto = {
        Candidate: event.candidate.candidate,
        SdpMid: event.candidate.sdpMid ?? null,
        SdpMLineIndex: event.candidate.sdpMLineIndex ?? null
      }

      // If the browser didn't provide mid/index, this ICE candidate is not usable by some clients.
      // Still send it to server (server may ignore), but don't enqueue it locally as RTCIceCandidateInit.
      const rtcInit: RTCIceCandidateInit | null =
        payload.SdpMid == null && payload.SdpMLineIndex == null
          ? null
          : {
              candidate: payload.Candidate,
              sdpMid: payload.SdpMid ?? undefined,
              sdpMLineIndex: payload.SdpMLineIndex ?? undefined
            }

      if (store.peer!.remoteDescription?.type) {
        store.connection!.invoke('SendIce', Number(partnerId), payload)
          .catch(err => logCallError(store, 'SendIce failed: ' + err?.message))
      } else {
        // Queue ICE candidates until remote description is set
        if (rtcInit) store.iceQueue = [...store.iceQueue, rtcInit]
      }
    }

    // 7️⃣ Create and send offer
    const offer = await store.peer.createOffer()
    await store.peer.setLocalDescription(offer)

    /*console.log('📤 Sending offer, sdpLength:', offer.sdp?.length)
    await store.connection!.invoke('SendOffer', Number(partnerId), {
      Type: offer.type ?? 'offer',
      Sdp: offer.sdp ?? ''
    } as SdpDto)*/

    store.inCall = true
    store.showCallScreen = true
    //console.log('✅ Call started — waiting for answer')
  } catch (err: any) {
    const errorMsg = err?.message ?? JSON.stringify(err)
    logCallError(store, 'startCall frontend error: ' + errorMsg)
    //console.error('❌ startCall failed:', errorMsg)
    alert('Cannot access mic/camera or start call: ' + errorMsg)
    store.cleanupCall()
  } finally {
    //console.groupEnd()
  }
}

export async function acceptCall(
  store: ReturnType<typeof useMessengerStore>,
  offerPayload: { type: string; sdp: string; callId?: string },
  partnerId: number,
  remoteVideoEl?: HTMLVideoElement
) {
  //console.group('📞 acceptCall')
  //console.log('Partner ID:', partnerId)

  if (store.inCall) {
    //console.warn('Already in call')
    //console.groupEnd()
    return
  }

  if (!offerPayload?.sdp) {
    //console.error('No valid offer payload')
    //console.groupEnd()
    return
  }

  if (!store.connection) await store.initSignalR()
  if (!store.connection) {
    //console.error('SignalR unavailable')
    //console.groupEnd()
    return
  }

  try {
    // ✅ Always derive video from SDP — never trust IncomingCall.video flag
    const hasVideo = offerPayload.sdp.includes('m=video')
    store.currentCallIsVideo = hasVideo

    //console.log('🎥 acceptCall video flag:', hasVideo)

    store.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: hasVideo
    })
    //console.log('Local media acquired:', store.localStream.getTracks().map(t => t.kind))

    store.remoteStream = new MediaStream()

    store.peer = new RTCPeerConnection({
      sdpSemantics: 'unified-plan',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    } as RTCConfiguration)

    // 1️⃣ Add local tracks BEFORE setRemoteDescription
    store.localStream.getTracks().forEach(track => {
      store.peer!.addTrack(track, store.localStream!)
    })
    //console.log('Senders after addTrack:', store.peer.getSenders().map(s => s.track?.kind))

    // 2️⃣ Handle remote tracks
    store.peer.ontrack = (event) => {
      console.log('📥 Remote track received:', {
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState
      })

      if (!store.remoteStream) store.remoteStream = new MediaStream()
      store.remoteStream.addTrack(event.track)
      // ✅ Reassign for Pinia reactivity
      store.remoteStream = new MediaStream(store.remoteStream.getTracks())

      console.log('📊 Remote stream tracks:', {
        total: store.remoteStream.getTracks().length,
        video: store.remoteStream.getVideoTracks().length,
        audio: store.remoteStream.getAudioTracks().length
      })

      if (remoteVideoEl && remoteVideoEl.srcObject !== store.remoteStream) {
        remoteVideoEl.srcObject = store.remoteStream
        remoteVideoEl.autoplay = true
        remoteVideoEl.playsInline = true
        remoteVideoEl.muted = false
        remoteVideoEl.play()
          .then(() => console.log('✅ Remote video playing'))
          .catch(err => console.warn('Remote video play failed', err))
      }

      event.track.onended = () => {
        //console.log(`Track ended: ${event.track.kind} (${event.track.id})`)
      }
    }

    // 3️⃣ ICE candidates
    store.peer.onicecandidate = async (event) => {
      if (!event.candidate || !store.connection) return
      const iceCandidate: IceCandidateDto = {
        Candidate: event.candidate.candidate,
        SdpMid: event.candidate.sdpMid ?? null,
        SdpMLineIndex: event.candidate.sdpMLineIndex ?? null
      }
      //console.log('🧊 Sending ICE candidate to', partnerId)
      try {
        await store.connection.invoke('SendIce', Number(partnerId), iceCandidate)
      } catch (err: any) {
        logCallError(store, 'SendIce failed: ' + err?.message)
      }
    }

    // 4️⃣ Set remote description
    await store.peer.setRemoteDescription({
      type: offerPayload.type as RTCSdpType,
      sdp: offerPayload.sdp
    })

    // ✅ Flush any ICE candidates that arrived before remote description
    for (const candidate of store.iceQueue ?? []) {
      try {
        await store.peer.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        //console.warn('Failed to add queued ICE candidate:', err)
      }
    }
    store.iceQueue = []
    //console.log('✅ Remote description set, ICE queue flushed')

    // 5️⃣ Create and send answer
    const answer = await store.peer.createAnswer()
    await store.peer.setLocalDescription(answer)

    console.log('📤 Sending answer to', partnerId)
    await store.connection.invoke('SendAnswer', Number(partnerId), {
      Type: answer.type ?? 'answer',
      Sdp: answer.sdp ?? ''
    } as SdpDto)

    store.inCall = true
    store.showCallScreen = true
    store.currentCallUserId = partnerId
    store.currentCallId = Number(offerPayload.callId) || null
    store.callStartTime = Date.now() // ✅ start timer on receiver side too

    //console.log('✅ Call accepted successfully, hasVideo:', hasVideo)
  } catch (err: any) {
    //console.error('❌ acceptCall failed:', err)
    alert('Cannot access mic/camera or accept call: ' + (err?.message ?? err))
    store.cleanupCall()
  } finally {
    //console.groupEnd()
  }
}

export async function endCall(store: ReturnType<typeof useMessengerStore>) {
  const durationInSeconds = store.getCallDurationInSeconds()
  //console.log('📞 endCall, duration:', durationInSeconds, 'callId:', store.currentCallId)

  if (store.connection?.state === signalR.HubConnectionState.Connected) {
    try {
      if (store.currentCallId) {
        // Caller path — EndCall saves to DB and notifies both sides
        await store.connection.invoke('EndCall', store.currentCallId, durationInSeconds)
      } else if (store.currentCallUserId) {
        // Receiver path — HangUpCall notifies the caller
        await store.connection.invoke('HangUpCall', Number(store.currentCallUserId))
      }
    } catch (err) {
      //console.error('EndCall invoke failed:', err)
      alert(err)
    }
  }

  store.cleanupCall()
}

export async function rejectIncomingCall(
  store: ReturnType<typeof useMessengerStore>,
  fromUserId?: number | string
) {
  if (!store.connection) return

  try {
    const id = Number(fromUserId ?? store.incomingCall?.fromUserId)
    if (!id) return
    //console.log('Store rejectIncomingCall called, notifying userId:', id)
    store.connection.invoke('RejectCall', id)
      .catch((err: any) => console.error('Error notifying caller:', err))
  } catch (err) {
    //console.error('Error in rejectIncomingCall:', err)
    alert(err)
  }

  store.cleanupCall()
  store.showCallScreen = false
  store.showIncomingCallModal = false
}

export async function cleanupCall(store: ReturnType<typeof useMessengerStore>) {
  //console.log('🧹 cleanupCall running, inCall was:', store.inCall)  // ← add this
  store.peer?.close()
  store.peer = null
  store.localStream?.getTracks().forEach(t => t.stop())
  store.localStream = null
  store.remoteStream = null
  store.inCall = false
  store.incomingCall = null
  store.currentCallIsVideo = false
  store.currentCallId = null
  store.currentCallUserId = null
  store.callStartTime = null
  store.showCallScreen = false
  store.showIncomingCallModal = false
}

function logCallError(store: ReturnType<typeof useMessengerStore>, message: string) {
  //console.error('📝 Call error logged:', message)
  store.callErrors.push(message)
}