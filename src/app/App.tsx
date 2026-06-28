import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatsScreen } from "./components/StatsScreen";
import { DiaryScreen } from "./components/DiaryScreen";
import { AICoachScreen } from "./components/AICoachScreen";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "focus" | "todo" | "stats" | "diary" | "coach";
type TimerMode = "focus" | "shortBreak" | "longBreak";
type TimerState = "idle" | "running" | "paused";

interface Task {
  id: number;
  text: string;
  done: boolean;
  pomodoros: number;
  completed: number;
  category: "work" | "study" | "life";
  priority?: "urgent" | "important" | "normal";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "专注",
  shortBreak: "短休息",
  longBreak: "长休息",
};

const MODE_COLORS: Record<TimerMode, string> = {
  focus: "#4A90D9",
  shortBreak: "#34C759",
  longBreak: "#FF9500",
};

const PRIORITY_COLORS = {
  urgent: "#FF3B30",
  important: "#FF9500",
  normal: "#D0D4DB",
};

const PRIORITY_LABELS = {
  urgent: "紧急",
  important: "重要",
  normal: "普通",
};

const AI_TIPS = [
  "番茄工作法能帮你保持专注，每25分钟全力投入，休息时彻底放松。",
  "研究表明，短暂休息能提升大脑效率47%。加油，你做得很棒！",
  "今日已完成3个番茄，专注度比昨天提升了12%。继续保持！",
  "下一个番茄建议专注在最重要的任务上，优先级是成功的关键。",
  "你已连续专注18分钟，坚持就是胜利！休息时记得喝水。",
  "环境整洁能提升专注力。利用休息时间整理一下桌面吧。",
];

const WEEKLY_DATA = [
  { day: "周一", focus: 6, goal: 8 },
  { day: "周二", focus: 8, goal: 8 },
  { day: "周三", focus: 5, goal: 8 },
  { day: "周四", focus: 9, goal: 8 },
  { day: "周五", focus: 7, goal: 8 },
  { day: "周六", focus: 4, goal: 8 },
  { day: "周日", focus: 3, goal: 8 },
];

const DAILY_DATA = [
  { hour: "6时", focus: 0 },
  { hour: "8时", focus: 2 },
  { hour: "10时", focus: 3 },
  { hour: "12时", focus: 1 },
  { hour: "14时", focus: 4 },
  { hour: "16时", focus: 3 },
  { hour: "18时", focus: 2 },
  { hour: "20时", focus: 1 },
];

const MONTHLY_DATA = [
  { day: "1日", focus: 4 },
  { day: "5日", focus: 6 },
  { day: "10日", focus: 5 },
  { day: "15日", focus: 8 },
  { day: "20日", focus: 7 },
  { day: "25日", focus: 5 },
  { day: "30日", focus: 6 },
];

const HOURLY_DATA = [
  { hour: "8时", focus: 2 },
  { hour: "9时", focus: 4 },
  { hour: "10时", focus: 3 },
  { hour: "11时", focus: 5 },
  { hour: "14时", focus: 4 },
  { hour: "15时", focus: 6 },
  { hour: "16时", focus: 3 },
  { hour: "20时", focus: 2 },
];

// Generate heatmap data for the past ~6 weeks
const generateHeatmapData = () => {
  const data: { date: string; count: number; day: number; week: number }[] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 41); // ~6 weeks
  
  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dayOfWeek = currentDate.getDay();
    const weekIndex = Math.floor(i / 7);
    const count = Math.floor(Math.random() * 10); // Random pomodoro count 0-9
    
    data.push({
      date: currentDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      count,
      day: dayOfWeek,
      week: weekIndex,
    });
  }
  
  return data;
};

const INITIAL_TASKS: Task[] = [
  { id: 1, text: "完成产品需求文档", done: false, pomodoros: 4, completed: 2, category: "work", priority: "urgent" },
  { id: 2, text: "阅读《深度工作》第三章", done: false, pomodoros: 2, completed: 0, category: "study", priority: "normal" },
  { id: 3, text: "回复团队邮件", done: true, pomodoros: 1, completed: 1, category: "work", priority: "important" },
  { id: 4, text: "整理本周学习笔记", done: false, pomodoros: 2, completed: 1, category: "study", priority: "normal" },
  { id: 5, text: "跑步30分钟", done: true, pomodoros: 1, completed: 1, category: "life", priority: "normal" },
  { id: 6, text: "准备明天的会议材料", done: false, pomodoros: 3, completed: 0, category: "work", priority: "urgent" },
  { id: 7, text: "完成UI设计稿", done: false, pomodoros: 5, completed: 3, category: "work", priority: "important" },
];

const CATEGORY_COLORS = {
  work: "#4A90D9",
  study: "#34C759",
  life: "#FF9500",
};

const CATEGORY_LABELS = {
  work: "工作",
  study: "学习",
  life: "生活",
};

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularTimer({
  progress,
  mode,
  timeLeft,
  state,
}: {
  progress: number;
  mode: TimerMode;
  timeLeft: number;
  state: TimerState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = MODE_COLORS[mode];
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    const size = 300;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 110;
    const lineWidth = 8;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Background track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    
    // Progress arc
    if (progress > 0) {
      ctx.beginPath();
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * progress);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }, [progress, color]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full opacity-15 blur-3xl"
        style={{ background: color, transform: "scale(0.75)" }}
      />
      
      <canvas 
        ref={canvasRef}
        className="relative z-10"
        style={{ width: 300, height: 300 }}
      />
      
      {/* Center content */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ transform: "none" }}
      >
        <span
          className="font-bold tabular-nums leading-none"
          style={{
            fontSize: 48,
            color: "#1A1A2E",
            fontFamily: "'PingFang SC', -apple-system, sans-serif",
            letterSpacing: -1,
          }}
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <span
          className="mt-2 text-sm font-medium"
          style={{ color: MODE_COLORS[mode] }}
        >
          {state === "idle" ? "准备开始" : state === "paused" ? "已暂停" : MODE_LABELS[mode] + "中"}
        </span>
      </div>
    </div>
  );
}

// ─── Focus Screen ─────────────────────────────────────────────────────────────

function FocusScreen() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [state, setState] = useState<TimerState>("idle");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [sessions, setSessions] = useState(2);
  const [sound, setSound] = useState("none");
  const [currentTask, setCurrentTask] = useState("📖 复习高数第三章");
  const [tipIndex, setTipIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = DURATIONS[mode];
  const progress = 1 - timeLeft / totalTime;

  const switchMode = useCallback(
    (m: TimerMode) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setMode(m);
      setState("idle");
      setTimeLeft(DURATIONS[m]);
    },
    []
  );

  const start = useCallback(() => {
    setState("running");
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          setState("idle");
          if (mode === "focus") setSessions((s) => s + 1);
          setTipIndex((i) => (i + 1) % AI_TIPS.length);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [mode]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("paused");
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("idle");
    setTimeLeft(DURATIONS[mode]);
  }, [mode]);
  
  const skip = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("idle");
    // Toggle between focus and break
    if (mode === "focus") {
      switchMode("shortBreak");
    } else {
      switchMode("focus");
    }
  }, [mode, switchMode]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const sounds = [
    { id: "none", label: "🔇 无音效", emoji: "🔇" },
    { id: "cafe", label: "☕ 咖啡馆", emoji: "☕" },
    { id: "rain", label: "🌧️ 雨声", emoji: "🌧️" },
    { id: "ocean", label: "🌊 海浪", emoji: "🌊" },
    { id: "white", label: "❄️ 白噪音", emoji: "❄️" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F7FA" }}>
    

      {/* Timer Circle */}
      <div className="flex flex-col items-center pt-8 pb-6">
        <CircularTimer progress={progress} mode={mode} timeLeft={timeLeft} state={state} />
        
        {/* Current Task */}
        {currentTask && (
          <p 
            className="mt-4 text-sm font-medium px-6 text-center"
            style={{ color: "#4A4A6A" }}
          >
            {currentTask}
          </p>
        )}
      </div>

      {/* White Noise / Sound Selector */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {sounds.map((s) => (
            <button
              key={s.id}
              onClick={() => setSound(s.id)}
              className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: sound === s.id ? "#fff" : "#F0F2F5",
                color: sound === s.id ? "#4A90D9" : "#8A8A9A",
                border: sound === s.id ? "2px solid #4A90D9" : "2px solid transparent",
                boxShadow: sound === s.id ? "0 2px 8px rgba(74, 144, 217, 0.2)" : "none",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 px-6 pb-6">
        <button
          onClick={reset}
          className="flex items-center justify-center w-14 h-14 rounded-full transition-all active:scale-95"
          style={{ 
            background: "#fff",
            border: "2px solid #E0E4EA",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 10C2 5.58 5.58 2 10 2C11.57 2 13.03 2.46 14.26 3.25L13 4.5" stroke="#8A8A9A" strokeWidth="2" strokeLinecap="round"/>
            <path d="M18 10C18 14.42 14.42 18 10 18C8.43 18 6.97 17.54 5.74 16.75L7 15.5" stroke="#8A8A9A" strokeWidth="2" strokeLinecap="round"/>
            <path d="M13 2V5H16" stroke="#8A8A9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          onClick={state === "running" ? pause : start}
          className="flex items-center justify-center w-20 h-20 rounded-full shadow-xl transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${MODE_COLORS[mode]}, ${adjustColor(MODE_COLORS[mode], -15)})`,
            boxShadow: `0 8px 32px ${MODE_COLORS[mode]}50`,
          }}
        >
          {state === "running" ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          onClick={skip}
          className="flex items-center justify-center w-14 h-14 rounded-full transition-all active:scale-95"
          style={{ 
            background: "#fff",
            border: "2px solid #E0E4EA",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4L13 10L4 16V4Z" fill="#8A8A9A"/>
            <path d="M13 4L13 16" stroke="#8A8A9A" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 4L16 16" stroke="#8A8A9A" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Pomodoro Progress Dots */}
      <div className="flex flex-col items-center pb-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full transition-all duration-300"
              style={{
                background: i < sessions % 4 ? MODE_COLORS.focus : "#D0D4DB",
                transform: i < sessions % 4 ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8A8A9A" }}>
          今日已完成 <span style={{ color: "#4A90D9", fontWeight: 600 }}>{sessions}</span> 个番茄
        </p>
      </div>

      {/* Session Stats Row */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          {[
            { label: "今日专注", value: "1h 15m", icon: "⏱️" },
            { label: "今日番茄", value: sessions + " 个", icon: "🍅" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex-1 flex items-center gap-2 p-3 rounded-2xl"
              style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{ color: "#8A8A9A" }}>{item.label}</p>
                <p className="text-sm font-bold" style={{ color: "#1A1A2E" }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 pb-4">
        <div className="flex p-1 rounded-xl" style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {([
            { mode: "focus" as TimerMode, label: "专注 25分" },
            { mode: "shortBreak" as TimerMode, label: "休息 5分" },
          ] as const).map((item) => (
            <button
              key={item.mode}
              onClick={() => switchMode(item.mode)}
              className="flex-1 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200"
              style={{
                background: mode === item.mode ? MODE_COLORS[item.mode] : "transparent",
                color: mode === item.mode ? "#fff" : "#8A8A9A",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Coach Card */}
      <div
        className="mx-4 mb-6 p-4 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 16px rgba(74,144,217,0.10)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #4A90D9, #6C5CE7)" }}
          >
            AI
          </div>
          <span className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>
            AI 教练
          </span>
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full"
            style={{ background: "#EBF4FF", color: "#4A90D9" }}
          >
            智能建议
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "#4A4A6A" }}>
          {AI_TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
}

// ─── Todo Screen ──────────────────────────────────────────────────────────────

function TodoScreen() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const addTask = () => {
    if (!input.trim()) return;
    setTasks([
      { id: Date.now(), text: input.trim(), done: false, pomodoros: 1, completed: 0, category: "work", priority: "normal" },
      ...tasks,
    ]);
    setInput("");
  };

  const toggle = (id: number) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const deleteTask = (id: number) =>
    setTasks(tasks.filter((t) => t.id !== id));

  const filtered = 
    filter === "all" ? tasks : 
    filter === "active" ? tasks.filter((t) => !t.done) : 
    tasks.filter((t) => t.done);
  
  const doneCount = tasks.filter((t) => t.done).length;
  const totalFocus = tasks.reduce((acc, t) => acc + (t.completed * 25), 0);
  const totalHours = Math.floor(totalFocus / 60);
  const totalMins = totalFocus % 60;

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ background: "#F5F7FA" }}>
      {/* Quick Add Input */}
      <div
        className="mx-4 mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      >
        <input
          className="flex-1 text-sm outline-none bg-transparent"
          placeholder="添加新任务..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          style={{ color: "#1A1A2E", fontFamily: "'PingFang SC', -apple-system, sans-serif" }}
        />
        <button
          onClick={addTask}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-90"
          style={{ background: input ? "#4A90D9" : "#E0E4EA" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke={input ? "#fff" : "#C0C4CC"} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 px-4 mt-3">
        {([
          { key: "all", label: "全部" },
          { key: "active", label: "进行中" },
          { key: "done", label: "已完成" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filter === f.key ? "#4A90D9" : "transparent",
              color: filter === f.key ? "#fff" : "#8A8A9A",
              border: filter === f.key ? "none" : "1.5px solid #E0E4EA",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-4 mt-3 pb-20">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-4"
              style={{ background: "#F0F2F5" }}
            >
              📝
            </div>
            <p className="text-sm font-medium" style={{ color: "#8A8A9A" }}>
              {filter === "all" ? "添加你的第一个任务吧" : filter === "active" ? "暂无进行中的任务" : "还没有完成任何任务"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((task) => (
              <div
                key={task.id}
                className="relative flex items-center gap-3 px-4 py-4 rounded-2xl transition-all"
                style={{
                  height: 72,
                  background: task.done ? "#F5F7FA" : "#fff",
                  boxShadow: task.done ? "none" : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggle(task.id)}
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
                  style={{
                    borderColor: task.done ? "#34C759" : "#4A90D9",
                    background: task.done ? "#34C759" : "transparent",
                  }}
                >
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-base font-medium truncate"
                    style={{
                      color: task.done ? "#8A8A9A" : "#1A1A2E",
                      textDecoration: task.done ? "line-through" : "none",
                    }}
                  >
                    {task.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: "#8A8A9A" }}>
                      🍅 ×{task.pomodoros}
                    </span>
                  </div>
                </div>

                {/* Priority Indicator */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: PRIORITY_COLORS[task.priority || "normal"] }}
                  />
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6H12M6 6V4C6 3.45 6.45 3 7 3H9C9.55 3 10 3.45 10 4V6M5 6L5.5 12C5.5 12.55 5.95 13 6.5 13H9.5C10.05 13 10.5 12.55 10.5 12L11 6" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* Swipe hint (visual only) */}
                {!task.done && (
                  <div 
                    className="absolute right-0 top-0 bottom-0 flex items-center pr-2 opacity-10"
                    style={{ pointerEvents: "none" }}
                  >
                    <span style={{ color: "#C0C4CC", fontSize: 10 }}>←滑动</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between"
        style={{
          background: "linear-gradient(to top, #fff 0%, #fff 90%, transparent 100%)",
          borderTop: "1px solid #F0F2F5",
        }}
      >
        <span className="text-xs" style={{ color: "#8A8A9A" }}>
          已完成 <span style={{ color: "#34C759", fontWeight: 600 }}>{doneCount}</span>/{tasks.length}
        </span>
        <span className="text-xs" style={{ color: "#8A8A9A" }}>
          今日专注 <span style={{ color: "#4A90D9", fontWeight: 600 }}>{totalHours}h{totalMins}m</span>
        </span>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="添加新任务..."]')?.focus()}
        className="absolute bottom-20 right-6 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-90"
        style={{
          background: "linear-gradient(135deg, #4A90D9, #6C5CE7)",
          boxShadow: "0 8px 24px rgba(74, 144, 217, 0.4)",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 6V18M6 12H18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

function ProfileScreen() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("light");

  const monthlyGoalProgress = 65; // 65% progress
  const monthlyGoalTarget = 50; // 50 hours
  const monthlyGoalCurrent = 32.5; // 32.5 hours

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6" style={{ background: "#F5F7FA" }}>
      {/* Profile Section */}
      <div
        className="mx-4 mt-4 p-5 rounded-3xl"
        style={{
          background: "linear-gradient(135deg, #4A90D9 0%, #667EEA 100%)",
          boxShadow: "0 8px 24px rgba(74, 144, 217, 0.25)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <button
            onClick={() => setIsLoggedIn(!isLoggedIn)}
            className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center transition-all active:scale-95"
            style={{
              background: isLoggedIn ? "#fff" : "rgba(255,255,255,0.2)",
            }}
          >
            {isLoggedIn ? (
              <span className="text-3xl">🧑‍💻</span>
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="12" r="5" stroke="#fff" strokeWidth="2" />
                <path d="M7 26C7 22 10.69 19 16 19C21.31 19 25 22 25 26" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {/* User Info */}
          <div className="flex-1">
            {isLoggedIn ? (
              <>
                <p className="text-white text-lg font-semibold mb-0.5">李明远</p>
                <p className="text-white/80 text-xs">专注达人 · 连续打卡 15 天</p>
              </>
            ) : (
              <>
                <p className="text-white text-base font-semibold mb-1">点击登录</p>
                <p className="text-white/70 text-xs">登录后查看完整数据</p>
              </>
            )}
          </div>

          {/* Settings Icon */}
          <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: "rgba(255,255,255,0.15)" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 12.5C11.38 12.5 12.5 11.38 12.5 10C12.5 8.62 11.38 7.5 10 7.5C8.62 7.5 7.5 8.62 7.5 10C7.5 11.38 8.62 12.5 10 12.5Z" stroke="#fff" strokeWidth="1.5"/>
              <path d="M16.5 10C16.5 10.83 16.42 11.65 16.26 12.44L18.09 13.77L16.59 16.23L14.46 15.54C13.67 16.23 12.73 16.76 11.68 17.07L11.25 19.25H8.25L7.82 17.07C6.77 16.76 5.83 16.23 5.04 15.54L2.91 16.23L1.41 13.77L3.24 12.44C3.08 11.65 3 10.83 3 10C3 9.17 3.08 8.35 3.24 7.56L1.41 6.23L2.91 3.77L5.04 4.46C5.83 3.77 6.77 3.24 7.82 2.93L8.25 0.75H11.25L11.68 2.93C12.73 3.24 13.67 3.77 14.46 4.46L16.59 3.77L18.09 6.23L16.26 7.56C16.42 8.35 16.5 9.17 16.5 10Z" stroke="#fff" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Summary Row */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-4">
        {[
          { label: "累计专注", value: "128h", icon: "⏱️" },
          { label: "连续打卡", value: "15天", icon: "🔥" },
          { label: "获得勋章", value: "6个", icon: "🏆" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-3 rounded-2xl flex flex-col items-center"
            style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <span className="text-2xl mb-1">{stat.icon}</span>
            <p className="text-lg font-bold" style={{ color: "#4A90D9" }}>{stat.value}</p>
            <p className="text-xs" style={{ color: "#8A8A9A" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Goal Section */}
      <div
        className="mx-4 mt-4 p-4 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h3 className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>本月目标</h3>
          </div>
          <span className="text-xs font-semibold" style={{ color: "#4A90D9" }}>
            {monthlyGoalProgress}%
          </span>
        </div>
        
        <p className="text-xs mb-2" style={{ color: "#8A8A9A" }}>
          专注 {monthlyGoalCurrent}h / {monthlyGoalTarget}h
        </p>
        
        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#E0E4EA" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${monthlyGoalProgress}%`,
              background: "linear-gradient(90deg, #4A90D9, #667EEA)",
            }}
          />
        </div>
        
        <p className="text-xs mt-2" style={{ color: "#8A8A9A" }}>
          还需 {monthlyGoalTarget - monthlyGoalCurrent}h 达成目标
        </p>
      </div>

      {/* Menu List Section 1 - Main Features */}
      <div className="px-4 mt-4">
        <p className="text-xs font-semibold mb-2 px-2" style={{ color: "#8A8A9A" }}>功能</p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        >
          {[
            {
              icon: "🎯",
              label: "个人目标",
              desc: "本月已完成 65%",
              badge: null,
              showProgress: true,
              progress: 65,
            },
            {
              icon: "🤖",
              label: "AI 教练",
              desc: "查看今日建议",
              badge: "92分",
              badgeColor: "#34C759",
            },
            {
              icon: "🏆",
              label: "成就勋章",
              desc: "已获得 6 个勋章",
              badge: null,
            },
          ].map((item, index) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-4 transition-all active:bg-gray-50"
              style={{
                height: 56,
                borderTop: index > 0 ? "1px solid #F0F2F5" : "none",
              }}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{item.label}</p>
                {item.desc && (
                  <p className="text-xs truncate" style={{ color: "#8A8A9A" }}>{item.desc}</p>
                )}
              </div>
              {item.badge && (
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: `${item.badgeColor}15`, color: item.badgeColor }}
                >
                  {item.badge}
                </span>
              )}
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      </div>

      {/* Menu List Section 2 - Settings */}
      <div className="px-4 mt-4">
        <p className="text-xs font-semibold mb-2 px-2" style={{ color: "#8A8A9A" }}>设置</p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        >
          {[
            { icon: "📊", label: "数据导出", desc: "导出专注记录" },
            { icon: "🔔", label: "通知设置", desc: "管理提醒通知" },
            { icon: "🌙", label: "专注时段设置", desc: "自定义工作时间" },
            { icon: "🔊", label: "白噪音管理", desc: "选择背景音效" },
            { icon: "🎨", label: "主题切换", desc: "浅色 / 深色 / 自动" },
          ].map((item, index) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-4 transition-all active:bg-gray-50"
              style={{
                height: 56,
                borderTop: index > 0 ? "1px solid #F0F2F5" : "none",
              }}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{item.label}</p>
                {item.desc && (
                  <p className="text-xs truncate" style={{ color: "#8A8A9A" }}>{item.desc}</p>
                )}
              </div>
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      </div>

      {/* Menu List Section 3 - About */}
      <div className="px-4 mt-4">
        <p className="text-xs font-semibold mb-2 px-2" style={{ color: "#8A8A9A" }}>关于</p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        >
          {[
            { icon: "ℹ️", label: "关于", desc: "版本 2.1.0" },
            { icon: "💬", label: "帮助与反馈", desc: "联系开发者" },
            { icon: "⭐", label: "给我们评分", desc: "在小程序中心" },
          ].map((item, index) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-4 transition-all active:bg-gray-50"
              style={{
                height: 56,
                borderTop: index > 0 ? "1px solid #F0F2F5" : "none",
              }}
            >
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{item.label}</p>
                {item.desc && (
                  <p className="text-xs truncate" style={{ color: "#8A8A9A" }}>{item.desc}</p>
                )}
              </div>
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      </div>

      {/* Logout Button */}
      {isLoggedIn && (
        <div className="px-4 mt-4">
          <button
            onClick={() => setIsLoggedIn(false)}
            className="w-full py-3 rounded-2xl text-sm font-medium transition-all active:scale-98"
            style={{
              background: "#fff",
              color: "#FF3B30",
              border: "1.5px solid #FFE5E5",
            }}
          >
            退出登录
          </button>
        </div>
      )}

      <p className="text-center text-xs mt-6" style={{ color: "#C0C4CC" }}>专注时钟 v2.1.0</p>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M10 7L22 14L10 21V7Z" fill="white" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="8" y="7" width="4" height="14" rx="2" fill="white" />
      <rect x="16" y="7" width="4" height="14" rx="2" fill="white" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 11C4 7.13 7.13 4 11 4C13.38 4 15.5 5.15 16.83 6.93L14 7L15.5 10.5L19 9L18.07 5.57C16.35 3.38 13.83 2 11 2C6.03 2 2 6.03 2 11H4Z" fill="#8A8A9A" />
      <path d="M11 20C15.97 20 20 15.97 20 11H18C18 14.87 14.87 18 11 18C8.62 18 6.5 16.85 5.17 15.07L8 15L6.5 11.5L3 13L3.93 16.43C5.65 18.62 8.17 20 11 20Z" fill="#8A8A9A" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M6 5L14 11L6 17V5Z" fill="#8A8A9A" />
      <rect x="15" y="5" width="2" height="12" rx="1" fill="#8A8A9A" />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#C0C4CC" strokeWidth="1.5" />
      <path d="M10 6V14M6 10H14" stroke="#C0C4CC" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4L10 8L6 12" stroke="#C0C4CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Tab Bar Icons ─────────────────────────────────────────────────────────────

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const color = active ? "#4A90D9" : "#C0C4CC";
  const icons: Record<Tab, JSX.Element> = {
    focus: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill={active ? "#4A90D9" : "none"} stroke={color} strokeWidth="2" />
        <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    todo: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="3" stroke={color} strokeWidth="2" />
        <path d="M8 8H16M8 12H16M8 16H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="13" width="4" height="7" rx="1" fill={color} />
        <rect x="10" y="9" width="4" height="11" rx="1" fill={color} />
        <rect x="16" y="5" width="4" height="15" rx="1" fill={color} />
      </svg>
    ),
    diary: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 4H18C19.1 4 20 4.9 20 6V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6C4 4.9 4.9 4 6 4Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 2V6M8 2V6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M9 12H15M9 16H12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    coach: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="9" r="5" stroke={color} strokeWidth="2"/>
        <path d="M9 9H15M12 6V12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M6 20C6 17 8.69 14 12 14C15.31 14 18 17 18 20" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    profile: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
        <path d="M4 20C4 17 7.58 14 12 14C16.42 14 20 17 20 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };

  return icons[tab];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─── App ──────────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = {
  focus: "专注",
  todo: "待办",
  stats: "统计",
  diary: "日记",
  profile: "我的",
  coach: "教练",
};

const NAV_TITLES: Record<Tab, string> = {
  focus: "专注时钟",
  todo: "今日待办",
  stats: "专注统计",
  diary: "专注日记",
  profile: "我的",
  coach: "AI教练",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("focus");

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "#1A1A2E", fontFamily: "'PingFang SC', -apple-system, 'Helvetica Neue', sans-serif" }}
    >
      {/* Phone frame */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: 375,
          height: 812,
          background: "#F5F7FA",
          borderRadius: 44,
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between px-6 pt-3 pb-1 flex-shrink-0"
          style={{ background: "#fff", height: 48 }}
        >
          <span className="text-xs font-semibold" style={{ color: "#1A1A2E" }}>9:41</span>
          <div className="flex items-center gap-1.5">
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </div>
        </div>

        {/* Nav bar */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: "#fff", borderBottom: "1px solid #F0F2F5" }}
        >
          <div className="w-6" />
          <h1 className="text-base font-semibold" style={{ color: "#1A1A2E" }}>
            {NAV_TITLES[tab]}
          </h1>
          <button className="w-6 flex items-center justify-center">
            <DotsIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {tab === "focus" && <FocusScreen />}
          {tab === "todo" && <TodoScreen />}
          {tab === "stats" && <StatsScreen />}
          {tab === "diary" && <DiaryScreen />}
          {tab === "profile" && <ProfileScreen />}
          {tab === "coach" && <AICoachScreen />}
        </div>

        {/* Tab bar */}
        <div
          className="flex-shrink-0 flex items-center"
          style={{
            background: "#fff",
            borderTop: "1px solid #F0F2F5",
            height: 72,
            paddingBottom: 12,
          }}
        >
          {(["focus", "todo", "stats", "diary", "profile", "coach"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <TabIcon tab={t} active={tab === t} />
              <span
                className="text-[10px] font-medium"
                style={{ color: tab === t ? "#4A90D9" : "#C0C4CC" }}
              >
                {TAB_LABELS[t]}
              </span>
              {tab === t && (
                <div
                  className="absolute"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#4A90D9",
                    marginTop: 28,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Status bar mini-icons ─────────────────────────────────────────────────────

function SignalIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect x="0" y="8" width="3" height="4" rx="0.5" fill="#1A1A2E" />
      <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="#1A1A2E" />
      <rect x="9" y="2" width="3" height="10" rx="0.5" fill="#1A1A2E" />
      <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" fill="#1A1A2E" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path d="M8 9.5C8.83 9.5 9.5 10.17 9.5 11S8.83 12.5 8 12.5 6.5 11.83 6.5 11 7.17 9.5 8 9.5Z" fill="#1A1A2E" />
      <path d="M4.5 7C5.5 6 6.68 5.5 8 5.5S10.5 6 11.5 7" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 4.5C3.67 2.83 5.72 2 8 2S12.33 2.83 14 4.5" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#1A1A2E" strokeOpacity="0.35" />
      <rect x="2" y="2" width="16" height="8" rx="2" fill="#1A1A2E" />
      <path d="M23 4V8C23.83 7.67 24.5 6.9 24.5 6S23.83 4.33 23 4Z" fill="#1A1A2E" fillOpacity="0.4" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="4" cy="10" r="1.5" fill="#C0C4CC" />
      <circle cx="10" cy="10" r="1.5" fill="#C0C4CC" />
      <circle cx="16" cy="10" r="1.5" fill="#C0C4CC" />
    </svg>
  );
}