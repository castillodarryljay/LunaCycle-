import { addDays, differenceInDays, parseISO } from 'date-fns';
import { User, CycleData, LogEntry } from '../types';

export interface PredictionResult {
  nextPeriodDate: Date;
  daysUntil: number;
  phase: 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal';
  phaseProgress: number; // 0 to 1
  fertilityStatus: 'Low' | 'Medium' | 'High' | 'Peak';
  ovulationDate: Date;
}

// REGULAR PERIOD CALCULATION
export function calculateRegularPeriod({ lastPeriodStart, cycleLength }: { lastPeriodStart: string, cycleLength: number }) {
  const MS_PER_DAY = 86400000;
  const lastDate = new Date(lastPeriodStart);

  // Next period
  const nextPeriod = new Date(lastDate.getTime() + cycleLength * MS_PER_DAY);

  // Ovulation = 14 days before next period
  const ovulationDate = new Date(nextPeriod.getTime() - 14 * MS_PER_DAY);

  // Fertile window (5 days before ovulation → ovulation day)
  const fertileStart = new Date(ovulationDate.getTime() - 5 * MS_PER_DAY);
  const fertileEnd = ovulationDate;

  return {
    nextPeriod,
    ovulationDate,
    fertileWindow: {
      start: fertileStart,
      end: fertileEnd,
    }
  };
}

// IRREGULAR PERIOD CALCULATION
export interface DetailedPrediction {
  start: Date;
  menstrualEnd: Date;
  proliferativeStart: Date;
  proliferativeEnd: Date;
  ovulationStart: Date;
  ovulationEnd: Date;
  secretoryStart: Date;
  secretoryEnd: Date;
  ovulation: Date;
  fertileWindow: { start: Date; end: Date };
  nextStart: string;
}

export function getFullPrediction(start: string, user: User, history: CycleData[], isCurrentCycle: boolean = false): DetailedPrediction {
  const latestCycle = history[history.length - 1];
  
  let mEndDays = user.periodLength;
  
  if (isCurrentCycle && latestCycle && latestCycle.startDate === start) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cStart = new Date(start);
    cStart.setHours(0, 0, 0, 0);
    const daysSinceCycleStart = Math.floor((today.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCycleStart >= 0 && daysSinceCycleStart < 40) {
      if (latestCycle.endDate) {
        const cEnd = new Date(latestCycle.endDate);
        cEnd.setHours(0, 0, 0, 0);
        mEndDays = Math.floor((cEnd.getTime() - cStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        const currentDayOfPeriod = daysSinceCycleStart + 1;
        if (currentDayOfPeriod > mEndDays) {
          mEndDays = currentDayOfPeriod;
        }
      }
    }
  }

  // Phase durations
  let fDuration = 6;
  const oDuration = 3;
  let sDuration = 12;

  // For regular cycles, adjust durations to match cycleLength
  if (!user.isIrregular) {
    const totalPhaseDays = user.cycleLength - mEndDays;
    sDuration = 12; 
    fDuration = Math.max(1, totalPhaseDays - oDuration - sDuration);
    sDuration = totalPhaseDays - fDuration - oDuration;
  }

  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);
  
  const addDays = (date: Date, days: number) => {
    const r = new Date(date);
    r.setDate(r.getDate() + days);
    return r;
  };

  const ovulationDate = addDays(normalizedStart, mEndDays + fDuration + 1); // Middle of 3-day window

  return {
    start: normalizedStart,
    menstrualEnd: addDays(normalizedStart, mEndDays - 1),
    proliferativeStart: addDays(normalizedStart, mEndDays),
    proliferativeEnd: addDays(normalizedStart, mEndDays + fDuration - 1),
    ovulationStart: addDays(normalizedStart, mEndDays + fDuration),
    ovulationEnd: addDays(normalizedStart, mEndDays + fDuration + oDuration - 1),
    secretoryStart: addDays(normalizedStart, mEndDays + fDuration + oDuration),
    secretoryEnd: addDays(normalizedStart, mEndDays + fDuration + oDuration + sDuration - 1),
    ovulation: ovulationDate,
    fertileWindow: {
      start: addDays(normalizedStart, mEndDays + fDuration),
      end: addDays(normalizedStart, mEndDays + fDuration + oDuration - 1)
    },
    nextStart: addDays(normalizedStart, mEndDays + fDuration + oDuration + sDuration).toISOString().split('T')[0]
  };
}

export function calculateIrregularPeriod({ lastPeriodStart, periodLength = 5, cycleLength: userCycleLength, isIrregular }: { lastPeriodStart: string, history?: string[], cycleLength?: number, periodLength?: number, isIrregular?: boolean }) {
  const MS_PER_DAY = 86400000;
  const lastDate = new Date(lastPeriodStart);

  // If regular, use the provided cycleLength. If irregular, use the phase sum logic
  const effectiveCycleLength = isIrregular ? (periodLength + 21) : (userCycleLength || 28);

  const nextPeriod = new Date(lastDate.getTime() + effectiveCycleLength * MS_PER_DAY);

  // Ovulation calc consistent with getFullPrediction durations
  const mEnd = periodLength;
  let fDuration = 6;
  const oDuration = 3;
  let sDuration = 12;

  if (!isIrregular) {
    const totalPhaseDays = effectiveCycleLength - mEnd;
    fDuration = Math.max(1, totalPhaseDays - oDuration - sDuration);
    sDuration = totalPhaseDays - fDuration - oDuration;
  }

  const ovulationDate = new Date(lastDate.getTime() + (mEnd + fDuration + 1) * MS_PER_DAY);

  return {
    cycleLength: effectiveCycleLength,
    periodLength,
    nextPeriod,
    ovulationDate,
    fertileWindow: {
      start: new Date(lastDate.getTime() + (mEnd + fDuration) * MS_PER_DAY),
      end: new Date(lastDate.getTime() + (mEnd + fDuration + 2) * MS_PER_DAY),
    }
  };
}

export function calculateAdvancedPrediction(
  user: User,
  cycles: CycleData[],
  logs: LogEntry[]
): PredictionResult {
  // 1. Determine baseline data
  const lastCycleEntry = cycles[cycles.length - 1];
  const lastPeriodLog = logs.filter(l => l.isPeriod).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastStartDate = lastCycleEntry ? lastCycleEntry.startDate : (lastPeriodLog ? lastPeriodLog.date : null);

  if (!lastStartDate) {
    const cycleLength = user.cycleLength || 28;
    return {
      nextPeriodDate: addDays(new Date(), cycleLength),
      daysUntil: cycleLength,
      phase: 'Follicular',
      phaseProgress: 0,
      fertilityStatus: 'Low',
      ovulationDate: addDays(new Date(), Math.floor(cycleLength / 2))
    };
  }

  // 2. Use user-provided logic based on irregularity
  const basePrediction = calculateIrregularPeriod({ 
    lastPeriodStart: lastStartDate,
    cycleLength: user.cycleLength,
    periodLength: user.periodLength,
    isIrregular: user.isIrregular
  });

  const predictedNextStart = basePrediction.nextPeriod;
  const daysSinceStart = differenceInDays(new Date(), parseISO(lastStartDate));

  // 4. Calculate Phase logic consistent with getFullPrediction durations
  let phase: PredictionResult['phase'] = 'Follicular';
  let phaseProgress = 0;
  
  const mEnd = user.periodLength;
  let fDuration = 6;
  const oDuration = 3;
  let sDuration = 12;

  if (!user.isIrregular) {
    const totalPhaseDays = user.cycleLength - mEnd;
    fDuration = Math.max(1, totalPhaseDays - oDuration - sDuration);
    sDuration = totalPhaseDays - fDuration - oDuration;
  }

  const fEnd = mEnd + fDuration; 
  const oEnd = mEnd + fDuration + oDuration; 

  if (daysSinceStart < mEnd) {
    phase = 'Menstrual';
    phaseProgress = daysSinceStart / mEnd;
  } else if (daysSinceStart < fEnd) {
    phase = 'Follicular';
    phaseProgress = (daysSinceStart - mEnd) / fDuration;
  } else if (daysSinceStart < oEnd) {
    phase = 'Ovulatory';
    phaseProgress = (daysSinceStart - fEnd) / oDuration;
  } else {
    phase = 'Luteal';
    phaseProgress = (daysSinceStart - oEnd) / sDuration;
  }

  // 5. Fertility Status
  const diffToOvulation = Math.abs(differenceInDays(new Date(), basePrediction.ovulationDate));
  
  let fertilityStatus: PredictionResult['fertilityStatus'] = 'Low';
  if (diffToOvulation === 0) fertilityStatus = 'Peak';
  else if (diffToOvulation <= 2) fertilityStatus = 'High';
  else if (diffToOvulation <= 4) fertilityStatus = 'Medium';

  return {
    nextPeriodDate: predictedNextStart,
    daysUntil: differenceInDays(predictedNextStart, new Date()),
    phase,
    phaseProgress: Math.min(Math.max(phaseProgress, 0), 1),
    fertilityStatus,
    ovulationDate: basePrediction.ovulationDate
  };
}

export function getDailyTip(phase: string): string {
  const p = phase.toLowerCase();
  if (p.includes('menstrual')) return "Focus on rest and iron-rich foods today. Gentle stretching can help with discomfort.";
  if (p.includes('follicular')) return "Energy levels are rising! Great time for new projects and more intense workouts.";
  if (p.includes('ovulat')) return "You're at your peak social energy. Stay hydrated and enjoy your natural glow.";
  if (p.includes('luteal')) return "Listen to your body. Magnesium-rich foods can help reduce bloating and mood shifts.";
  return "Track your symptoms daily to get more personalized health insights.";
}
