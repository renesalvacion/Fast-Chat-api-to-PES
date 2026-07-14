// stores/auth.ts
import { defineStore } from 'pinia'
import axios from 'axios'
import { api, useDevStore, useItprfRequestStore } from '#imports'
import { useMaintenanceStore } from '#imports'

export type UserRole = 'admin' | 'it_project_manager' | 'user'

export function getRoleDashboard(role?: string): string {
  switch (role) {
    case 'admin':           return '/dashboard'
    case 'project_manager': return '/project_manager/dashboard'
    case 'user':            return '/user/dashboard'
    default:                return '/dashboard'
  }
}

interface UserSession {
  userId: string
  email: string
  name: string
  department: string,
  branchName: string
  empid: string
}

interface UserData {
  userid: number
  name: string
  email: string
}

export interface SessionType {
  email: string
  userId: number
  name: string,
}

interface ChatHistoryItem {
  userId: number
  name: string
  lastMessage: string
  lastMessageAt: string
  lastSenderId: number
  hasAttachment: boolean
}


export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as null | {
      userId: number
      name: string
      email: string
      role: UserRole
      department: string
      branchName: string
      empId:string
    },
    isLoading: false,
    error: null as string | null,
    isAuthenticated: false,
    initialized: false,
    message: '',
    peopleData: [] as any [],
    session: null as SessionType | null,

    recipientName: "",
    searchPeopleData: [] as any[],

    //branches
    userBranch: "",
    branchList: [] as any[],

    //Department
    userDepartment: "",
    departmentList: [] as any[],

    isNoPeople: false,

    //Search people details
    empId: "",
    departmentName: "",
    branchName: "",

    chatHistory: [] as ChatHistoryItem[],
isLoadingChatHistory: false,

    //Get Date and Time and Greetings
    dateTime: "",
    greeetings: "",
    day: "",

    // ✅ de-dupes concurrent fetchSession() calls during rapid navigation
    _sessionPromise: null as Promise<void> | null,

  }),



  getters: {
    role:             (state): UserRole | null => state.user?.role ?? null,
    isAdmin:          (state) => state.user?.role === 'admin',
    isProjectManager: (state) => state.user?.role === 'it_project_manager',
    isUser:           (state) => state.user?.role === 'user',
    apiUrl: () => useRuntimeConfig().public.apiBase
  },

  actions: {

    async fetchDateTime() {
      const client = api()

      try {
        const res = await client.get(`/api/Access/Get-Time-Date`, {
          withCredentials : true
        })

        this.dateTime = res.data.dateTime
        this.greeetings = res.data.greeting
        this.day = res.data.day
      } catch (error) {
        console.error(error)
      }
    },
    getName() {
      return this.user
    },

    async loginUser(cred: { loginname: string; password: string }) {
      try {
        const client = api()
        this.isLoading = true
        this.error = null
        this.message = ''

        const res = await client.post(`/api/Access/loginUser`, cred, { withCredentials: true })

        if (res.data.status === 'SUCCESS') {
          const u = res.data.objParam1
          const normalizedRole = u.userrole.toLowerCase().replace(/\s+/g, '_') as UserRole

          this.user = {
            userId: u.userid,
            name: u.requestorname,
            email: u.emailadd,
            role: normalizedRole,
            department: u.department,
            branchName: u.branchname,
            empId: u.empid
          }

          this.isAuthenticated = true
          this.initialized = true

          await this.initializeUserStores()

          // ✅ Don't read/remove REDIRECT_KEY here
          // ✅ Don't call fetchListMaintenance here — sidebar handles it in onMounted
          // ✅ Just navigate to dashboard — middleware will redirect to REDIRECT_KEY if it exists
          return navigateTo('/dashboard')
        }

        this.error = res.data.message || 'Login failed'
        return false

      } catch (err: any) {
        const status = err.response?.status
        const serverMessage = err.response?.data?.message

        if (serverMessage) {
          // ✅ Covers normal failures (wrong credentials, locked account)
          // AND the 429 rate-limit JSON body from the backend, since it
          // uses the same { status, message } shape.
          this.error = serverMessage
        } else if (status === 429) {
          // fallback in case the 429 body wasn't readable for some reason
          this.error = 'Too many login attempts. Please wait a moment and try again.'
        } else if (!err.response) {
          // no response object at all = actual network/connectivity failure
          // or CORS blocked the response before JS could read it
          this.error = 'Network error — please check your connection and try again.'
        } else {
          this.error = 'Something went wrong. Please try again.'
        }

        this.message = this.error
        return false
      } finally {
        this.isLoading = false
      }
    },


    async initializeUserStores() {
      const maintenanceStore = useMaintenanceStore()
      const devStore = useDevStore()
      const itprfRequestStore = useItprfRequestStore()

      await Promise.all([
        maintenanceStore.fetchListMaintenance(),
      ])
    },

    async fetchSession() {
      // ✅ If a session check is already in flight, every caller awaits
      // that SAME promise instead of firing a new request. This is what
      // stops rapid nav-clicks from racing multiple /session calls and
      // overwriting this.user out of order.
      if (this._sessionPromise) return this._sessionPromise

      this._sessionPromise = (async () => {
        try {
          const client = api()
          const res = await client.get<UserSession>(`/api/Access/session`, { withCredentials: true })

          const normalizedRole = res.data.role.toLowerCase().replace(/\s+/g, '_') as UserRole
          this.user = {
            userId: Number(res.data.userId),
            name: res.data.name,
            email: res.data.email,
            role: normalizedRole,
            department: res.data.department,
            branchName: res.data.branchName,
            empId: res.data.empid
          }
          this.isAuthenticated = true
          this.initialized = true
        } catch (err: any) {
          const status = err?.response?.status
          if (status === 401 || status === 403) {
            this.user = null
            this.isAuthenticated = false
            this.initialized = false
          } else {
            console.error('fetchSession transient error:', err)
            this.initialized = true
          }
        } finally {
          this._sessionPromise = null
        }
      })()

      return this._sessionPromise
    },

    async searchPeople(find: string, page: number = 1) {
      try {
        const client = api()

        const res = await client.get(`/api/Access/Get-People`, {
          withCredentials: true,
          params: {
            find,
            page,
            pageSize: 20
          }
        })

        const result = res.data ?? {}

        const users = result.data ?? []

        this.searchPeopleData = users

        // better naming (no longer "no people")
        this.isNoPeople = users.length === 0

        this.message = users.length === 0 ? "No users found" : ""

        // optional (useful for infinite scroll)
        this.hasMorePeople = result.hasMore
        this.totalPeople = result.total

        //
        this.empId = res.data.data.empId
        this.branchName = res.data.data.branchName
        this.departmentName = res.data.data.departmentName

      } catch (error: any) {
        const status = error.response?.status

        if (status === 400) {
          this.message = error.response?.data || "Search term is required"
        } else if (status === 403) {
          this.message = "Not allowed"
        } else if (status === 401) {
          this.message = "Unauthorized"
        } else {
          this.message = error.message || "Unexpected error"
        }

        this.searchPeopleData = []
        this.isNoPeople = true
      }
    },

async fetchChatHistory(userId: number, silent = false) {
  if (!silent) this.isLoadingChatHistory = true
  try {
    const client = api()
    const runtime = useRuntimeConfig()
    const chatApiBase = runtime.public.chatApi

    const res = await axios.get(`${chatApiBase}/api/Chat/People-history/${userId}`, {
      withCredentials: true
    })

    const people = res.data?.people ?? []

    const nameLookup = new Map<number, string>(
      this.peopleData.map((p: any) => [p.userid, p.fullname])
    )

    const enriched = await Promise.all(
      people.map(async (p: any): Promise<ChatHistoryItem> => {
        let name = nameLookup.get(p.userId)

        if (!name) {
          try {
            const nameRes = await client.get(`/api/Access/recipient-name/${Number(p.userId)}`, {
              withCredentials: true
            })
            const resolved =
              typeof nameRes.data === 'string' ? nameRes.data : nameRes.data?.name
            if (resolved) name = resolved
          } catch (err) {
            console.error(`recipient-name lookup failed for user ${p.userId}:`, err)
          }
        }

        return {
          userId: p.userId,
          name: name || `User ${p.userId}`,
          lastMessage: p.lastMessage,
          lastMessageAt: p.lastMessageAt,
          lastSenderId: p.lastSenderId,
          hasAttachment: p.hasAttachment
        }
      })
    )

    this.chatHistory = enriched
  } catch (error: any) {
    console.error('fetchChatHistory failed:', error)
    if (!silent) this.chatHistory = []
  } finally {
    if (!silent) this.isLoadingChatHistory = false
  }
    },

    
async getRecipientName(userid: number){
  try {
    const client = api()
    const res = await client.get(`/api/Access/recipient-name/${userid}`, {
      withCredentials : true
    })

    // normalize once, here, so every consumer gets a plain string
    this.recipientName = typeof res.data === 'string' ? res.data : res.data?.name ?? ''
  } catch (error:any) {
    console.error(error)
    this.recipientName = ''
  }
},

    async getBranchName() {
      const client = api()
      try {
        const res = await client.get(`/api/Access/Branch-Name`, {
          withCredentials : true
        })

        this.userBranch = res.data.userBranch
        this.branchList = res.data.branchNameList
      } catch (error: any) {
        alert(error)
      }
    },

    async getDepartment() {
      const client = api()
      try {
        const res = await client.get(`/api/Access/Get-Department`, {
          withCredentials : true
        })

        this.userDepartment = res.data.userDepartment
        this.departmentList = res.data.departmentList
      } catch (error:any) {
        alert(error)
      }
    },

    async logout() {
      const itprfRequestStore = useItprfRequestStore()
      const devStore = useDevStore()
      const maintenanceStore = useMaintenanceStore()

      try {
        const client = api()
        await client.post(`/api/Access/logout`, {}, { withCredentials: true })
      } catch (error) {
        console.error(error)
      } finally {
        this.user = null
        this.isAuthenticated = false
        this.initialized = false

        // ✅ Explicitly wipe every store that held per-user/privilege data,
        // instead of refetching (which can silently fail post-logout and
        // doesn't help anyway since the sidebar reads these specific fields).
        itprfRequestStore.isShow = false
        itprfRequestStore.isCloseShow = false
        devStore.queuedIsDev = false
        maintenanceStore.menuSections = []

        // Clear ALL path keys on logout
        localStorage.removeItem('redirect_after_login')
        localStorage.removeItem('last_visited_path')
        localStorage.removeItem('auth_last_path')

        navigateTo('/')
      }
    },

    async fethItPeople(){
      try {

        const client = api()
        const res = await client.get(`/api/Access/it-people`, {
          withCredentials : true
        })

        this.peopleData = res.data
      } catch (error:any) {
        alert(error)
      }
    },

    // In your auth store
    // ✅ Fix refreshSession — don't clear user on failure, don't navigate
    async refreshSession() {
      try {
        const client = api()
        const res = await client.get('/api/Access/session', { withCredentials: true })
        const normalizedRole = res.data.role
          .toLowerCase()
          .replace(/\s+/g, '_') as UserRole

        this.user = {
          userId: Number(res.data.userId),
          name: res.data.name,
          email: res.data.email,
          role: normalizedRole,
          department: res.data.department,
          branchName: res.data.branchName,
          empId: res.data.empid
        }
        this.isAuthenticated = true
      } catch (e) {
        // ✅ Don't clear user here — let the middleware handle auth
        console.error('refreshSession failed:', e)
      }
    },
  },

  persist: {
    key: 'auth',
    storage: persistedState.localStorage,
    // ✅ Do NOT persist 'initialized' — forces a real session check on every page load
    pick: ['user', 'isAuthenticated']
  },
})