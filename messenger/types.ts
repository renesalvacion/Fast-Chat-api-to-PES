// =========================
// WebRTC DTOs
// =========================
export interface SdpDto {
  Type: string
  Sdp: string
}

export interface IceCandidateDto {
  Candidate: string
  SdpMid?: string | null
  SdpMLineIndex?: number | null
}

// =========================
// Chat Models
// =========================
export interface ChatMessage {
  id: string | number
  senderId: number
  recipientId: number
  content: string
  attachments?: any[]
  createdAt: string
  isTemp?: boolean
  isError?: boolean
  errorMessage?: string | null
  reactiontype?: number | null
}

export interface OpenChat {
  partnerId: number
  messages: ChatMessage[]
  isOpen: boolean
  unread: number
  page: number
  total: number
}

// ✅ Fixed — callId and offer are always present (nullable not optional)
export interface IncomingCall {
  fromUserId: number
  video: boolean
  callId: number | null
  offer: { type: RTCSdpType; sdp?: string } | null
}

// =========================
// Pinia Store State
// =========================
export interface MessengerState {
  openChats: OpenChat[]
  connection: import('@microsoft/signalr').HubConnection | null
  remoteStream: MediaStream | null
  localStream: MediaStream | null
  iceQueue: RTCIceCandidateInit[]
  peer: RTCPeerConnection | null
  inCall: boolean
  currentCallUserId: number | null
  currentCallId: number | null
  currentCallIsVideo: boolean        // ✅ NEW
  callStartTime: number | null
  showCallScreen: boolean
  showIncomingCallModal: boolean
  incomingCall: IncomingCall | null
  callErrors: string[]
  recientName: string
  onlineUsers: Map<number, boolean>
  userLastActive: Map<number, number>
}