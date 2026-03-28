import { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, addSeconds, isAfter, parse, differenceInSeconds } from 'date-fns';
import { Sun, Moon, Clock, X, RefreshCw, Copy, Maximize, Minimize, Smartphone, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchPrayerTimesFromSpreadsheet } from './services/spreadsheetService';

// Configuration
const MASJID_NAME = "MASJIDUL AKBAR JUMMAH MASJID MABERIYA";
const COUNTRY = "Sri Lanka";

// Iqamah Intervals (minutes after Azan)
const IQAMAH_OFFSETS: Record<string, number> = {
  Fajr: 30,
  Dhuhr: 14,
  Asr: 14,
  Maghrib: 12,
  Isha: 14,
};

interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timings, setTimings] = useState<PrayerTimings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const SHARED_URL = window.location.origin;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Helper to calculate Iqamah time string from Azan time string
  const getIqamahTime = (azanTimeStr: string, prayerName: string, date: Date) => {
    if (!azanTimeStr) return '';
    let offset = IQAMAH_OFFSETS[prayerName] || 0;
    
    // Friday Dhuhr (Jummah) logic: 40 minutes offset
    if (prayerName === "Dhuhr" && date.getDay() === 5) {
      offset = 40;
    }

    try {
      // Parse the Azan time string (e.g., "5:04 AM")
      const azanDate = parse(azanTimeStr, 'h:mm a', date);
      if (isNaN(azanDate.getTime())) return '';
      const iqamahDate = addMinutes(azanDate, offset);
      return format(iqamahDate, 'h:mm a');
    } catch (e) {
      console.error(`Error parsing time: ${azanTimeStr}`, e);
      return '';
    }
  };

  // Helper to remove AM/PM for display
  const stripAMPM = (timeStr?: string) => {
    if (!timeStr) return '';
    return timeStr.replace(/\s*[AP]M\s*$/i, '').trim();
  };

  // Determine if we should show the Saf (row) alignment screen
  const showSafScreen = useMemo(() => {
    if (!timings) return false;
    const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const now = currentTime;

    for (const name of prayers) {
      // Skip for Jummah (Friday Dhuhr)
      if (name === "Dhuhr" && now.getDay() === 5) continue;

      const azanTimeStr = timings[name as keyof PrayerTimings];
      if (!azanTimeStr) continue;
      const iqamahTimeStr = getIqamahTime(azanTimeStr, name, now);
      if (!iqamahTimeStr) continue;
      
      const azanTime = parse(azanTimeStr, 'h:mm a', now);
      const iqamahTime = parse(iqamahTimeStr, 'h:mm a', now);
      
      if (isNaN(azanTime.getTime()) || isNaN(iqamahTime.getTime())) continue;
      
      // Show for 20 seconds after Iqamah
      const twentySecAfter = addSeconds(iqamahTime, 20);
      if (isAfter(now, iqamahTime) && isAfter(twentySecAfter, now)) {
        return true;
      }
    }
    return false;
  }, [timings, currentTime]);

  // Determine if we should show the Switch Off Mobile screen
  const showMobileOffScreen = useMemo(() => {
    if (!timings) return false;
    const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const now = currentTime;

    for (const name of prayers) {
      // Skip for Jummah (Friday Dhuhr)
      if (name === "Dhuhr" && now.getDay() === 5) continue;

      const azanTimeStr = timings[name as keyof PrayerTimings];
      if (!azanTimeStr) continue;
      const iqamahTimeStr = getIqamahTime(azanTimeStr, name, now);
      if (!iqamahTimeStr) continue;
      
      const azanTime = parse(azanTimeStr, 'h:mm a', now);
      const iqamahTime = parse(iqamahTimeStr, 'h:mm a', now);
      
      if (isNaN(azanTime.getTime()) || isNaN(iqamahTime.getTime())) continue;
      
      // Show for 40 seconds AFTER the Saf Screen (from 20 to 60 seconds after Iqamah)
      const twentySecAfter = addSeconds(iqamahTime, 20);
      const sixtySecAfter = addSeconds(iqamahTime, 60);
      if (isAfter(now, twentySecAfter) && isAfter(sixtySecAfter, now)) {
        return true;
      }
    }
    return false;
  }, [timings, currentTime]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch prayer times on day change and every 12 hours
  const todayStr = format(currentTime, 'yyyy-MM-dd');
  useEffect(() => {
    const fetchPrayerTimes = async () => {
      setIsRefreshing(true);
      try {
        const timings = await fetchPrayerTimesFromSpreadsheet(currentTime);
        setTimings(timings);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error("Spreadsheet Fetch Error:", err);
        setError(`Could not load prayer times from spreadsheet: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchPrayerTimes();
    const interval = setInterval(fetchPrayerTimes, 43200000); // 12-hour fallback
    return () => clearInterval(interval);
  }, [todayStr]);

  // Calculate Next Prayer
  const nextPrayer = useMemo(() => {
    if (!timings) return null;

    const prayers = [
      { name: "Fajr", time: timings.Fajr },
      { name: "Dhuhr", time: timings.Dhuhr },
      { name: "Asr", time: timings.Asr },
      { name: "Maghrib", time: timings.Maghrib },
      { name: "Isha", time: timings.Isha },
    ];

    const now = currentTime;

    for (const prayer of prayers) {
      if (!prayer.time) continue;
      const azanTime = parse(prayer.time, 'h:mm a', now);
      const iqamahTimeStr = getIqamahTime(prayer.time, prayer.name, now);
      if (!iqamahTimeStr) continue;
      const iqamahTime = parse(iqamahTimeStr, 'h:mm a', now);

      if (isNaN(azanTime.getTime()) || isNaN(iqamahTime.getTime())) continue;

      if (isAfter(azanTime, now) || isAfter(iqamahTime, now)) {
        let countdown = null;
        if (isAfter(now, azanTime) && isAfter(iqamahTime, now)) {
          const diff = differenceInSeconds(iqamahTime, now);
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          countdown = `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        let prayerName = prayer.name;
        if (now.getDay() === 5 && prayer.name === "Dhuhr" && countdown) {
          prayerName = "Salatul-Jumuah";
        }

        return { 
          name: prayerName, 
          azan: prayer.time, 
          iqamah: iqamahTimeStr,
          countdown,
          date: now
        };
      }
    }

    // Default to Fajr tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iqamahFajr = getIqamahTime(timings.Fajr, "Fajr", tomorrow);
    return { name: "Fajr", azan: timings.Fajr, iqamah: iqamahFajr, date: tomorrow };
  }, [timings, currentTime]);

  if (loading) return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'} flex items-center justify-center text-4xl font-bold`}>
      Loading Dashboard...
    </div>
  );

  return (
    <div className={`h-screen w-screen ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'} font-mono overflow-hidden flex flex-col p-[4vh] md:p-[5vh] select-none transition-colors duration-300`}>
      {/* Saf Alignment Screen Overlay */}
      <AnimatePresence>
        {showSafScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-10 text-center ${isDarkMode ? 'bg-black' : 'bg-white'}`}
          >
            <div className="max-w-5xl w-full space-y-12">
              {/* Arabic Text */}
              <motion.h2 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`text-[6vh] font-bold leading-relaxed ${isDarkMode ? 'text-[#00FF00]' : 'text-[#008000]'}`}
                dir="rtl"
              >
                سَوُّوا صُفُوفَكُمْ فَإِنَّ تَسْوِيَةَ الصُّفُوفِ مِنْ إِقَامَةِ الصَّلاَةِ
              </motion.h2>

              {/* Animation: 3 People coming together */}
              <div className="flex justify-center items-center gap-20 h-[20vh] relative">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ x: (i - 1) * 200, opacity: 0 }}
                    animate={{ x: (i - 1) * 5, opacity: 1 }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      repeatType: "reverse",
                      ease: "easeInOut",
                      delay: i * 0.2
                    }}
                    className={`w-[8vh] h-[15vh] rounded-t-full border-4 ${isDarkMode ? 'border-white bg-white/10' : 'border-black bg-black/10'} relative`}
                  >
                    {/* Head */}
                    <div className={`absolute -top-[6vh] left-1/2 -translate-x-1/2 w-[6vh] h-[6vh] rounded-full border-4 ${isDarkMode ? 'border-white' : 'border-black'}`} />
                  </motion.div>
                ))}
              </div>

              {/* Tamil Text */}
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={`text-[4.5vh] font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                உங்கள் வரிசைகளை நேராகச் சீராக்கிக் கொள்ளுங்கள், நெருங்கி நில்லுங்கள், இடைவெளிகளை நிரப்புங்கள், ஷைத்தான் வரிசைகளின் இடைவெளியில் நுழையாதவாறு பார்த்துக் கொள்ளுங்கள்.
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Phone Ad Overlay */}
      <AnimatePresence>
        {showMobileOffScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-10 text-center ${isDarkMode ? 'bg-black' : 'bg-white'}`}
          >
            <div className="max-w-5xl w-full space-y-16">
              {/* Animated Phone Icon */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                animate={{ 
                  scale: [0.5, 1.1, 1], 
                  opacity: 1, 
                  rotate: [ -10, 10, -5, 5, 0 ],
                }}
                transition={{ 
                  duration: 1.5,
                  times: [0, 0.4, 0.6, 0.8, 1],
                  ease: "easeOut"
                }}
                className="flex justify-center"
              >
                <div className={`relative p-12 rounded-[4rem] border-8 ${isDarkMode ? 'border-red-500 bg-red-500/10' : 'border-red-600 bg-red-50/50'}`}>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 2,
                      ease: "easeInOut"
                    }}
                    className="relative"
                  >
                    <Smartphone size="20vh" className={isDarkMode ? 'text-red-500' : 'text-red-600'} />
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1, duration: 0.5 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="w-[25vh] h-[2vh] bg-red-500 rotate-45 absolute" />
                      <VolumeX size="10vh" className="absolute -bottom-4 -right-4 text-red-500 bg-black rounded-full p-2 border-2 border-red-500" />
                    </motion.div>
                  </motion.div>
                  
                  {/* Pulse Rings */}
                  <motion.div 
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-[4rem] border-4 border-red-500"
                  />
                  <motion.div 
                    animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                    className="absolute inset-0 rounded-[4rem] border-4 border-red-500"
                  />
                </div>
              </motion.div>

              <div className="space-y-8">
                <motion.h2 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className={`text-[8vh] font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}
                >
                  Switch Off Mobile
                </motion.h2>
                
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className={`text-[4vh] font-bold uppercase tracking-widest ${isDarkMode ? 'text-red-500' : 'text-red-600'}`}
                >
                  Please silence or turn off your phones
                </motion.p>

                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 40, ease: "linear" }}
                  className="h-2 bg-red-500 mx-auto rounded-full"
                  style={{ maxWidth: '400px' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message Overlay */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
          >
            <div className={`p-4 rounded-lg shadow-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-red-900/90 border-red-500 text-white' : 'bg-red-100 border-red-300 text-red-900'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500 rounded-full text-white">
                  <X size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase tracking-wider">Connection Error</p>
                  <p className="text-sm opacity-90">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-2 text-xs font-bold underline hover:no-underline"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className="relative mb-1">
        <div className="text-center">
          <h1 className={`text-xl font-bold tracking-widest uppercase opacity-90 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {MASJID_NAME}
          </h1>
        </div>
        <div className="absolute right-4 top-0 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest opacity-50 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  const timings = await fetchPrayerTimesFromSpreadsheet(currentTime);
                  setTimings(timings);
                  setError(null);
                } catch (err) {
                  setError(`Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-green-400' : 'bg-black/10 hover:bg-black/20 text-green-600'} ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh Timings"
            >
              <RefreshCw size={24} />
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-yellow-400' : 'bg-black/10 hover:bg-black/20 text-slate-700'}`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            <button 
              onClick={toggleFullscreen}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-purple-400' : 'bg-black/10 hover:bg-black/20 text-purple-600'}`}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="grid grid-cols-[10vw_1fr] gap-[2vw] items-stretch w-full max-w-[92vw]">
          
          {/* Left Labels */}
          <div className="flex flex-col gap-[0.5vh]">
            <div className={`flex-1 border-2 ${isDarkMode ? 'border-white/20 bg-white/5' : 'border-black/20 bg-black/5'} rounded-xl flex items-center justify-center`}>
              <div className="text-[2.5vh] font-black tracking-widest leading-none text-center">
                T<br/>I<br/>M<br/>E
              </div>
            </div>
            <div className={`flex-1 border-2 ${isDarkMode ? 'border-white/20 bg-white/5' : 'border-black/20 bg-black/5'} rounded-xl flex items-center justify-center`}>
              <div className="text-[2.5vh] font-black tracking-widest leading-none text-center">
                A<br/>Z<br/>A<br/>N
              </div>
            </div>
            <div className={`flex-1 border-2 ${isDarkMode ? 'border-white/20 bg-white/5' : 'border-black/20 bg-black/5'} rounded-xl flex items-center justify-center`}>
              <div className="text-[2.5vh] font-black tracking-widest leading-none text-center">
                I<br/>Q<br/>A<br/>M<br/>A<br/>H
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[0.5vh] flex-1 min-h-0">
            {/* Current Time */}
            <motion.div 
              key={format(currentTime, 'h:mm:ss')}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 1 }}
              className={`text-[27vh] leading-[1] font-black tracking-tighter flex justify-center items-center border-2 border-transparent ${isDarkMode ? 'text-[#00FF00]' : 'text-[#008000]'}`}
            >
              {format(currentTime, 'h:mm:ss')}
            </motion.div>
            
            {/* Next Azan / Prayer Name */}
            <motion.div 
              key={nextPrayer?.countdown ? nextPrayer?.name : nextPrayer?.azan}
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-[27vh] leading-[1] font-black tracking-tighter flex justify-center items-center border-2 border-transparent mt-[-2vh] ${isDarkMode ? 'text-[#FFFFEE]' : 'text-[#333333]'}`}
            >
              {nextPrayer?.countdown ? nextPrayer?.name : nextPrayer?.azan}
            </motion.div>

            {/* Next Iqamah */}
            <motion.div 
              key={nextPrayer?.countdown || nextPrayer?.iqamah}
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-[27vh] leading-[1] font-black tracking-tighter flex justify-center items-center border-2 border-transparent mt-[-4vh] ${isDarkMode ? 'text-[#FF0000]' : 'text-[#CC0000]'}`}
            >
              {nextPrayer?.countdown || nextPrayer?.iqamah}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="mt-auto flex items-end gap-[2vw] mb-[2vh]">
        <div className="flex-1 bg-[#FFFF00] text-black p-[0.5vh] rounded-xl flex justify-center gap-[10vw] items-center font-black text-[4vh]">
          <div className="flex flex-col items-center leading-none">
            <span className="text-[2vh] uppercase font-[900] mb-[0.2vh]">Fajr</span>
            <span>{stripAMPM(timings?.Fajr)}</span>
          </div>
          <div className="flex flex-col items-center leading-none">
            <span className="text-[2vh] uppercase font-[900] mb-[0.2vh]">
              {currentTime.getDay() === 5 ? "Salatul-Jumuah" : "Dhuhr"}
            </span>
            <span>{stripAMPM(timings?.Dhuhr)}</span>
          </div>
          <div className="flex flex-col items-center leading-none">
            <span className="text-[2vh] uppercase font-[900] mb-[0.2vh]">Asr</span>
            <span>{stripAMPM(timings?.Asr)}</span>
          </div>
          <div className="flex flex-col items-center leading-none">
            <span className="text-[2vh] uppercase font-[900] mb-[0.2vh]">Maghrib</span>
            <span>{stripAMPM(timings?.Maghrib)}</span>
          </div>
          <div className="flex flex-col items-center leading-none">
            <span className="text-[2vh] uppercase font-[900] mb-[0.2vh]">Isha</span>
            <span>{stripAMPM(timings?.Isha)}</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end leading-none pb-[0.5vh]">
          <div className={`text-[2vh] font-[900] uppercase mb-[0.2vh] ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>{format(currentTime, 'dd.MM.yyyy')}</div>
          <div className={`text-[4vh] font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{format(currentTime, 'h:mm')}</div>
        </div>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }
        body {
          background-color: ${isDarkMode ? 'black' : 'white'};
          margin: 0;
          padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
          transition: background-color 0.3s ease;
          font-family: "Times New Roman", Times, serif;
          overflow: hidden;
          height: 100vh;
          width: 100vw;
        }

        .font-mono {
          font-family: "Times New Roman", Times, serif;
          font-weight: bold;
        }

        /* TV Safe Area */
        @media (min-width: 1200px) {
          :root {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}
