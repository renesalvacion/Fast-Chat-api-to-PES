import axios from 'axios';
import { ensureSignalRConnection } from './signalr'
import type { useMessengerStore } from './index';

function getUrl(){
  const runtime = useRuntimeConfig()
  const api = runtime.public.chatApi
  return api
}

export async function viewMessages(
  store: ReturnType<typeof useMessengerStore>,
  userId: number,
  partnerId: number
) {
  const apiUrl = getUrl()

  const chat = store.openOrTouchChat(partnerId)
  chat.unread = 0

  const res = await axios.get(
    `${apiUrl}/api/chat/view-person-message/${userId}/${partnerId}?page=1`,
    { withCredentials: true }
  )

  const grouped = res.data.data?.messages || []
  const totalMessages = res.data.data?.totalMessages || 0

  const latestMessages = grouped.flatMap((group: any) =>
    group.messages.map((msg: any) => ({
      ...msg,
      day: group.day
    }))
  )

  const existingIds = new Set(chat.messages.map(m => m.id))

  chat.messages = [
    ...chat.messages,
    ...latestMessages.filter((m: any) => !existingIds.has(m.id))
  ]

  chat.page = 1
  chat.total = totalMessages

  return chat.messages
}

export async function sendMessage(
  store: ReturnType<typeof useMessengerStore>,
  receiverId: number,
  content: string,
  files: File[]
) {
  const authStore = useAuthStore()
  const apiUrl = getUrl();

  await ensureSignalRConnection(store);

  const chat = store.openOrTouchChat(receiverId);

  const uploadedAttachments = await Promise.all(
    files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${apiUrl}/api/chat/upload`, formData, { withCredentials: true });

      return {
        filename: res.data.filename,
        filepath: res.data.filepath,
        filetype: file.type,
        fileSize: file.size,
      };
    })
  );

  if (!content.trim() && uploadedAttachments.length === 0) {
    alert("Cannot send empty message");
    return;
  }

  const tempMessage = {
    id: "temp-" + Date.now(),
    senderId: store.getSessionId(),
    content,
    attachments: uploadedAttachments,
    createdAt: new Date().toISOString(),
    isTemp: true,
    isError: false,
  };
  chat.messages.push(tempMessage);
  chat.messages = [...chat.messages];

  try {
    const serverMessage: any = await store.connection!.invoke(
      "SendMessage",
      receiverId,
      content,
      uploadedAttachments
    );

    if (serverMessage?.id) {
      const idx = chat.messages.findIndex((m) => m.id === tempMessage.id);
      if (idx !== -1) chat.messages[idx] = serverMessage;
    }

    // ── Update chat history WITHOUT a network call when possible ──
    const sentAt = serverMessage?.createdAt || new Date().toISOString();
    const existing = authStore.chatHistory.find((c) => c.userId === receiverId);

    if (existing && existing.name) {
      // We already know this person's name — patch locally, no fetch needed.
      existing.lastMessage = content;
      existing.lastMessageAt = sentAt;
      existing.lastSenderId = store.getSessionId();
      existing.hasAttachment = uploadedAttachments.length > 0;

      // Move this conversation to the top of the list
      authStore.chatHistory = [
        existing,
        ...authStore.chatHistory.filter((c) => c.userId !== receiverId),
      ];
    } else {
      // Brand-new conversation (or name wasn't resolved yet) —
      // only now is a real network call justified, and it stays silent
      // so it doesn't trigger the Recent Chats loading spinner.
      authStore.fetchChatHistory(store.getSessionId(), true);
    }
  } catch (err: any) {
    tempMessage.isError = true;
    tempMessage.errorMessage = err?.message || "Failed to send message";
    alert(err)
  }

  chat.messages = [...chat.messages];
}

export async function deleteMessage(messageId: number){
   const apiUrl = getUrl()
    try {
      const response = await axios.post(`${apiUrl}/api/chat/delete-message/${messageId}`,{}, {
        withCredentials : true,
      })
      alert("Message: " + response.data.message)
    } catch (error: any) { 
      alert('Error Message: ' + error?.response?.data.message)
    }
  }

export async function reactionMessage(messageId: number, reactionType: number) {
   const apiUrl = getUrl()

  try {
    const token = localStorage.getItem("token");

    const response = await axios.post(
      `${apiUrl}/api/chat/react/${messageId}/${reactionType}`,
      {},
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.data.status === 200) {
      // ok
    }
  } catch (error) {
    alert(error)
  }
}

export async function loadOlderMessages(store:ReturnType<typeof useMessengerStore>,partnerId: number, userId: number) {

  const apiUrl = useRuntimeConfig()
  const url = apiUrl.public.chatApi

  const chat = store.openChats.find(c => c.partnerId === Number(partnerId));
  if (!chat) return { advanced: false, exhausted: true };

  if (chat.total && chat.messages.length >= chat.total) {
    return { advanced: false, exhausted: true };
  }

  const nextPage = (chat.page || 1) + 1;

  try {
    const res = await axios.get(
      `${url}/api/chat/view-person-message/${userId}/${partnerId}?page=${nextPage}`,
      { withCredentials:true } 
    );

    const grouped = res.data.data?.messages || [];
    const olderMessages = grouped.flatMap((group: any) =>
      group.messages.map((msg: any) => ({
        ...msg,
        day: group.day
      }))
    )
    const totalMessages = res.data.data?.totalMessages || chat.total || 0;

    if (!olderMessages.length) {
      chat.total = totalMessages;
      return { advanced: false, exhausted: true };
    }

    const existingIds = new Set(chat.messages.map(m => m.id));
    const filtered = olderMessages.filter((m: any) => !existingIds.has(m.id));

    chat.page = nextPage;
    chat.total = totalMessages;
    chat.isOpen = true;

    if (filtered.length) {
      chat.messages = [...filtered, ...chat.messages];
    }

    const exhausted = chat.total > 0 && chat.messages.length >= chat.total;
    return { advanced: true, exhausted, added: filtered.length };
  } catch (err) {
    alert(err)
    return { advanced: false, exhausted: false, error: true };
  }
}