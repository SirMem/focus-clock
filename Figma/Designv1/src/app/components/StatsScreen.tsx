import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const WEEKLY_DATA = [
  { day: "周一", focus: 6 },
  { day: "周二", focus: 8 },
  { day: "周三", focus: 5 },
  { day: "周四", focus: 9 },
  { day: "周五", focus: 7 },
  { day: "周六", focus: 4 },
  { day: "周日", focus: 3 },
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

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4L10 8L6 12" stroke="#C0C4CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatsScreen() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const heatmapData = generateHeatmapData();
  
  const currentData = period === "day" ? DAILY_DATA : period === "week" ? WEEKLY_DATA : MONTHLY_DATA;
  const xAxisKey = period === "day" ? "hour" : period === "week" ? "day" : "day";
  
  // Get color intensity for heatmap
  const getHeatmapColor = (count: number) => {
    if (count === 0) return "#EBEDF0";
    if (count <= 2) return "#C6E3F7";
    if (count <= 5) return "#7BC4F0";
    if (count <= 7) return "#4A90D9";
    return "#2A6BAC";
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6" style={{ background: "#F5F7FA" }}>
      {/* Time Period Selector */}
      <div className="px-4 mt-4">
        <div className="flex p-1 rounded-xl" style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200"
              style={{
                background: period === p ? "#4A90D9" : "transparent",
                color: period === p ? "#fff" : "#8A8A9A",
              }}
            >
              {p === "day" ? "日" : p === "week" ? "周" : "月"}
            </button>
          ))}
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "#8A8A9A" }}>
          {period === "day" ? "今天 6月27日" : period === "week" ? "本周 6月21日 - 6月27日" : "本月 6月1日 - 6月30日"}
        </p>
      </div>

      {/* Summary Cards Row */}
      <div className="px-4 mt-4">
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {[
            { label: "专注时长", value: "4h 32m", trend: "+12%", isUp: true },
            { label: "完成番茄", value: "8 个", trend: "+3", isUp: true },
            { label: "完成率", value: "85%", trend: "-2%", isUp: false },
          ].map((card) => (
            <div
              key={card.label}
              className="flex-shrink-0 p-4 rounded-2xl"
              style={{
                width: 110,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <p className="text-xs mb-1" style={{ color: "#8A8A9A" }}>{card.label}</p>
              <p className="text-lg font-bold" style={{ color: "#1A1A2E" }}>{card.value}</p>
              <div className="flex items-center gap-1 mt-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d={card.isUp ? "M6 3L9 7H3L6 3Z" : "M6 9L3 5H9L6 9Z"}
                    fill={card.isUp ? "#34C759" : "#FF3B30"}
                  />
                </svg>
                <span className="text-xs font-semibold" style={{ color: card.isUp ? "#34C759" : "#FF3B30" }}>
                  {card.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Trend Chart */}
      <div
        className="mx-4 mt-4 p-4 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: "#1A1A2E" }}>
          {period === "day" ? "今日专注趋势" : period === "week" ? "本周专注趋势" : "本月专注趋势"}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={currentData}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4A90D9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4A90D9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 10, fill: "#8A8A9A" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8A8A9A" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", fontSize: 12 }}
              cursor={{ stroke: "#4A90D9", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="focus"
              stroke="#4A90D9"
              strokeWidth={2.5}
              fill="url(#trendGrad)"
              name="专注"
              dot={{ fill: "#4A90D9", r: 4 }}
              activeDot={{ r: 6, fill: "#4A90D9", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* GitHub-style Heatmap Calendar */}
      <div
        className="mx-4 mt-4 p-4 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>专注日历</p>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: "#8A8A9A" }}>少</span>
            {[0, 3, 6, 9].map((count) => (
              <div
                key={count}
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: getHeatmapColor(count) }}
              />
            ))}
            <span className="text-xs" style={{ color: "#8A8A9A" }}>多</span>
          </div>
        </div>
        
        <div className="flex gap-1">
          {/* Weekday labels */}
          <div className="flex flex-col gap-1 pr-1">
            {["", "一", "", "三", "", "五", ""].map((d, i) => (
              <div key={i} className="h-3 flex items-center justify-end">
                <span className="text-[9px]" style={{ color: "#8A8A9A" }}>{d}</span>
              </div>
            ))}
          </div>
          
          {/* Heatmap grid */}
          <div className="flex gap-1 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {Array.from({ length: 6 }).map((_, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const dataIndex = weekIndex * 7 + dayIndex;
                  const data = heatmapData[dataIndex];
                  return (
                    <div
                      key={dayIndex}
                      className="w-3 h-3 rounded-sm transition-all"
                      style={{
                        background: data ? getHeatmapColor(data.count) : "#EBEDF0",
                      }}
                      title={data ? `${data.date}: ${data.count} 个番茄` : ""}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ring Charts Row */}
      <div className="px-4 mt-4 flex gap-3">
        {/* Focus vs Rest Ring */}
        <div
          className="flex-1 p-4 rounded-2xl"
          style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: "#1A1A2E" }}>专注 vs 休息</p>
          <div className="flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#F0F2F5" strokeWidth="10" />
              <circle
                cx="40"
                cy="40"
                r="30"
                fill="none"
                stroke="#4A90D9"
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 30 * 0.75} ${2 * Math.PI * 30}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
              <circle
                cx="40"
                cy="40"
                r="30"
                fill="none"
                stroke="#FF9500"
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 30 * 0.25} ${2 * Math.PI * 30}`}
                strokeDashoffset={`${-2 * Math.PI * 30 * 0.75}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: "#4A90D9" }} />
              <span className="text-xs" style={{ color: "#8A8A9A" }}>75%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: "#FF9500" }} />
              <span className="text-xs" style={{ color: "#8A8A9A" }}>25%</span>
            </div>
          </div>
        </div>

        {/* Task Completion Ring */}
        <div
          className="flex-1 p-4 rounded-2xl"
          style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: "#1A1A2E" }}>任务完成率</p>
          <div className="flex items-center justify-center relative">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#F0F2F5" strokeWidth="10" />
              <circle
                cx="40"
                cy="40"
                r="30"
                fill="none"
                stroke="#4A90D9"
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 30 * 0.85} ${2 * Math.PI * 30}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold" style={{ color: "#4A90D9" }}>85%</span>
            </div>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: "#8A8A9A" }}>已完成 6/8 任务</p>
        </div>
      </div>

      {/* Today's Efficiency Score */}
      <div
        className="mx-4 mt-4 p-5 rounded-2xl relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #4A90D9 0%, #6C5CE7 100%)",
          boxShadow: "0 8px 24px rgba(74, 144, 217, 0.3)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">今日评分</p>
            <p className="text-white mt-1" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
              92
              <span className="text-lg ml-1">分</span>
            </p>
          </div>
          <div className="text-5xl opacity-20">🎯</div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
            <span className="text-xs">🤖</span>
          </div>
          <p className="text-white/90 text-xs">比昨日提升 5%，继续保持！</p>
        </div>
      </div>

      {/* Journal Entry Button */}
      <button
        className="mx-4 mt-4 mb-2 flex items-center justify-between p-4 rounded-2xl transition-all active:scale-98"
        style={{
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: "#FFF5E6" }}
          >
            📔
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>专注日记</p>
            <p className="text-xs" style={{ color: "#8A8A9A" }}>记录今天的收获与感悟</p>
          </div>
        </div>
        <ChevronRightIcon />
      </button>
    </div>
  );
}
