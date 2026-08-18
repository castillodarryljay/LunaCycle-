import { User, CycleData, LogEntry } from '../types';

const USER_KEY = 'lunacycle_user';
const CYCLES_KEY = 'lunacycle_cycles';
const LOGS_KEY = 'lunacycle_logs';
const CHAT_KEY = 'lunacycle_chat';

export const storage = {
  getUser: (): User => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : {
      name: 'User',
      cycleLength: 28,
      periodLength: 5,
      isIrregular: false,
      darkMode: false
    };
  },
  saveUser: (user: User) => localStorage.setItem(USER_KEY, JSON.stringify(user)),

  getCycles: (): CycleData[] => {
    const saved = localStorage.getItem(CYCLES_KEY);
    return saved ? JSON.parse(saved) : [];
  },
  saveCycles: (cycles: CycleData[]) => localStorage.setItem(CYCLES_KEY, JSON.stringify(cycles)),

  getLogs: (): LogEntry[] => {
    const saved = localStorage.getItem(LOGS_KEY);
    return saved ? JSON.parse(saved) : [];
  },
  saveLogs: (logs: LogEntry[]) => localStorage.setItem(LOGS_KEY, JSON.stringify(logs)),

  getChatHistory: (): any[] => {
    const saved = sessionStorage.getItem(CHAT_KEY);
    return saved ? JSON.parse(saved) : [];
  },
  saveChatHistory: (history: any[]) => sessionStorage.setItem(CHAT_KEY, JSON.stringify(history))
};
