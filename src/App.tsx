import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  LayoutDashboard, 
  Plus, 
  User as UserIcon,
  ChevronLeft, 
  ChevronRight, 
  Droplets,
  Activity,
  Camera,
  Settings,
  Moon,
  Sun,
  Info,
  ChevronRightCircle,
  TrendingUp,
  Brain,
  Heart,
  X,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart as ReBarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, differenceInDays, subMonths, addMonths, startOfDay } from 'date-fns';
import { cn } from './lib/utils';
import { storage } from './services/storage';
import { geminiService } from './services/geminiService';
import { User, CycleData, LogEntry } from './types';
import { calculateAdvancedPrediction, getDailyTip, getFullPrediction } from './services/prediction';

const MASCOT_URL = "/mascot.png";

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'calendar' | 'insights' | 'logs' | 'profile'>('dashboard');
  const [user, setUser] = useState<User>(storage.getUser());
  const [cycles, setCycles] = useState<CycleData[]>(storage.getCycles());
  const [logs, setLogs] = useState<LogEntry[]>(storage.getLogs());
  const [showSplash, setShowSplash] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    // Clear data if requested (one-time reset for the user)
    // We check a specific flag or just do it once if needed.
    // For this turn, we'll ensure a clean slate as requested.
    const hasCleared = localStorage.getItem('luna_initial_clear_v1');
    if (!hasCleared) {
      localStorage.removeItem('lunacycle_cycles');
      localStorage.removeItem('lunacycle_logs');
      localStorage.setItem('luna_initial_clear_v1', 'true');
      setCycles([]);
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    // Safety fallback: if video hasn't finished or failed in 10 seconds, transition to the main app
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const resetData = () => {
    localStorage.removeItem('lunacycle_cycles');
    localStorage.removeItem('lunacycle_logs');
    setCycles([]);
    setLogs([]);
  };

  const saveUser = (newUser: User) => {
    storage.saveUser(newUser);
    setUser(newUser);
  };

  const syncCyclesFromLogs = (updatedLogs: LogEntry[]) => {
    // 1. Get all period starts and ends, sorted by date
    const periodStarts = updatedLogs.filter(l => l.isPeriod).sort((a, b) => a.date.localeCompare(b.date));
    const periodEnds = updatedLogs.filter(l => l.isPeriodEnd).sort((a, b) => a.date.localeCompare(b.date));

    const newCycles: CycleData[] = [];

    periodStarts.forEach((startLog, index) => {
      // Find the next period start after this one
      const nextStart = periodStarts[index + 1];
      
      // Find a period end that happens after this start but before the next start
      const matchingEnd = periodEnds.find(endLog => {
        return endLog.date >= startLog.date && (!nextStart || endLog.date < nextStart.date);
      });

      // Calculate length to next period if it exists
      let length = 0;
      if (nextStart) {
        length = differenceInDays(parseISO(nextStart.date), parseISO(startLog.date));
      }

      newCycles.push({
        id: Math.random().toString(36).substr(2, 9),
        startDate: startLog.date,
        endDate: matchingEnd?.date,
        length: length
      });
    });

    storage.saveCycles(newCycles);
    setCycles(newCycles);
  };

  const saveLog = (newLog: LogEntry) => {
    const existingLogIndex = logs.findIndex(l => l.date === newLog.date);
    let updatedLogs;
    if (existingLogIndex >= 0) {
      updatedLogs = [...logs];
      updatedLogs[existingLogIndex] = newLog;
    } else {
      updatedLogs = [...logs, newLog];
    }
    
    storage.saveLogs(updatedLogs);
    setLogs(updatedLogs);
    
    // Sync cycles based on all available logs
    syncCyclesFromLogs(updatedLogs);
  };

  const deleteLog = (logId: string) => {
    const logToDelete = logs.find(l => l.id === logId);
    if (!logToDelete) return;

    const updatedLogs = logs.filter(l => l.id !== logId);
    storage.saveLogs(updatedLogs);
    setLogs(updatedLogs);
    syncCyclesFromLogs(updatedLogs);
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-[#0F0C1D] flex flex-col items-center justify-center z-[100] overflow-hidden">
        {/* Elegant Skip Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={() => setShowSplash(false)}
          className="absolute top-6 right-6 px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white text-xs font-black uppercase tracking-widest rounded-full backdrop-blur-md transition-all border border-white/10 z-[110]"
        >
          Skip Intro
        </motion.button>

        {/* Video Intro Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full h-full flex items-center justify-center relative"
        >
          <video
            src="/introanim.mp4"
            autoPlay
            muted
            playsInline
            onEnded={() => setShowSplash(false)}
            className="w-full h-full object-cover md:object-contain"
            onError={() => {
              console.warn("Intro animation video failed to play or is empty. Falling back gracefully.");
              setShowSplash(false);
            }}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen font-sans transition-colors duration-500 pb-32",
      user.darkMode ? "bg-[#0F0C1D] text-white" : "bg-[#FDF9FF] text-gray-800"
    )}>
      {/* Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 backdrop-blur-xl z-[60] py-4 flex justify-center transition-all safe-top",
        user.darkMode ? "bg-[#0F0C1D]/80 border-b border-white/5" : "bg-[#FDF9FF]/80"
      )}>
        <div className="w-full max-w-6xl px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
               <img 
                 src={MASCOT_URL} 
                 alt="Luna" 
                 className="w-full h-full object-contain"
               />
            </div>
            <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#FF85A1] to-[#A29BFE]">LunaCycle</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveView('profile')}
              className={cn(
                "w-11 h-11 rounded-full border-2 p-0.5 overflow-hidden shadow-lg transition-transform hover:scale-105 active:scale-95",
                user.darkMode ? "border-gray-700 bg-gray-800" : "border-pink-100 bg-white"
              )}
            >
              {user.profilePic ? (
                <img src={user.profilePic} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-100 to-purple-100" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-2xl lg:max-w-6xl mx-auto transition-all duration-500">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <Dashboard user={user} cycles={cycles} logs={logs} onViewChange={setActiveView} />
          )}
          {activeView === 'calendar' && (
            <CalendarView cycles={cycles} logs={logs} user={user} onSaveLog={saveLog} onDeleteLog={deleteLog} />
          )}
          {activeView === 'logs' && (
            <LogView logs={logs} cycles={cycles} onSave={saveLog} darkMode={user.darkMode} onComplete={() => setActiveView('dashboard')} />
          )}
          {activeView === 'insights' && (
            <InsightsView 
              cycles={cycles} 
              logs={logs} 
              user={user}
              onDeleteLog={deleteLog}
              onResetData={resetData}
            />
          )}
          {activeView === 'profile' && (
            <ProfileView user={user} onSave={saveUser} onOpenSettings={() => setIsSettingsOpen(true)} />
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none safe-bottom">
        <nav className={cn(
          "rounded-[40px] shadow-2xl border px-4 py-2 flex justify-between items-center max-w-lg mx-auto pointer-events-auto transition-colors h-[72px]",
          user.darkMode 
            ? "bg-gray-900/90 border-white/10 shadow-black/50" 
            : "bg-white border-purple-50 shadow-purple-200/40"
        )}>
          <div className="flex-1 flex justify-center items-center h-full">
            <NavButton 
              active={activeView === 'dashboard'} 
              label="Home" 
              icon={LayoutDashboard}
              onClick={() => setActiveView('dashboard')} 
              darkMode={user.darkMode}
            />
          </div>
          <div className="flex-1 flex justify-center items-center h-full">
            <NavButton 
              active={activeView === 'calendar'} 
              label="Calendar" 
              icon={Calendar}
              onClick={() => setActiveView('calendar')} 
              darkMode={user.darkMode}
            />
          </div>
          
          <div className="flex-1 flex justify-center items-center relative h-full">
            <button 
              onClick={() => setActiveView('logs')}
              className="w-16 h-16 shrink-0 aspect-square bg-gradient-to-br from-[#FF85A1] to-[#A29BFE] rounded-full flex items-center justify-center -mt-10 shadow-2xl shadow-pink-300/[0.4] text-white transition-all hover:scale-110 active:scale-95 group relative z-10"
            >
              <Plus className="w-9 h-9 transition-transform group-hover:rotate-90 duration-500" />
            </button>
          </div>
          
          <div className="flex-1 flex justify-center items-center h-full">
            <NavButton 
              active={activeView === 'insights'} 
              label="Insights" 
              icon={TrendingUp}
              onClick={() => setActiveView('insights')} 
              darkMode={user.darkMode}
            />
          </div>
          <div className="flex-1 flex justify-center items-center h-full">
            <NavButton 
              active={activeView === 'profile'} 
              label="Profile" 
              icon={UserIcon}
              onClick={() => setActiveView('profile')} 
              darkMode={user.darkMode}
            />
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal 
            user={user} 
            onSave={(u) => { saveUser(u); setIsSettingsOpen(false); }} 
            onClose={() => setIsSettingsOpen(false)} 
            onReset={resetData}
          />
        )}
      </AnimatePresence>

      {/* Floating Luna AI Button */}
      {!isChatOpen && activeView !== 'logs' && (
        <motion.button 
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(true)}
          className={cn(
            "fixed right-6 bottom-28 w-14 h-14 rounded-2xl flex items-center justify-center z-[110] shadow-2xl transition-all border-2",
            user.darkMode 
              ? "bg-[#A29BFE]/90 backdrop-blur-xl border-white/10 text-white" 
              : "bg-[#A29BFE] border-white text-white"
          )}
        >
          <MessageSquare className="w-6 h-6 relative z-10" />
          <motion.div 
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-[#FF85A1] rounded-full border-2 border-white shadow-sm"
          />
        </motion.button>
      )}

      {/* Luna AI Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <LunaChat 
            onClose={() => setIsChatOpen(false)} 
            user={user} 
            cycles={cycles}
            logs={logs}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, label, icon: Icon, onClick, darkMode }: { active: boolean, label: string, icon: any, onClick: () => void, darkMode?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 group relative w-full h-full",
        active 
          ? "text-[#FF85A1]" 
          : (darkMode ? "text-gray-600 hover:text-gray-400" : "text-gray-300 hover:text-gray-500")
      )}
    >
      <div className="relative flex items-center justify-center">
        <Icon className={cn("w-6 h-6", active ? "stroke-[2.5px]" : "stroke-[2px]")} />
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-300 h-2.5 flex items-center",
        active ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-1"
      )}>{label}</span>
    </button>
  );
}

function useCycleStatus(user: User, cycles: CycleData[], logs: LogEntry[]) {
  const today = startOfDay(new Date());

  const predictions = useMemo(() => {
    const lastPeriodLog = logs.filter(l => l.isPeriod).sort((a, b) => b.date.localeCompare(a.date))[0];
    const latestCycle = cycles[cycles.length - 1];
    const lastStart = latestCycle?.startDate || lastPeriodLog?.date;

    if (!lastStart) return { futureCycles: [] };

    const futureCycles: any[] = [];
    let currentStart = lastStart;

    const currentPredicted = getFullPrediction(currentStart, user, cycles, true);
    futureCycles.push(currentPredicted);
    currentStart = currentPredicted.nextStart;

    for (let i = 0; i < 6; i++) {
      const nextCycle = getFullPrediction(currentStart, user, cycles);
      futureCycles.push(nextCycle);
      currentStart = nextCycle.nextStart;
    }

    return { futureCycles, lastStart };
  }, [cycles, logs, user]);

  const getDayStatus = (day: Date) => {
    const dNormalized = startOfDay(day);
    const dateStr = format(dNormalized, 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    const log = logs.find(l => l.date === dateStr);

    let status: string | null = null;
    if (log?.isPeriod) status = 'period-start';
    else if (log?.isPeriodEnd) status = 'period-end';
    
    const isPeriodDay = cycles.some(c => {
      const start = startOfDay(parseISO(c.startDate));
      let endCandidate = c.endDate ? startOfDay(parseISO(c.endDate)) : addDays(start, user.periodLength - 1);
      
      if (!c.endDate && dNormalized >= start && dNormalized <= today) {
        const predictedEnd = addDays(start, user.periodLength - 1);
        if (today > predictedEnd) {
          endCandidate = today;
        }
      }
      return dNormalized >= start && dNormalized <= endCandidate;
    });

    if (isPeriodDay && !status) {
      status = 'period-body';
    }

    if (!status) {
      const allowedRangeStart = startOfMonth(subMonths(today, 2));
      const allowedRangeEnd = endOfMonth(addMonths(today, 6));
      
      if (dNormalized >= allowedRangeStart && dNormalized <= allowedRangeEnd) {
        for (const fc of predictions.futureCycles) {
          const s = startOfDay(fc.start);
          const mE = startOfDay(fc.menstrualEnd);
          const pS = startOfDay(fc.proliferativeStart);
          const pE = startOfDay(fc.proliferativeEnd);
          const oS = startOfDay(fc.ovulationStart);
          const oE = startOfDay(fc.ovulationEnd);
          const secS = startOfDay(fc.secretoryStart);
          const secE = startOfDay(fc.secretoryEnd);

          if (dNormalized >= s && dNormalized <= mE) status = 'predicted-body';
          else if (dNormalized >= pS && dNormalized <= pE) status = 'predicted-follicular';
          else if (dNormalized >= oS && dNormalized <= oE) status = 'predicted-ovulation';
          else if (dNormalized >= secS && dNormalized <= secE) status = 'predicted-luteal';
          
          if (isSameDay(dNormalized, s)) status = 'predicted-start';
        }
      }
    }

    let isSafe = false;
    const isPeriodStatus = status?.includes('period') || status?.includes('menstrual') || status === 'predicted-body' || status === 'predicted-start';
    const isFertileStatus = status?.includes('fertile') || status?.includes('ovulation') || status?.includes('follicular');

    if (!isPeriodStatus && !isFertileStatus) {
      if (status === 'predicted-luteal') isSafe = true;
      else if (log?.mood === 'Safe Day') isSafe = true;
    }

    let phaseName = 'Follicular Phase';
    if (isPeriodStatus) phaseName = 'Menstrual Phase';
    else if (status?.includes('ovulation')) phaseName = 'Ovulation Phase';
    else if (status?.includes('luteal')) phaseName = 'Luteal Phase';
    else if (status?.includes('follicular')) phaseName = 'Follicular Phase';

    return { 
      status,
      phaseName,
      isSafe,
      hasSymptoms: (log?.symptoms?.length || 0) > 0,
      log,
      isConfirmedFlow: (!!log?.intensity && log.intensity !== 'None'),
      isToday: isSameDay(dNormalized, today),
      isPast: dNormalized < today
    };
  };

  const todayStatus = getDayStatus(today);
  
  // Find the cycle that contains today
  const currentPredictedCycle = predictions.futureCycles.find(fc => {
    const s = startOfDay(fc.start);
    const e = startOfDay(parseISO(fc.nextStart));
    return today >= s && today < e;
  });

  const dayInCycle = currentPredictedCycle ? differenceInDays(today, startOfDay(currentPredictedCycle.start)) + 1 : 1;
  const daysUntilNextPeriod = currentPredictedCycle ? differenceInDays(startOfDay(parseISO(currentPredictedCycle.nextStart)), today) : 0;

  return { predictions, getDayStatus, todayStatus, dayInCycle, daysUntilNextPeriod };
}

function Dashboard({ user, cycles, logs, onViewChange }: { user: User, cycles: CycleData[], logs: LogEntry[], onViewChange: (view: 'dashboard' | 'calendar' | 'insights' | 'logs' | 'profile') => void }) {
  const prediction = calculateAdvancedPrediction(user, cycles, logs);
  const { getDayStatus, todayStatus, dayInCycle, daysUntilNextPeriod } = useCycleStatus(user, cycles, logs);

  // Calculate around the current week for the "Calendar Strip"
  const today = new Date();
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(subDays(today, 3), i));

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      <div className="lg:col-span-8 space-y-6">
        {/* Current Cycle Card */}
        <div 
          onClick={() => onViewChange('calendar')}
          className={cn(
            "bg-gradient-to-br from-[#FF98B2] to-[#FFB7C5] rounded-[48px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl cursor-pointer group",
            user.darkMode ? "shadow-pink-900/20" : "shadow-pink-200"
          )}
        >
          <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 opacity-100 translate-x-4 -translate-y-4 pointer-events-none transition-transform group-hover:scale-110 duration-700">
             <img 
               src={MASCOT_URL} 
               alt="Mascot"
               className="w-full h-full object-contain opacity-20 scale-125"
             />
          </div>
          <div className="absolute -left-10 -bottom-10 w-64 h-64 md:w-96 md:h-96 opacity-15 pointer-events-none transition-transform group-hover:scale-105 duration-1000">
             <img 
               src={MASCOT_URL} 
               alt="Mascot Background"
               className="w-full h-full object-contain mix-blend-overlay rotate-12"
             />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <p className="text-white/80 font-black uppercase tracking-[0.2em] text-[10px]">
                {format(today, 'EEEE, MMMM d')}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/60 italic">Live Tracking</span>
              </div>
            </div>

            <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 leading-none">Day {dayInCycle}</h2>
            
            <div className="flex gap-2 mb-8">
              <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{todayStatus.phaseName}</span>
              <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Fertility: {prediction.fertilityStatus}</span>
            </div>

            <div className="flex justify-between items-center bg-white/10 backdrop-blur-md rounded-[32px] p-3 md:p-5 mb-8 border border-white/5">
               {weekDays.map((d, i) => {
                 const { status, isSafe, hasSymptoms } = getDayStatus(d);
                 const isToday = isSameDay(d, today);

                 return (
                   <div key={i} className="flex flex-col items-center gap-2 w-full">
                     <span className={cn(
                       "text-[8px] font-black uppercase tracking-tighter opacity-50",
                       isToday && "text-white opacity-100"
                     )}>{format(d, 'EEE')}</span>
                     <div className={cn(
                       "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-black transition-all relative",
                       isToday ? "bg-white text-[#FF85A1] shadow-lg ring-4 ring-white/10" : "text-white/90",
                       
                       // Color coding matching CalendarView themes
                       !isToday && (status === 'period-start' || status === 'period-body' || status === 'period-end' || status === 'predicted-start' || status === 'predicted-body') && "bg-red-400/30 border border-white/10",
                       !isToday && (status === 'predicted-ovulation') && "bg-green-400/30 border border-white/10",
                       !isToday && (status === 'predicted-follicular') && "bg-orange-400/20 border border-white/10",
                       !isToday && (status === 'predicted-luteal') && "bg-blue-400/20 border border-white/10",
                     )}>
                       {format(d, 'd')}
                       {isSafe && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                            <Heart className={cn("w-1.5 h-1.5 fill-white", isToday ? "fill-pink-400 text-pink-400" : "text-white")} />
                          </div>
                       )}
                       {hasSymptoms && (
                         <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full border border-[#FF85A1]" />
                       )}
                     </div>
                   </div>
                 )
               })}
            </div>

            <div className="space-y-1 mb-8">
              <p className="text-lg md:text-2xl font-black tracking-tight">Next period in {daysUntilNextPeriod} days</p>
              <p className="text-xs font-bold text-white/70 uppercase tracking-widest">
                Estimated: {format(addDays(today, daysUntilNextPeriod), 'MMM d, yyyy')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm">
               <button 
                 onClick={(e) => { e.stopPropagation(); onViewChange('logs'); }}
                 className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white py-4 rounded-2xl font-black text-sm transition-all border border-white/10 uppercase tracking-widest"
               >
                  Log Symptom
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); onViewChange('logs'); }}
                 className="bg-white text-[#FF85A1] py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-pink-900/10 uppercase tracking-widest hover:scale-105 active:scale-95"
               >
                  Start Cycle
               </button>
            </div>
          </div>
        </div>

        {/* Phase Insight on Mobile, Hidden on LG to be moved to sidebar */}
        <div className="lg:hidden">
          <PhaseInsight prediction={prediction} phaseName={todayStatus.phaseName} user={user} onViewChange={onViewChange} />
        </div>
        
        {/* Secondary Info on Mobile */}
        <div className="lg:hidden">
          <DailyTipCard phaseName={todayStatus.phaseName} user={user} onViewChange={onViewChange} />
        </div>
      </div>

      {/* Sidebar for Desktop */}
      <div className="hidden lg:block lg:col-span-4 space-y-6">
        <PhaseInsight prediction={prediction} phaseName={todayStatus.phaseName} user={user} onViewChange={onViewChange} />
        <DailyTipCard phaseName={todayStatus.phaseName} user={user} onViewChange={onViewChange} />
        
        {/* Extra Desktop Stats */}
        <div className={cn(
          "rounded-[32px] p-8 border shadow-sm",
          user.darkMode ? "bg-gray-800/20 border-white/5" : "bg-white/50 border-purple-50"
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-500">
               <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black italic">Upcoming</h3>
          </div>
          <p className="text-xs font-bold text-gray-500 mb-4 tracking-tight">Predicted for the next few days</p>
          <div className="space-y-3">
             {[1, 2, 3].map(i => {
               const d = addDays(new Date(), i);
               return (
                 <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <span className="text-xs font-black">{format(d, 'EEEE')}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(d, 'MMM d')}</span>
                 </div>
               );
             })}
          </div>
        </div>
      </div>

      <div className="lg:col-span-12">
        {/* Footer Info */}
        <div className={cn(
          "backdrop-blur-sm rounded-[32px] p-6 flex flex-col items-center justify-center gap-3 border transition-colors",
          user.darkMode ? "bg-gray-800/30 border-white/5" : "bg-white/50 border-pink-50"
        )}>
            <div className="flex items-center gap-1">
               {[1, 2, 3].map(i => (
                 <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i === 1 ? "bg-[#FF85A1]" : (user.darkMode ? "bg-gray-700" : "bg-pink-100"))} />
               ))}
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.3em]",
              user.darkMode ? "text-pink-900/50" : "text-pink-300"
            )}>Holistic Wellness Assistant</span>
        </div>
      </div>
    </motion.div>
  );
}

function PhaseInsight({ prediction, phaseName, user, onViewChange }: { prediction: any, phaseName: string, user: User, onViewChange: any }) {
  return (
    <div 
      onClick={() => onViewChange('insights')}
      className={cn(
        "rounded-[32px] p-6 border shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95",
        user.darkMode ? "bg-gray-800/50 border-white/5" : "bg-white border-purple-50"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-1",
            user.darkMode ? "text-purple-400" : "text-purple-300"
          )}>Cycle Insight</p>
          <h3 className="text-xl font-black">{phaseName}</h3>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center",
          user.darkMode ? "bg-purple-900/50 text-purple-400" : "bg-purple-50 text-purple-600"
        )}>
          <Activity className="w-5 h-5" />
        </div>
      </div>
      <div className={cn(
        "h-2.5 rounded-full w-full overflow-hidden mb-3",
        user.darkMode ? "bg-gray-700" : "bg-gray-100"
      )}>
        <motion.div 
           initial={{ width: 0 }}
           animate={{ 
             width: `${prediction.phaseProgress * 100}%`,
             opacity: [0.8, 1, 0.8]
           }}
           transition={{
             width: { duration: 1, ease: "easeOut" },
             opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" }
           }}
           className="h-full bg-gradient-to-r from-[#FF85A1] via-[#A29BFE] to-[#FF85A1] bg-[length:200%_100%]"
        />
      </div>
      <p className={cn(
        "text-[10px] font-bold leading-relaxed",
        user.darkMode ? "text-gray-400" : "text-gray-500"
      )}>
        {phaseName.includes('Menstrual') && "Healing phase. Your body is renewing itself."}
        {phaseName.includes('Follicular') && "Creative phase. High energy for new beginnings."}
        {phaseName.includes('Ovulation') && "Peak energy! The ideal time for social connections."}
        {phaseName.includes('Luteal') && "Reflective phase. Good time for introspection and self-care."}
      </p>
    </div>
  );
}

function DailyTipCard({ phaseName, user, onViewChange }: { phaseName: string, user: User, onViewChange: any }) {
  return (
    <div 
      onClick={() => onViewChange('insights')}
      className={cn(
        "rounded-[32px] p-6 border shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95",
        user.darkMode ? "bg-gray-800/50 border-white/5" : "bg-white border-blue-50"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-1",
            user.darkMode ? "text-blue-400" : "text-blue-300"
          )}>Luna's Daily Tip</p>
          <h3 className="text-xl font-black">Holistic Tip</h3>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center",
          user.darkMode ? "bg-blue-900/50 text-blue-400" : "bg-blue-50 text-blue-600"
        )}>
          <span className="text-xl">💡</span>
        </div>
      </div>
      <p className={cn(
        "text-sm font-bold leading-relaxed",
        user.darkMode ? "text-gray-300" : "text-gray-700"
      )}>
         {getDailyTip(phaseName)}
      </p>
    </div>
  );
}

function CalendarView({ cycles, logs, user, onSaveLog, onDeleteLog }: { cycles: CycleData[], logs: LogEntry[], user: User, onSaveLog: (log: LogEntry) => void, onDeleteLog: (id: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [predictionNotice, setPredictionNotice] = useState<string | null>(null);
  const { getDayStatus } = useCycleStatus(user, cycles, logs);
  
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const handleDayClick = (day: Date) => {
    const { status } = getDayStatus(day);
    if (status?.startsWith('predicted')) {
      setPredictionNotice("This is a prediction based on your cycle trend.");
    }
    setSelectedDate(day);
  };

  const selectedDayStatus = selectedDate ? getDayStatus(selectedDate) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      <div className="lg:col-span-8 space-y-6">
        <div className={cn(
          "rounded-[40px] p-6 md:p-10 shadow-sm border transition-colors",
          user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
        )}>
          <div className="flex items-center justify-between mb-10 px-2">
            <h2 className="text-3xl font-black tracking-tighter">
              {format(currentMonth, 'MMMM')} <span className="opacity-30">{format(currentMonth, 'yyyy')}</span>
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                  user.darkMode ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-50 text-gray-400 hover:text-gray-900"
                )}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                  user.darkMode ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-50 text-gray-400 hover:text-gray-900"
                )}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-3 mb-6">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={`${d}-${i}`} className="text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{d}</div>
            ))}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${currentMonth.toISOString()}-${i}`} />
            ))}
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const { status, isSafe, hasSymptoms, isConfirmedFlow } = getDayStatus(day);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div 
                  key={dateKey} 
                  className="aspect-square flex items-center justify-center relative cursor-pointer"
                  onClick={() => handleDayClick(day)}
                >
                  {isSafe && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20">
                      <Heart className="w-2.5 h-2.5 fill-pink-400 text-pink-400" />
                    </div>
                  )}
                  {hasSymptoms && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#AB47BC] rounded-full z-20 border border-white" />
                  )}
                  <div className={cn(
                    "w-full h-full max-w-[48px] max-h-[48px] rounded-full flex items-center justify-center text-sm font-black transition-all relative z-10 border-2",
                    status === 'predicted-start' && "border-red-400 border-dashed text-red-500 font-black bg-red-50/50",
                    status === 'predicted-body' && "border-red-400/30 border-dashed text-red-500/40 font-medium bg-red-50/20",
                    status === 'predicted-follicular' && "border-orange-200 border-dashed text-orange-400 bg-orange-50/30",
                    status === 'predicted-ovulation' && "border-2 border-green-400 border-dashed text-green-600 bg-green-50/50 shadow-[0_0_15px_rgba(74,222,128,0.3)]",
                    status === 'predicted-luteal' && "border-blue-200 border-dashed text-blue-400 bg-blue-50/30",
                    status === 'period-start' && "bg-red-500 border-red-600 text-white shadow-lg",
                    status === 'period-end' && "bg-red-900 border-red-950 text-white shadow-lg",
                    status === 'period-body' && "bg-red-500 border-red-600 text-white",
                    !status && (user.darkMode ? "border-transparent text-gray-500 hover:bg-white/5" : "border-transparent text-gray-400 hover:bg-pink-50"),
                    isToday && !status && !isConfirmedFlow && "border-pink-300 text-pink-500 bg-white dark:bg-gray-800",
                    isToday && (status || isConfirmedFlow) && "outline outline-2 outline-offset-2 outline-pink-500/50",
                    isToday && "shadow-[0_0_10px_rgba(233,30,99,0.3)]",
                    isSelected && "ring-4 ring-pink-100/50"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend on Mobile */}
        <div className="lg:hidden">
           <CalendarLegend user={user} />
        </div>
      </div>

      {/* Sidebar for Desktop */}
      <div className="hidden lg:block lg:col-span-4 space-y-6">
        {selectedDate && (
          <div className={cn(
            "rounded-[40px] p-8 border shadow-sm",
            user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
          )}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-2xl font-black">{format(selectedDate, 'MMM d')}</h4>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(selectedDate, 'EEEE')}</p>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                 <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
               <div className={cn(
                 "p-4 rounded-3xl border flex items-center justify-between",
                 user.darkMode ? "bg-gray-900 border-white/5" : "bg-pink-50/30 border-pink-100"
               )}>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-500">
                        <Activity className="w-5 h-5" />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest">Phase</span>
                  </div>
                  <span className="text-xs font-black text-pink-600">
                    {selectedDayStatus?.status?.replace('predicted-', '').replace('-', ' ') || 'No Prediction'}
                  </span>
               </div>

               {selectedDayStatus?.log ? (
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Daily Logs</p>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl">
                          <p className="text-[8px] font-black text-purple-300 uppercase">Mood</p>
                          <p className="text-xs font-black text-purple-600">{selectedDayStatus.log.mood}</p>
                       </div>
                       <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl">
                          <p className="text-[8px] font-black text-indigo-300 uppercase">Intensity</p>
                          <p className="text-xs font-black text-indigo-600">{selectedDayStatus.log.intensity}</p>
                       </div>
                    </div>
                    {selectedDayStatus.log.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedDayStatus.log.symptoms.map(s => (
                          <span key={s} className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 dark:border-white/5">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="text-center py-8">
                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest italic">No logs for this day</p>
                 </div>
               )}

               <button 
                 onClick={() => handleDayClick(selectedDate)}
                 className="w-full bg-[#FF3B70] text-white py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-pink-500/20 transition-transform active:scale-95"
               >
                 Open Log Details
               </button>
            </div>
          </div>
        )}
        <CalendarLegend user={user} />
      </div>

      <AnimatePresence>
        {predictionNotice && (
          <motion.div 
            key="prediction-notice"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-xl z-[200] whitespace-nowrap border border-gray-700"
          >
            {predictionNotice}
          </motion.div>
        )}
        {selectedDate && (
          <div className="lg:hidden">
            <DateDetailModal 
              key={`date-detail-${format(selectedDate, 'yyyy-MM-dd')}`}
              date={selectedDate} 
              existingLog={logs.find(l => l.date === format(selectedDate, 'yyyy-MM-dd'))}
              user={user}
              onClose={() => setSelectedDate(null)}
              onDelete={(id) => {
                onDeleteLog(id);
                setSelectedDate(null);
              }}
              onSave={(logData) => {
                const existingLog = logs.find(l => l.date === format(selectedDate, 'yyyy-MM-dd'));
                onSaveLog({
                  id: existingLog?.id || Math.random().toString(36).substr(2, 9),
                  date: format(selectedDate, 'yyyy-MM-dd'),
                  symptoms: existingLog?.symptoms || [],
                  mood: existingLog?.mood || 'Neutral',
                  ...logData,
                  isPeriod: logData.isPeriod || false,
                  isPeriodEnd: logData.isPeriodEnd || false,
                  intensity: logData.intensity || 'None'
                } as LogEntry);
                setSelectedDate(null);
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CalendarLegend({ user }: { user: User }) {
  return (
    <div className={cn(
      "rounded-[40px] p-8 border shadow-sm transition-colors",
      user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
    )}>
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6">Phase Legend</h3>
      <div className="grid grid-cols-2 gap-y-4 gap-x-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Menstruation</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-100 border border-orange-200" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proliferative</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ovulation</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-200" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Secretory</span>
        </div>
        <div className="flex items-center gap-3">
          <Heart className="w-2.5 h-2.5 fill-pink-400 text-pink-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Safe Day</span>
        </div>
        <LegendItem color="bg-[#AB47BC]" label="Symptom Dot" />
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-pink-300 bg-white dark:bg-gray-800" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Today</span>
        </div>
      </div>
    </div>
  );
}

function InsightsView({ cycles, logs, user, onDeleteLog, onResetData }: { 
  cycles: CycleData[], 
  logs: LogEntry[], 
  user: User,
  onDeleteLog: (id: string) => void,
  onResetData: () => void
}) {
  const [activeTab, setActiveTab] = useState<'trends' | 'history'>('trends');
  const [resetConfirm, setResetConfirm] = useState(false);

  // Prepare Cycle trends: only historical completed cycles
  const completedCycles = cycles.filter(c => (c.length || 0) > 0);
  const cycleTrendData = completedCycles.slice(-6).map((c) => ({
    name: format(parseISO(c.startDate), 'MMM'),
    length: c.length,
    color: '#FF85A1'
  }));

  // Prepare Period Duration Data
  const periodDurationData = completedCycles.slice(-6).map((c) => {
    const start = parseISO(c.startDate);
    const end = c.endDate ? parseISO(c.endDate) : addDays(start, user.periodLength - 1);
    const duration = differenceInDays(end, start) + 1;
    return {
      name: format(start, 'MMM d'),
      duration,
      color: '#A29BFE'
    };
  });

  // Prepare Symptom Patterns Data
  const symptomCounts: { [key: string]: number } = {};
  const symptomTimeline: { [key: string]: number[] } = {}; // symptom -> days into cycle

  logs.forEach(log => {
    log.symptoms?.forEach(s => {
      symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      
      // Find which cycle day this symptom occurred
      const cycle = cycles.find(c => {
        const start = parseISO(c.startDate);
        const logDate = parseISO(log.date);
        return logDate >= start && (!c.length || logDate < addDays(start, c.length));
      });

      if (cycle) {
        const day = differenceInDays(parseISO(log.date), parseISO(cycle.startDate)) + 1;
        if (!symptomTimeline[s]) symptomTimeline[s] = [];
        symptomTimeline[s].push(day);
      }
    });
  });

  const avgCycleLength = completedCycles.length > 0 
    ? Math.round(completedCycles.reduce((acc, c) => acc + (c.length || 0), 0) / completedCycles.length)
    : user.cycleLength;

  const cycleVariability = completedCycles.length > 1
    ? Math.max(...completedCycles.map(c => c.length || 0)) - Math.min(...completedCycles.map(c => c.length || 0))
    : 0;

  const observations = useMemo(() => {
    const obs = [];
    if (completedCycles.length >= 3) {
      if (cycleVariability <= 3) {
        obs.push({ title: "Consistency King", text: "Your cycle is very regular with low variability.", icon: Heart, color: "text-green-500" });
      } else {
        obs.push({ title: "Irregular Patterns", text: "Your cycle length varies. This is common and can be tracked for better accuracy.", icon: Activity, color: "text-orange-500" });
      }
    }

    // Symptom patterns
    Object.entries(symptomTimeline).forEach(([symptom, days]) => {
      const avgDay = days.reduce((a, b) => a + b, 0) / days.length;
      if (avgDay > 20 && avgDay < 28) {
        obs.push({ title: `PMS Alert: ${symptom}`, text: `You often track ${symptom} in your Luteal phase. Magnesium might help.`, icon: Brain, color: "text-purple-500" });
      }
    });

    if (obs.length === 0) {
      obs.push({ title: "Awaiting Data", text: "Log more cycles and symptoms to unlock personalized observations.", icon: Info, color: "text-gray-400" });
    }
    return obs.slice(0, 3);
  }, [completedCycles, cycleVariability, symptomTimeline]);

  const symptomData = Object.entries(symptomCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Prepare Mood Fluctuations Data (last 30 days)
  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(new Date(), 29 - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const log = logs.find(l => l.date === dateStr);
    
    // Convert mood to a numeric value for chart
    const moodMap: { [key: string]: number } = {
      'Happy': 5, 'Energetic': 5, 'Calm': 4, 'Neutral': 3,
      'Anxious': 2, 'Sad': 2, 'Bloated': 1, 'Angry': 1, 'Low': 1
    };
    
    return {
      date: format(d, 'MMM d'),
      mood: log ? (moodMap[log.mood] || 3) : null
    };
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter">Insights</h2>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl items-center">
          <button 
            onClick={() => setActiveTab('trends')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'trends' ? "bg-white dark:bg-gray-700 shadow-sm text-[#FF85A1]" : "text-gray-400"
            )}
          >
            Trends
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'history' ? "bg-white dark:bg-gray-700 shadow-sm text-[#FF85A1]" : "text-gray-400"
            )}
          >
            History
          </button>
        </div>
      </div>

      {activeTab === 'trends' ? (
        <div className="space-y-6">
          {/* Summary Stats Card */}
          <div className="grid grid-cols-2 gap-4">
             <div className={cn(
               "rounded-[32px] p-6 border shadow-sm",
               user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
             )}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Avg Cycle</p>
                <h4 className="text-3xl font-black">{avgCycleLength} <span className="text-xs text-gray-400 uppercase">Days</span></h4>
             </div>
             <div className={cn(
               "rounded-[32px] p-6 border shadow-sm",
               user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-purple-50"
             )}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Variability</p>
                <h4 className="text-3xl font-black">±{cycleVariability} <span className="text-xs text-gray-400 uppercase">Days</span></h4>
             </div>
          </div>

          {/* Observations Section */}
          <div className={cn(
            "rounded-[40px] p-8 border shadow-sm",
            user.darkMode ? "bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border-white/5" : "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100"
          )}>
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-white/50 dark:bg-black/20 flex items-center justify-center text-indigo-500">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black italic">Luna's Observations</h3>
             </div>
             <div className="space-y-4">
                {observations.map((obs, i) => (
                  <div key={i} className="flex gap-4 items-start">
                     <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", obs.color.replace('text', 'bg'))} />
                     <div>
                        <h4 className="text-sm font-black uppercase tracking-widest leading-none mb-1">{obs.title}</h4>
                        <p className={cn("text-xs font-medium leading-relaxed", user.darkMode ? "text-gray-400" : "text-gray-600")}>{obs.text}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={cn(
              "lg:col-span-12 rounded-[40px] p-8 border shadow-sm",
              user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-[#FF85A1]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Cycle Length</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last 6 Cycles</p>
                </div>
              </div>
              
              <div className="h-64 w-full">
                {cycleTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={cycleTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={user.darkMode ? "#333" : "#F3F4F6"} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#9CA3AF' }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '10px',
                          fontWeight: 900,
                          textTransform: 'uppercase'
                        }}
                      />
                      <Bar dataKey="length" radius={[10, 10, 10, 10]} barSize={40}>
                        {cycleTrendData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Activity className="w-8 h-8 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting data...</p>
                  </div>
                )}
              </div>
            </div>

            <div className={cn(
              "lg:col-span-12 rounded-[40px] p-8 border shadow-sm",
              user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-purple-50"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-[#A29BFE]">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Period Duration</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Days per cycle</p>
                </div>
              </div>
              
              <div className="h-64 w-full">
                {periodDurationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={periodDurationData}>
                      <defs>
                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A29BFE" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#A29BFE" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={user.darkMode ? "#333" : "#F3F4F6"} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#9CA3AF' }}
                      />
                      <YAxis hide />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="duration" 
                        stroke="#A29BFE" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorDuration)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Droplets className="w-8 h-8 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting data...</p>
                  </div>
                )}
              </div>
            </div>

            <div className={cn(
              "lg:col-span-6 rounded-[40px] p-8 border shadow-sm",
              user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-purple-50"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-[#A29BFE]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Symptoms</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Most Frequent</p>
                </div>
              </div>

              <div className="h-48 w-full">
                {symptomData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={symptomData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {symptomData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#FF85A1', '#A29BFE', '#66BB6A', '#42A5F5', '#AB47BC'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs font-bold">No symptoms logged yet</div>
                )}
              </div>
            </div>

            <div className={cn(
              "lg:col-span-6 rounded-[40px] p-8 border shadow-sm",
              user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-blue-50"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#42A5F5]">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Mood Flow</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Daily Changes</p>
                </div>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last30Days}>
                    <defs>
                      <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#42A5F5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#42A5F5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                       content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-2 rounded-lg shadow-lg border border-blue-50 text-[10px] font-black uppercase">
                              {payload[0].payload.date}: Level {payload[0].value}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="mood" 
                      stroke="#42A5F5" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorMood)" 
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
           <div className={cn(
             "rounded-[40px] p-8 border shadow-sm",
             user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
           )}>
             <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-xl font-black">Log History</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Manage your inputs</p>
               </div>
               <button 
                 onClick={() => {
                   if (resetConfirm) {
                     onResetData();
                     setResetConfirm(false);
                   } else {
                     setResetConfirm(true);
                     setTimeout(() => setResetConfirm(false), 3000);
                   }
                 }}
                 className={cn(
                   "text-[9px] font-black uppercase tracking-widest border-2 px-4 py-2 rounded-xl transition-all",
                   resetConfirm ? "bg-red-500 border-red-500 text-white" : "text-[#FF3B70] border-[#FF3B70]/20"
                 )}
               >
                 {resetConfirm ? 'Confirm Reset?' : 'Clear All'}
               </button>
             </div>

             <div className="space-y-3">
               {logs.length === 0 ? (
                 <div className="py-10 text-center text-gray-400 font-bold text-xs">No entries found</div>
               ) : (
                 [...logs].sort((a, b) => b.date.localeCompare(a.date)).map(log => {
                    const isBetween = cycles.some(c => {
                      if (!c.endDate) return false;
                      const d = parseISO(log.date);
                      const s = parseISO(c.startDate);
                      const e = parseISO(c.endDate);
                      return d > s && d < e;
                    });
                    const isConfirmed = isBetween && (!!log.intensity && log.intensity !== 'None');
                    return (
                   <div key={log.id} className={cn(
                     "p-5 rounded-3xl border flex items-center justify-between group transition-all",
                     user.darkMode ? "bg-gray-900/50 border-white/5" : "bg-gray-50 border-white"
                   )}>
                     <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          log.isPeriod ? "bg-[#E91E63] text-white" : log.isPeriodEnd ? "bg-[#880E4F] text-white" : isConfirmed ? "bg-[#F8BBD0] text-[#E91E63]" : (user.darkMode ? "bg-gray-800 text-gray-500" : "bg-white text-gray-400 shadow-sm")
                        )}>
                          <Droplets className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-sm font-black">{format(parseISO(log.date), 'MMM d, yyyy')}</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                             {log.mood} • {log.symptoms.length} Symptoms {isConfirmed && "• Confirmed Flow"}
                           </p>
                        </div>
                     </div>
                     <button 
                       onClick={() => {
                         if (confirm('Delete this entry?')) {
                           onDeleteLog(log.id);
                         }
                       }}
                       className="p-3 rounded-2xl bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                    );
                  })
               )}
             </div>
           </div>
        </div>
      )}
    </motion.div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
    </div>
  );
}

function DateDetailModal({ date, existingLog, user, onClose, onSave, onDelete }: { 
  date: Date, 
  existingLog?: LogEntry, 
  user: User,
  onClose: () => void, 
  onSave: (data: Partial<LogEntry>) => void,
  onDelete: (id: string) => void
}) {
  const [isPeriod, setIsPeriod] = useState(existingLog?.isPeriod || false);
  const [isPeriodEnd, setIsPeriodEnd] = useState(existingLog?.isPeriodEnd || false);
  const [intensity, setIntensity] = useState(existingLog?.intensity || 'None');
  const [notes, setNotes] = useState(existingLog?.notes || '');
  const [isSafeDay, setIsSafeDay] = useState(existingLog?.mood === 'Safe Day');
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms || []);

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (deleteConfirm) {
      const timer = setTimeout(() => setDeleteConfirm(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirm]);

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Acne', 'Fatigue'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "w-full max-w-sm rounded-[40px] p-8 relative overflow-hidden",
          user.darkMode ? "bg-[#1A1633] text-white" : "bg-white text-gray-900"
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
        
        <div className="mb-6">
          <h3 className="text-2xl font-black tracking-tighter">{format(date, 'MMMM d, yyyy')}</h3>
          <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mt-1">Log Daily Details</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { setIsPeriod(!isPeriod); if(!isPeriod) setIsPeriodEnd(false); }}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all",
                isPeriod 
                  ? "border-[#E91E63] bg-[#E91E63]/5 text-[#E91E63]" 
                  : (user.darkMode ? "border-white/5 bg-gray-900 text-gray-600" : "border-gray-50 bg-gray-50 text-gray-400")
              )}
            >
              <Droplets className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Period Start</span>
            </button>
            <button 
              onClick={() => { setIsPeriodEnd(!isPeriodEnd); if(!isPeriodEnd) setIsPeriod(false); }}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all",
                isPeriodEnd 
                  ? "border-[#42A5F5] bg-blue-500/5 text-[#42A5F5]" 
                  : (user.darkMode ? "border-white/5 bg-gray-900 text-gray-600" : "border-gray-50 bg-gray-50 text-gray-400")
              )}
            >
              <ChevronRightCircle className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Period End</span>
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block text-center">Flow Intensity</label>
            <div className="flex gap-2">
              {['None', 'Light', 'Medium', 'Heavy'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setIntensity(lvl as any)}
                  className={cn(
                    "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    intensity === lvl 
                      ? "bg-[#E91E63] text-white shadow-lg" 
                      : (user.darkMode ? "bg-gray-900 text-gray-600" : "bg-gray-50 text-gray-400")
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block ml-2">Symptoms</label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map(s => (
                <button 
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    symptoms.includes(s)
                      ? "bg-[#AB47BC] text-white"
                      : (user.darkMode ? "bg-gray-900 text-gray-600" : "bg-gray-50 text-gray-400")
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <textarea 
            placeholder="Daily notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(
              "w-full border-none rounded-2xl p-4 text-sm h-24 focus:ring-2 transition-all placeholder:text-gray-300 font-medium",
              user.darkMode ? "bg-gray-900 text-white focus:ring-purple-900/50" : "bg-gray-50 text-gray-800 focus:ring-pink-100"
            )}
          />

          <div className="space-y-3">
             <button 
               onClick={() => onSave({ isPeriod, isPeriodEnd, intensity, notes, symptoms, mood: isSafeDay ? 'Safe Day' : 'Neutral' })}
               className="w-full bg-gradient-to-r from-[#FF85A1] to-[#A29BFE] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95"
             >
               Save Details
             </button>
             
             <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsSafeDay(!isSafeDay)}
                className={cn(
                  "p-4 rounded-3xl border-2 transition-all flex items-center justify-center gap-2",
                  isSafeDay 
                    ? "border-pink-300 bg-pink-50 text-[#E91E63]" 
                    : (user.darkMode ? "border-white/5 bg-gray-900 text-gray-600" : "border-gray-50 bg-gray-50 text-gray-400")
                )}
              >
                <Heart className="w-4 h-4 fill-pink-400 text-pink-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-inherit">Safe</span>
              </button>
              {existingLog && (
                <button 
                  onClick={() => {
                    if (deleteConfirm) {
                      onDelete(existingLog.id);
                      setDeleteConfirm(false);
                    } else {
                      setDeleteConfirm(true);
                    }
                  }}
                  className={cn(
                    "py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95",
                    deleteConfirm 
                      ? "bg-red-500 text-white border-red-600" 
                      : (user.darkMode ? "bg-red-900/40 text-red-400 border border-red-500/20" : "bg-red-50 text-red-500 border border-red-100")
                  )}
                >
                  {deleteConfirm ? 'Confirm?' : 'Delete'}
                </button>
              )}
              {!existingLog && (
                <button 
                  onClick={onClose}
                  className={cn(
                    "py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    user.darkMode ? "bg-gray-900 text-gray-500" : "bg-gray-50 text-gray-400"
                  )}
                >
                  Cancel
                </button>
              )}
             </div>
             {existingLog && (
                <button 
                  onClick={onClose}
                  className={cn(
                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    user.darkMode ? "bg-gray-900 text-gray-500" : "bg-gray-50 text-gray-400"
                  )}
                >
                  Cancel
                </button>
             )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LogView({ logs, cycles, onSave, darkMode, onComplete }: { logs: LogEntry[], cycles: CycleData[], onSave: (log: LogEntry) => void, darkMode?: boolean, onComplete: () => void }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState('Neutral');
  const [intensity, setIntensity] = useState<LogEntry['intensity']>('None');
  const [isPeriod, setIsPeriod] = useState(false);
  const [isPeriodEnd, setIsPeriodEnd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const existing = logs.find(l => l.date === date);
    if (existing) {
      setSymptoms(existing.symptoms || []);
      setMood(existing.mood || 'Neutral');
      setIntensity(existing.intensity || 'None');
      setIsPeriod(existing.isPeriod || false);
      setIsPeriodEnd(existing.isPeriodEnd || false);
    } else {
      setSymptoms([]);
      setMood('Neutral');
      setIntensity('None');
      setIsPeriod(false);
      setIsPeriodEnd(false);
    }
  }, [date, logs]);

  const isBetweenStartEnd = cycles.some(c => {
    if (!c.endDate) return false;
    const d = parseISO(date);
    const s = parseISO(c.startDate);
    const e = parseISO(c.endDate);
    return d > s && d < e;
  });

  const isConfirmedFlow = (intensity && intensity !== 'None') && isBetweenStartEnd;

  const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Acne', 'Fatigue', 'Backache', 'Nausea'];
  const MOODS = ['Happy', 'Sad', 'Angry', 'Anxious', 'Neutral', 'Calm', 'Bloated', 'Energetic', 'Low'];

  const handleToggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
        onSave({ 
          id: Math.random().toString(36).substr(2, 9), 
          date, 
          symptoms, 
          mood, 
          intensity,
          isPeriod, 
          isPeriodEnd 
        });
        setIsSaving(false);
        onComplete();
    }, 800);
  };

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="space-y-10"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter">Fast Log</h2>
        <button 
          onClick={onComplete}
          className="text-[10px] font-black uppercase tracking-widest text-[#FF3B70]"
        >
          Cancel
        </button>
      </div>
      
      <div className={cn(
        "rounded-[48px] p-10 shadow-sm border space-y-12",
        darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
      )}>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-4 block">Select Date</label>
          <input 
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(
                "w-full border-none rounded-3xl p-6 text-sm font-black focus:ring-4 transition-all outline-none",
                darkMode ? "bg-gray-900 focus:ring-purple-900/50" : "bg-gray-50 focus:ring-pink-100"
            )}
          />
        </div>

        <div className="space-y-4">
            {/* Period Start */}
            <div className={cn(
                "flex items-center justify-between p-6 rounded-[32px] border",
                darkMode ? "bg-gray-900 border-white/5" : "bg-pink-50/50 border-pink-100"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-14 h-14 rounded-3xl flex items-center justify-center transition-all shadow-lg",
                        isPeriod ? "bg-[#FF3B70] text-white" : 
                        isPeriodEnd ? "bg-[#880E4F] text-white" :
                        isConfirmedFlow ? "bg-[#F8BBD0] text-[#E91E63]" :
                        "bg-white text-[#FF3B70]"
                    )}>
                        <Droplets className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">
                          {isPeriod ? "Cycle Start" : isPeriodEnd ? "Cycle End" : isConfirmedFlow ? "Confirmed Flow" : "Cycle Tracking"}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          {isConfirmedFlow ? "Verified intensity" : "Toggle if today"}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { setIsPeriod(!isPeriod); if(!isPeriod) setIsPeriodEnd(false); }}
                    className={cn(
                    "w-14 h-8 rounded-full p-1 transition-all flex border border-transparent shadow-inner",
                    isPeriod ? "bg-[#FF3B70] justify-end" : "bg-gray-200 justify-start dark:bg-gray-700"
                    )}
                >
                    <div className="w-6 h-6 bg-white rounded-full shadow-md" />
                </button>
            </div>

            {/* Period End */}
            <div className={cn(
                "flex items-center justify-between p-6 rounded-[32px] border",
                darkMode ? "bg-gray-900 border-white/5" : "bg-blue-50/50 border-blue-100"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-14 h-14 rounded-3xl flex items-center justify-center transition-all shadow-lg",
                        isPeriodEnd ? "bg-blue-500 text-white" : "bg-white text-blue-500"
                    )}>
                        <ChevronRightCircle className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">Period End?</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Mark flow finished</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setIsPeriodEnd(!isPeriodEnd); if(!isPeriodEnd) setIsPeriod(false); }}
                    className={cn(
                    "w-14 h-8 rounded-full p-1 transition-all flex border border-transparent shadow-inner",
                    isPeriodEnd ? "bg-blue-500 justify-end" : "bg-gray-200 justify-start dark:bg-gray-700"
                    )}
                >
                    <div className="w-6 h-6 bg-white rounded-full shadow-md" />
                </button>
            </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6 block text-center">Intensity</label>
          <div className="flex gap-2">
            {['None', 'Light', 'Medium', 'Heavy'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setIntensity(lvl as any)}
                className={cn(
                  "flex-1 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                  intensity === lvl 
                    ? "bg-[#E91E63] border-[#E91E63] text-white shadow-xl" 
                    : "bg-gray-50 border-transparent text-gray-400 dark:bg-gray-900 dark:text-gray-500"
                )}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6 block">Symptoms</label>
          <div className="flex flex-wrap gap-2.5">
            {SYMPTOMS.map(s => (
              <button
                key={s}
                onClick={() => handleToggleSymptom(s)}
                className={cn(
                  "px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                  symptoms.includes(s) 
                    ? "bg-[#8E44AD] border-[#8E44AD] text-white shadow-xl shadow-purple-500/20" 
                    : "bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-500 dark:hover:bg-gray-800"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6 block">Mood</label>
          <div className="grid grid-cols-3 gap-3">
            {MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={cn(
                  "py-5 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                  mood === m 
                    ? "bg-gray-900 border-gray-900 text-white shadow-xl dark:bg-white dark:text-gray-900" 
                    : "bg-gray-50 border-transparent text-gray-400 dark:bg-gray-900 dark:text-gray-500"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-[#FF3B70] text-white py-6 rounded-[32px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-pink-500/30 hover:scale-[1.02] active:scale-95 transition-all mt-6 flex items-center justify-center"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Save Log Entry"
          )}
        </button>
      </div>
    </motion.div>
  );
}

function ProfileView({ user, onSave, onOpenSettings }: { user: User, onSave: (u: User) => void, onOpenSettings: () => void }) {
  const [profilePic, setProfilePic] = useState(user.profilePic || '');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfilePic(result);
        onSave({ ...user, profilePic: result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black tracking-tighter">Your profile</h2>
        <button 
          onClick={onOpenSettings}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg border",
            user.darkMode ? "bg-gray-800 border-white/5 text-purple-400" : "bg-white border-purple-50 text-purple-600"
          )}
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>
      
      <div className={cn(
        "rounded-[48px] p-10 shadow-sm border space-y-12",
        user.darkMode ? "bg-gray-800/40 border-white/5" : "bg-white border-pink-50"
      )}>
         <div className="flex flex-col items-center gap-6">
            <div className="relative w-40 h-40">
              <div className={cn(
                  "w-full h-full rounded-[56px] border-8 overflow-hidden flex items-center justify-center transition-all shadow-2xl",
                  user.darkMode ? "bg-gray-900 border-gray-800 shadow-black/40" : "bg-pink-50 border-white shadow-pink-100/50"
              )}>
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-16 h-16 text-pink-200" />
                )}
              </div>
              <label className="absolute bottom-1 -right-1 w-12 h-12 bg-gray-900 border-4 border-white text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform active:scale-95">
                <Camera className="w-6 h-6" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
            <div className="text-center">
               <h3 className="text-2xl font-black mb-1">{user.name}</h3>
               <button 
                 onClick={() => {
                    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                 }}
                 className={cn(
                   "text-[11px] font-black uppercase tracking-[0.3em] hover:opacity-70 transition-opacity",
                   user.darkMode ? "text-purple-400" : "text-[#FF85A1]"
                 )}
               >
                 Reset App Data
               </button>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div className={cn(
                "p-6 rounded-[32px] border text-center transition-all",
                user.darkMode ? "bg-gray-900 border-white/5" : "bg-pink-50/30 border-pink-50"
            )}>
                <p className="text-[10px] font-black text-gray-400 mb-1">AVERAGE CYCLE</p>
                <p className="text-2xl font-black">{user.cycleLength}d</p>
            </div>
            <div className={cn(
                "p-6 rounded-[32px] border text-center transition-all",
                user.darkMode ? "bg-gray-900 border-white/5" : "bg-purple-50/30 border-purple-50"
            )}>
                <p className="text-[10px] font-black text-gray-400 mb-1">AVERAGE PERIOD</p>
                <p className="text-2xl font-black">{user.periodLength}d</p>
            </div>
         </div>

         <div className="space-y-4">
            <button 
                onClick={onOpenSettings}
                className="w-full bg-[#FF3B70] text-white py-6 rounded-[32px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
                Edit Cycle Profile
            </button>
         </div>
      </div>
    </motion.div>
  );
}

function SettingsModal({ user, onSave, onClose, onReset }: { user: User, onSave: (u: User) => void, onClose: () => void, onReset?: () => void }) {
    const [name, setName] = useState(user.name);
    const [age, setAge] = useState(user.age || 25);
    const [cycleLength, setCycleLength] = useState(user.cycleLength);
    const [periodLength, setPeriodLength] = useState(user.periodLength);
    const [isIrregular, setIsIrregular] = useState(user.isIrregular || false);
    const [resetConfirm, setResetConfirm] = useState(false);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md overflow-y-auto"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={cn(
                    "w-full max-w-md rounded-[40px] sm:rounded-[56px] shadow-2xl p-8 sm:p-10 relative my-auto",
                    user.darkMode ? "bg-[#1A1633] text-white" : "bg-white text-gray-900"
                )}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-3xl font-black tracking-tighter">Settings</h3>
                    <div 
                        onClick={() => onSave({ ...user, darkMode: !user.darkMode })}
                        className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all",
                            user.darkMode ? "bg-gray-800 text-yellow-400" : "bg-gray-100 text-gray-400"
                        )}
                    >
                        {user.darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">Display Name</label>
                            <input 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={cn(
                                    "w-full border-none rounded-3xl p-6 text-sm font-black focus:ring-4 transition-all outline-none",
                                    user.darkMode ? "bg-gray-900 focus:ring-purple-900/50" : "bg-gray-50 focus:ring-pink-100"
                                )}
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">Your Age</label>
                            <input 
                                type="number"
                                value={age}
                                onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                                className={cn(
                                    "w-full border-none rounded-3xl p-6 text-sm font-black focus:ring-4 transition-all outline-none",
                                    user.darkMode ? "bg-gray-900 focus:ring-purple-900/50" : "bg-gray-50 focus:ring-pink-100"
                                )}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">Cycle Type</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setIsIrregular(false)}
                                className={cn(
                                    "py-5 rounded-3xl text-[10px] font-black tracking-widest uppercase transition-all",
                                    !isIrregular ? "bg-gray-900 text-white shadow-xl dark:bg-white dark:text-gray-900" : "bg-gray-50 text-gray-400 dark:bg-gray-900"
                                )}
                            >
                                Regular
                            </button>
                            <button 
                                onClick={() => setIsIrregular(true)}
                                className={cn(
                                    "py-5 rounded-3xl text-[10px] font-black tracking-widest uppercase transition-all",
                                    isIrregular ? "bg-[#8E44AD] text-white shadow-xl" : "bg-gray-50 text-gray-400 dark:bg-gray-900"
                                )}
                            >
                                Irregular
                            </button>
                        </div>
                    </div>

                    <div className={cn("grid grid-cols-2 gap-6 transition-all duration-300", isIrregular ? "opacity-30 pointer-events-none grayscale" : "opacity-100")}>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">Cycle (Days)</label>
                            <input 
                                type="number"
                                value={cycleLength}
                                onChange={(e) => setCycleLength(parseInt(e.target.value) || 0)}
                                disabled={isIrregular}
                                className={cn(
                                    "w-full border-none rounded-3xl p-6 text-sm font-black focus:ring-4 outline-none",
                                    user.darkMode ? "bg-gray-900" : "bg-gray-50"
                                )}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">Period (Days)</label>
                            <input 
                                type="number"
                                value={periodLength}
                                onChange={(e) => setPeriodLength(parseInt(e.target.value) || 0)}
                                disabled={isIrregular}
                                className={cn(
                                    "w-full border-none rounded-3xl p-6 text-sm font-black focus:ring-4 outline-none",
                                    user.darkMode ? "bg-gray-900" : "bg-gray-50"
                                )}
                            />
                        </div>
                    </div>

                    {isIrregular && (
                        <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-[9px] font-black uppercase tracking-widest text-[#8E44AD] text-center"
                        >
                            Irregular: Luna uses historical logs for accurate predictions
                        </motion.p>
                    )}

                    <div className="pt-2">
                        <button 
                            onClick={() => {
                                if (resetConfirm) {
                                    onReset && onReset();
                                    setResetConfirm(false);
                                } else {
                                    setResetConfirm(true);
                                    setTimeout(() => setResetConfirm(false), 3000);
                                }
                            }}
                            className={cn(
                                "w-full py-4 rounded-[24px] text-[10px] font-black tracking-widest uppercase transition-all border-2",
                                resetConfirm 
                                    ? "bg-red-500 border-red-500 text-white shadow-lg" 
                                    : (user.darkMode ? "border-red-900/30 text-red-400 hover:bg-red-900/10" : "border-red-100 text-red-500 hover:bg-red-50")
                            )}
                        >
                            {resetConfirm ? 'Confirm Complete Reset?' : 'Reset Data'}
                        </button>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button 
                            onClick={onClose}
                            className={cn(
                                "flex-1 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] border transition-all",
                                user.darkMode ? "bg-gray-800 border-white/5 text-gray-400" : "bg-white border-gray-100 text-gray-400"
                            )}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => onSave({ ...user, name, age, cycleLength, periodLength, isIrregular })}
                            className="flex-[1.5] bg-[#FF3B70] text-white py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-pink-500/20"
                        >
                            Apply Changes
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

function LunaChat({ onClose, user, cycles, logs }: { onClose: () => void, user: User, cycles: CycleData[], logs: LogEntry[] }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>(() => storage.getChatHistory());
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    storage.saveChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, parts: [{ text: userMessage }] }];
    setMessages(newMessages);
    setIsLoading(true);

    // Calculate current phase and day for context
    let currentPhase = 'Follicular Phase';
    let dayInCycle = 'Unknown';
    const today = startOfDay(new Date());
    const lastPeriodLog = logs.filter(l => l.isPeriod).sort((a, b) => b.date.localeCompare(a.date))[0];
    const latestCycle = cycles[cycles.length - 1];
    const lastStart = latestCycle?.startDate || lastPeriodLog?.date;

    if (lastStart) {
      const pred = getFullPrediction(lastStart, user, cycles, true);
      if (today >= startOfDay(pred.start) && today <= startOfDay(pred.menstrualEnd)) currentPhase = 'Menstrual Phase';
      else if (today >= startOfDay(pred.proliferativeStart) && today <= startOfDay(pred.proliferativeEnd)) currentPhase = 'Follicular Phase';
      else if (today >= startOfDay(pred.ovulationStart) && today <= startOfDay(pred.ovulationEnd)) currentPhase = 'Ovulation Phase';
      else if (today >= startOfDay(pred.secretoryStart) && today <= startOfDay(pred.secretoryEnd)) currentPhase = 'Luteal Phase';

      dayInCycle = (differenceInDays(today, startOfDay(parseISO(lastStart))) + 1).toString();
    }

    const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const symptoms = Array.from(new Set(recentLogs.flatMap(l => l.symptoms || [])));

    try {
      const data = await geminiService.chat(userMessage, messages, {
        user,
        cycles,
        logs,
        currentPhase,
        dayInCycle,
        symptoms,
        today: format(today, 'MMMM do, yyyy')
      });

      if (data.text) {
        setMessages([...newMessages, { role: 'model', parts: [{ text: data.text }] }]);
      } else {
        setMessages([...newMessages, { role: 'model', parts: [{ text: "I'm sorry, I encountered an issue. Please try again." }] }]);
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages([...newMessages, { role: 'model', parts: [{ text: "Oops! Something went wrong while connecting with Luna." }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 100, scale: 0.9, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, y: 100, scale: 0.9, x: 20 }}
      className="fixed bottom-24 right-4 z-[200] w-[calc(100%-32px)] sm:w-[400px]"
    >
      <div className={cn(
        "rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden border border-white/5 h-[500px] sm:h-[600px]",
        user.darkMode 
          ? "bg-[#0F0C1D]/95 backdrop-blur-2xl" 
          : "bg-white shadow-purple-100"
      )}>
        {/* Chat Header */}
        <div className={cn(
           "px-6 py-4 flex items-center justify-between border-b",
           user.darkMode ? "bg-gray-900/50 border-white/5" : "bg-purple-50/30 border-purple-50"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF3B70] to-[#A29BFE] rounded-xl flex items-center justify-center shadow-lg relative shrink-0">
               <img src={MASCOT_URL} alt="Luna" className="w-6 h-6 object-contain" />
               <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <h3 className="text-base font-black">Luna AI</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Assistant</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={cn(
              "p-2 rounded-xl transition-all",
              user.darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-100 shadow-sm"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-6 pt-4">
               <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/10 rounded-[24px] flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-[#A29BFE]" />
               </div>
               <div>
                 <h4 className="text-lg font-black leading-tight">Hi {user.name}!</h4>
                 <p className={cn(
                   "text-[11px] font-medium leading-relaxed mt-1",
                   user.darkMode ? "text-gray-400" : "text-gray-500"
                 )}>
                   Need help understanding your cycle? Ask me!
                 </p>
               </div>
               <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                  {['Bloating tips', 'Mood help', 'Seed cycling'].map(suggestion => (
                    <button 
                      key={suggestion}
                      onClick={() => { setInput(suggestion); }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                        user.darkMode ? "border-white/10 hover:bg-white/5" : "border-purple-50 hover:bg-purple-50 text-[#A29BFE]"
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
               </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn(
              "flex flex-col max-w-[85%] space-y-1",
              m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}>
              <div className={cn(
                "p-4 rounded-[20px] text-xs font-medium leading-relaxed",
                m.role === 'user' 
                  ? "bg-[#A29BFE] text-white rounded-tr-none shadow-sm" 
                  : (user.darkMode ? "bg-gray-800 text-gray-200 rounded-tl-none border border-white/5" : "bg-gray-100 text-gray-800 rounded-tl-none")
              )}>
                {m.parts[0].text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex flex-col items-start max-w-[85%]">
               <div className={cn(
                 "p-4 rounded-[20px] rounded-tl-none border flex items-center gap-1.5",
                 user.darkMode ? "bg-gray-800 border-white/5" : "bg-gray-100"
               )}>
                 {[1, 2, 3].map(i => (
                   <motion.div 
                     key={i}
                     animate={{ opacity: [0.3, 1, 0.3], y: [0, -1, 0] }}
                     transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                     className="w-1 h-1 rounded-full bg-gray-400"
                   />
                 ))}
               </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className={cn(
          "p-6 border-t",
          user.darkMode ? "border-white/5 bg-gray-900/30" : "border-purple-50 bg-purple-50/10"
        )}>
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Ask Luna..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className={cn(
                "flex-1 border-none rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 outline-none transition-all",
                user.darkMode ? "bg-gray-800 focus:ring-[#A29BFE]/30" : "bg-white shadow-sm focus:ring-purple-50"
              )}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                isLoading || !input.trim() 
                  ? "bg-gray-200 text-gray-400 dark:bg-gray-800" 
                  : "bg-[#A29BFE] text-white shadow-md active:scale-95"
              )}
            >
              <TrendingUp className="w-5 h-5 rotate-90" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

