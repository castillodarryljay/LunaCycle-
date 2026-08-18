export interface User {
  name: string;
  age?: number;
  cycleLength: number;
  periodLength: number;
  isIrregular?: boolean;
  profilePic?: string;
  darkMode?: boolean;
}

export interface CycleData {
  id: string;
  startDate: string;
  endDate?: string;
  length: number;
}

export interface LogEntry {
  id: string;
  date: string;
  symptoms: string[];
  mood: string;
  intensity?: 'None' | 'Light' | 'Medium' | 'Heavy';
  isPeriod: boolean;
  isPeriodEnd?: boolean;
  notes?: string;
}
