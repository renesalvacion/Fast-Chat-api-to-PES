import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useMessengerStore } from '../stores/messenger/index'
import { useAuthStore } from '#imports'

interface Person { userid: number; fullname: string }
interface Attachment {
  file: File
  name: string
  type: string
  preview: string
}

export function useMessenger() {
  const messengerStore = useMessengerStore()
  const authStore = useAuthStore() // single instance — was duplicated 3x before

  const selectedUser = ref<Person | null>(null)
  const messages = ref<any[]>([])
  const sessionId = computed(() => Number(authStore.user?.userId))
  const messagesEl = ref<HTMLElement | null>(null)
  const newMessage = ref('')
  const attachments = ref<Attachment[]>([])
  const openMenuIndex = ref<number | string | null>(null)
  const activeReactionId = ref<number | string | null>(null)
  const searchQuery = ref('')
  const isSearching = ref(false)
  const lightboxSrc = ref<string | null>(null)
  const isLoadingMore = ref(false)
  const hasMoreMessages = ref(true)
  const isLoadingConversation = ref(false)
  let lengthBeforeLoad = 0
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── Recent chats vs search results ──────────────────────
  // Recent: sourced from authStore.chatHistory (populated by
  // fetchChatHistory, kept in sync by sendMessage / incoming messages).
  const recentPeople = computed<Person[]>(() =>
    authStore.chatHistory.map((c) => ({ userid: c.userId, fullname: c.name }))
  )

  // Search: sourced from authStore.searchPeopleData (real API search,
  // not a local filter over the IT-people list).
  const searchResults = computed<Person[]>(() =>
    (authStore.searchPeopleData ?? []).map((p: any) => ({
      userid: p.userid ?? p.userId,
      fullname: p.fullname ?? p.name ?? 'Unknown',
    }))
  )

  // Whichever list the sidebar should actually render right now.
  const peoples = computed<Person[]>(() =>
    searchQuery.value.trim() ? searchResults.value : recentPeople.value
  )

  const getPreviewText = (userId: number) => {
    const last = authStore.chatHistory.find((c) => c.userId === userId)
    if (!last) return 'Tap to open chat'

    const isMe = last.lastSenderId === sessionId.value
    const prefix = isMe ? 'You: ' : ''

    let text = last.lastMessage?.trim()
    if (!text && last.hasAttachment) text = '📎 Attachment'
    if (!text) return 'Tap to open chat'

    return prefix + text
  }

  // Patch (or insert) a chatHistory entry and bump it to the top —
  // used for both outgoing (optimistic) and incoming live messages,
  // so neither path needs its own network round-trip.
  function upsertChatHistory(entry: {
    userId: number
    name?: string
    lastMessage: string
    lastMessageAt: string
    lastSenderId: number
    hasAttachment: boolean
  }) {
    const existing = authStore.chatHistory.find((c) => c.userId === entry.userId)

    if (existing) {
      existing.lastMessage = entry.lastMessage
      existing.lastMessageAt = entry.lastMessageAt
      existing.lastSenderId = entry.lastSenderId
      existing.hasAttachment = entry.hasAttachment
      authStore.chatHistory = [
        existing,
        ...authStore.chatHistory.filter((c) => c.userId !== entry.userId),
      ]
    } else if (entry.name) {
      // We know the name locally (e.g. from selectedUser) — no fetch needed.
      authStore.chatHistory = [
        {
          userId: entry.userId,
          name: entry.name,
          lastMessage: entry.lastMessage,
          lastMessageAt: entry.lastMessageAt,
          lastSenderId: entry.lastSenderId,
          hasAttachment: entry.hasAttachment,
        },
        ...authStore.chatHistory,
      ]
    } else {
      // Brand-new partner and we don't have their name — only now is a
      // real (silent) fetch justified.
      authStore.fetchChatHistory(sessionId.value, true)
    }
  }

  function handleIncomingPreview(payload: any) {
    const senderId = Number(payload.senderId ?? payload.Senderid)
    const recipientId = Number(payload.recipientId ?? payload.Recipientid)
    const otherId = senderId === sessionId.value ? recipientId : senderId

    upsertChatHistory({
      userId: otherId,
      lastMessage: payload.content ?? payload.Content ?? '',
      lastMessageAt: payload.createdAt ?? payload.Createdat ?? new Date().toISOString(),
      lastSenderId: senderId,
      hasAttachment: (payload.attachments?.length ?? 0) > 0,
    })
  }

  // ── Group messages by day ──────────────────────────────
  function groupMessagesByDay(msgs: any[]) {
    const sorted = msgs
      .map(m => ({ ...m, date: new Date(m.createdAt) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const formatDay = (date: Date) => {
      if (date.toDateString() === today.toDateString()) return 'Today'
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    return sorted.reduce((acc: any[], msg) => {
      const dayLabel = formatDay(msg.date)
      const lastGroup = acc[acc.length - 1]
      if (!lastGroup || lastGroup.day !== dayLabel) acc.push({ day: dayLabel, messages: [msg] })
      else lastGroup.messages.push(msg)
      return acc
    }, [])
  }

  function normalizeMessages(raw: any[]) {
    return raw.map((msg: any) => ({
      id: msg.id,
      content: msg.content ?? '',
      senderId: Number(msg.senderId ?? msg.senderid ?? 0),
      recipientId: Number(msg.recipientId ?? msg.recipientid ?? 0),
      createdAt: msg.createdAt ?? msg.createdat,
      attachments: msg.attachments ?? [],
      isTemp: msg.isTemp ?? false,
      isError: msg.isError ?? false,
      errorMessage: msg.errorMessage ?? null,
      reactiontype: msg.reactiontype ?? null
    }))
  }

  // ── Scroll ─────────────────────────────────────────────
  const scrollToBottom = async (smooth = false) => {
    await nextTick()
    if (!messagesEl.value) return
    messagesEl.value.scrollTo({ top: messagesEl.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  const isNearBottom = (threshold = 150) => {
    if (!messagesEl.value) return true
    const el = messagesEl.value
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  let isProgrammaticScroll = false
  const noProgressPartners = new Set<number>()
  let lastLoadAt = 0
  const LOAD_COOLDOWN_MS = 600

  const onMessagesScroll = async () => {
    if (isProgrammaticScroll) return
    if (!messagesEl.value || isLoadingMore.value || !hasMoreMessages.value) return
    if (!selectedUser.value || !sessionId.value) return
    if (messagesEl.value.scrollTop > 50) return

    const partnerId = selectedUser.value.userid

    if (noProgressPartners.has(partnerId)) {
      hasMoreMessages.value = false
      return
    }

    const now = Date.now()
    if (now - lastLoadAt < LOAD_COOLDOWN_MS) return
    lastLoadAt = now

    isLoadingMore.value = true
    const prevScrollHeight = messagesEl.value.scrollHeight

    try {
      const chat = messengerStore.openChats.find(c => c.partnerId === partnerId)
      if (!chat || chat.messages.length >= chat.total) {
        hasMoreMessages.value = false
        return
      }

      lengthBeforeLoad = chat.messages.length

      await messengerStore.loadOlderMessages(partnerId, sessionId.value)

      const updated = messengerStore.openChats.find(c => c.partnerId === partnerId)
      const newLength = updated?.messages.length ?? lengthBeforeLoad

      if (newLength <= lengthBeforeLoad) {
        console.warn(
          `[messenger] loadOlderMessages for partner ${partnerId} returned no new messages ` +
          `(before: ${lengthBeforeLoad}, after: ${newLength}). Stopping further requests for this chat.`
        )
        noProgressPartners.add(partnerId)
        hasMoreMessages.value = false
        return
      }

      if (updated) {
        messages.value = groupMessagesByDay(normalizeMessages(updated.messages))
      }

      await nextTick()
      await nextTick()

      if (messagesEl.value) {
        isProgrammaticScroll = true
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight - prevScrollHeight
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { isProgrammaticScroll = false })
        })
      }
    } catch (err) {
      console.error('loadOlderMessages error:', err)
      noProgressPartners.add(partnerId)
      hasMoreMessages.value = false
    } finally {
      lengthBeforeLoad = 0
      isLoadingMore.value = false
    }
  }

  // ── Open chat ──────────────────────────────────────────
  const openChat = async (user: Person) => {
    selectedUser.value = user
    hasMoreMessages.value = true
    isLoadingMore.value = false
    isLoadingConversation.value = true
    messages.value = []
    noProgressPartners.delete(user.userid)

    if (!sessionId.value) {
      isLoadingConversation.value = false
      return
    }
    try {
      const response = await messengerStore.viewMessagesPerson(sessionId.value, user.userid)
      const normalized = normalizeMessages(response ?? [])
      messages.value = groupMessagesByDay(normalized)
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      isLoadingConversation.value = false
    }
    await scrollToBottom(true)
  }

  // ── Send message ───────────────────────────────────────
  const sendMessage = async () => {
    if (!selectedUser.value || !sessionId.value) return
    if (!newMessage.value.trim() && attachments.value.length === 0) return

    const recipientId = selectedUser.value.userid
    const files = attachments.value.map(a => a.file)
    await messengerStore.initSignalR()

    const tempId = 'temp-' + Date.now()
    const tempMsg = {
      id: tempId,
      content: newMessage.value.trim(),
      senderId: sessionId.value,
      recipientId,
      attachments: attachments.value.map(a => ({ filename: a.name, filetype: a.type, preview: a.preview })),
      createdAt: new Date().toISOString(),
      isTemp: true
    }

    const dayStr = new Date(tempMsg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const lastGroup = messages.value.find(g => g.day === dayStr)
    if (!lastGroup) messages.value.push({ day: dayStr, messages: [tempMsg] })
    else lastGroup.messages.push(tempMsg)

    // Optimistic sidebar update — no network call needed
    upsertChatHistory({
      userId: recipientId,
      name: selectedUser.value.fullname,
      lastMessage: tempMsg.content,
      lastMessageAt: tempMsg.createdAt,
      lastSenderId: sessionId.value,
      hasAttachment: tempMsg.attachments.length > 0,
    })

    newMessage.value = ''
    attachments.value = []
    await scrollToBottom(true)

    try {
      const serverMsg = await messengerStore.sendMessage(recipientId, tempMsg.content, files)
      if (!serverMsg?.id) return
      messages.value.forEach(group => {
        const idx = group.messages.findIndex((m: any) => m.id === tempId)
        if (idx !== -1) group.messages[idx] = {
          ...serverMsg,
          isTemp: false,
          senderId: Number(serverMsg.senderId ?? serverMsg.senderid ?? sessionId.value),
          recipientId: Number(serverMsg.recipientId ?? serverMsg.recipientid ?? recipientId),
          createdAt: serverMsg.createdAt ?? serverMsg.createdat,
          attachments: serverMsg.attachments ?? []
        }
      })
    } catch (err) {
      console.error('SendMessage error:', err)
      messages.value.forEach(group => {
        const idx = group.messages.findIndex((m: any) => m.id === tempId)
        if (idx !== -1) group.messages[idx].isError = true
      })
    }
    await scrollToBottom(true)
  }

  // ── Reactions ──────────────────────────────────────────
  const toggleReaction = (msgId: number | string) => {
    activeReactionId.value = activeReactionId.value === msgId ? null : msgId
  }

  const reactionEmoji = (type: number | null | undefined) => {
    const map: Record<number, string> = { 1: '👍', 2: '❤️', 3: '😂', 4: '😢', 5: '😡' }
    return type ? map[type] ?? null : null
  }

  const reactionTyp = async (messageId: number, type: number) => {
    await messengerStore.reactionMessage(messageId, type)
    messages.value.forEach(group => {
      const msg = group.messages.find((m: any) => m.id === messageId)
      if (msg) msg.reactiontype = msg.reactiontype === type ? null : type
    })
  }

  const deleteUserMessage = (messageId: number) => {
    messengerStore.deleteMessage(messageId)
    messages.value.forEach(group => {
      const idx = group.messages.findIndex((m: any) => m.id === messageId)
      if (idx !== -1) group.messages.splice(idx, 1)
    })
  }

  // ── File attachments ───────────────────────────────────
  const isImage = (file: any): boolean => {
    const type: string = file.filetype ?? file.type ?? ''
    const name: string = file.filename ?? file.name ?? file.filepath ?? ''
    if (type) return type.startsWith('image/')
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)
  }

  const getFileUrl = (file: any): string => {
    if (file.preview) return file.preview
    if (file.filepath) return file.filepath
    if (file.url) return file.url
    return ''
  }

  const handleFiles = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) return
      attachments.value.push({ file, name: file.name, type: file.type, preview: URL.createObjectURL(file) })
    }
  }

  const removeAttachment = (index: number) => attachments.value.splice(index, 1)

  // ── Lightbox ───────────────────────────────────────────
  const openLightbox = (src: string) => {
    if (!src) return
    lightboxSrc.value = src
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = () => {
    lightboxSrc.value = null
    document.body.style.overflow = ''
  }

  // ── Search ─────────────────────────────────────────────
  const performSearch = async () => {
    const q = searchQuery.value.trim()
    if (!q) {
      authStore.searchPeopleData = []
      authStore.isNoPeople = false
      return
    }
    isSearching.value = true
    try {
      await authStore.searchPeople(q)
    } finally {
      isSearching.value = false
    }
  }

  watch(searchQuery, (val) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    const q = val.trim()
    if (!q) {
      authStore.searchPeopleData = []
      authStore.isNoPeople = false
      return
    }
    searchDebounceTimer = setTimeout(performSearch, 350)
  })

  // ── Status ─────────────────────────────────────────────
  const getStatusClass = (id: number) =>
    messengerStore.isUserOnline?.(id)
      ? (messengerStore.isUserActive?.(id) ? 'bg-green-500' : 'bg-yellow-400')
      : 'bg-slate-400'

  const partnerStatus = computed(() => {
    if (!selectedUser.value) return 'offline'
    const id = selectedUser.value.userid
    if (!messengerStore.isUserOnline?.(id)) return 'offline'
    return messengerStore.isUserActive?.(id) ? 'active' : 'idle'
  })

  // ── Calls ──────────────────────────────────────────────
  const startVoiceCall = async (id: number) => { await messengerStore.startCall(id, false) }
  const startVideoCall = async (id: number) => { await messengerStore.startCall(id, true) }

  // ── Mobile ─────────────────────────────────────────────
  const windowWidth = ref(0)
  const isMobileView = computed(() => windowWidth.value > 0 && windowWidth.value < 768)

  const onResize = () => { windowWidth.value = window.innerWidth }

  onMounted(() => {
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
  })

  const goBack = () => {
    selectedUser.value = null
    localStorage.removeItem('lastSelectedUser')
  }

  // ── Typing ─────────────────────────────────────────────
  const partnerIsTyping = computed(() =>
    selectedUser.value ? messengerStore.typingUsers.has(selectedUser.value.userid) : false
  )

  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let isCurrentlyTyping = false

  const onTyping = async () => {
    if (!selectedUser.value || !messengerStore.connection) return
    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true
      await messengerStore.connection.invoke('StartTyping', selectedUser.value.userid)
    }
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => onStopTyping(), 2000)
  }

  const onStopTyping = async () => {
    if (!isCurrentlyTyping) return
    isCurrentlyTyping = false
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null }
    if (!selectedUser.value || !messengerStore.connection) return
    await messengerStore.connection.invoke('StopTyping', selectedUser.value.userid)
  }

  watch(selectedUser, () => { onStopTyping() })
  watch(partnerIsTyping, async (val) => { if (val) await scrollToBottom(true) })

  // ── SignalR live watcher ───────────────────────────────
  const currentChat = computed(() =>
    messengerStore.openChats.find(c => c.partnerId === selectedUser.value?.userid)
  )

  watch(
    () => currentChat.value?.messages?.length,
    async (newLen, oldLen) => {
      if (!currentChat.value || newLen === undefined) return
      if (isLoadingMore.value || lengthBeforeLoad > 0) return
      if (newLen === (oldLen ?? 0)) return

      const wasNearBottom = isNearBottom()

      messages.value = groupMessagesByDay(normalizeMessages(currentChat.value.messages))

      const lastMsg = currentChat.value.messages[currentChat.value.messages.length - 1]
      const isIncoming = Number(lastMsg?.senderId ?? lastMsg?.senderid) !== sessionId.value

      if (isIncoming && wasNearBottom) {
        await scrollToBottom(true)
      }
    },
    { deep: true }
  )

  // ── localStorage ───────────────────────────────────────
  watch(selectedUser, (user) => {
    if (user) localStorage.setItem('lastSelectedUser', JSON.stringify(user))
    else localStorage.removeItem('lastSelectedUser')
  })

  // ── Init ───────────────────────────────────────────────
  onMounted(async () => {
    await authStore.fetchSession()
    await authStore.fethItPeople() // still needed: fetchChatHistory's name lookup uses peopleData
    await authStore.fetchChatHistory(sessionId.value) // real load — spinner shows on this page

    messengerStore.initActivityTracking?.()
    await messengerStore.initSignalR()

    messengerStore.connection?.on('ReceiveMessage', handleIncomingPreview)

    const saved = localStorage.getItem('lastSelectedUser')
    if (saved) {
      try {
        const lastUser = JSON.parse(saved)
        const exists = peoples.value.find((p: Person) => p.userid === lastUser.userid)
        if (exists) await openChat(exists)
        else localStorage.removeItem('lastSelectedUser')
      } catch {
        localStorage.removeItem('lastSelectedUser')
      }
    }
  })

  onUnmounted(() => {
    messengerStore.connection?.off('ReceiveMessage', handleIncomingPreview)
  })

  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox() }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

  return {
    // state
    selectedUser, peoples, messages, sessionId, messagesEl,
    newMessage, attachments, openMenuIndex, activeReactionId,
    searchQuery, isSearching, lightboxSrc, isLoadingMore, hasMoreMessages,
    isLoadingConversation,
    isMobileView, partnerStatus, partnerIsTyping,
    messengerStore, authStore,
    getPreviewText,
    // methods
    openChat, sendMessage, goBack, onMessagesScroll,
    toggleReaction, reactionEmoji, reactionTyp, deleteUserMessage,
    isImage, getFileUrl, handleFiles, removeAttachment,
    openLightbox, closeLightbox,
    getStatusClass, startVoiceCall, startVideoCall,
    onTyping, onStopTyping,
  }
}