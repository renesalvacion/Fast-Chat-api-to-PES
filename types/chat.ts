export interface ChatMessage {
  id: number | string
  senderId: number
  recipientId?: number
  content: string
  createdAt: string
  attachments?: any[]
  isTemp?: boolean
  isError?: boolean
}

export interface OpenChat {
  partnerId: number
  messages: ChatMessage[]
  isOpen: boolean
  unread: number
  page: number
  total: number
}

export interface IncomingCall {
  fromUserId: number
  video: boolean
  offer?: RTCSessionDescriptionInit
}