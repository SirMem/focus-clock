import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

const WEEKLY_TREND = [
  { day: "周一", hours: 2.5 },
  { day: "周二", hours: 3.2 },
  { day: "周三", hours: 4.5 },
  { day: "周四", hours: 3.8 },
  { day: "周五", hours: 2.9 },
  { day: "周六", hours: 1.5 },
  { day: "周日", hours: 1.2 },
];

const SPARKLINE_DATA = [
  { value: 65 },
  { value: 72 },
  { value: 68 },
  { value: 78 },
  { value: 85 },
  { value: 87 },
  { value: 92 },
];

const ACHIEVEMENTS = [
  { icon: "🔥", label: "连续专注", value: "7 天", color: "#FF6B35" },
  { icon: "⭐", label: "完成", value: "50 个番茄", color: "#FFB800" },
  { icon: "📅", label: "本月专注", value: "22h", color: "#4A90D9" },
];

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4L10 8L6 12" stroke="#4A90D9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AICoachScreen() {
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6" style={{ background: "#F5F7FA" }}>
      {/* AI Score Hero Card */}
      <div
        className="mx-4 mt-4 p-6 rounded-3xl relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #4A90D9 0%, #667EEA 50%, #8B5CF6 100%)",
          boxShadow: "0 12px 32px rgba(74, 144, 217, 0.35)",
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute rounded-full opacity-10"
          style={{ width: 120, height: 120, background: "#fff", top: -30, right: -20 }}
        />
        <div
          className="absolute rounded-full opacity-10"
          style={{ width: 80, height: 80, background: "#fff", bottom: -20, left: -10 }}
        />
        
        <div className="relative flex items-center justify-between">
          <div className="flex-1">
            <p className="text-white/80 text-xs font-medium mb-1">今日效率评分</p>
            <div className="flex items-end gap-2">
              <span className="text-white font-bold" style={{ fontSize: 56, lineHeight: 1, letterSpacing: -2 }}>
                92
              </span>
              <span className="text-white/90 text-lg mb-2">分</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center gap-0.5 px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 9V3M3 6L6 3L9 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-white text-xs font-semibold">+5 分</span>
              </div>
              <span className="text-white/70 text-xs">较昨日</span>
            </div>
          </div>
          
          {/* AI Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
          >
            🤖
          </div>
        </div>
      </div>

      {/* AI Insight Card */}
      <div
        className="mx-4 mt-4 p-5 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📊</span>
          <h3 className="text-base font-semibold" style={{ color: "#1A1A2E" }}>趋势洞察</h3>
        </div>
        
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#4A4A6A" }}>
          你这周专注时长比上周提升了<span className="font-semibold" style={{ color: "#34C759" }}>15%</span>，
          <span className="font-semibold" style={{ color: "#4A90D9" }}>周三上午</span>是你的效率高峰时段。继续加油！
        </p>
        
        {/* Mini Sparkline Chart */}
        <div className="h-16 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={SPARKLINE_DATA}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4A90D9"
                strokeWidth={2.5}
                dot={false}
                strokeLinecap="round"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs" style={{ color: "#8A8A9A" }}>本周趋势</span>
          <span className="text-xs font-semibold" style={{ color: "#34C759" }}>↑ 15%</span>
        </div>
      </div>

      {/* Personalized Suggestion Card */}
      <div
        className="mx-4 mt-4 p-5 rounded-2xl border-2"
        style={{ background: "#FAFBFF", borderColor: "#E6EDFF", boxShadow: "0 2px 8px rgba(74, 144, 217, 0.08)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">💡</span>
          <h3 className="text-base font-semibold" style={{ color: "#1A1A2E" }}>今日建议</h3>
        </div>
        
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#4A4A6A" }}>
          建议明天把最难的任务安排在<span className="font-semibold" style={{ color: "#4A90D9" }}>9-11点</span>，
          这是你本周效率最高的时段。
        </p>
        
        <button
          onClick={() => setSuggestionAccepted(true)}
          disabled={suggestionAccepted}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{
            background: suggestionAccepted ? "#E0E4EA" : "#4A90D9",
            color: suggestionAccepted ? "#8A8A9A" : "#fff",
            cursor: suggestionAccepted ? "not-allowed" : "pointer",
          }}
        >
          {suggestionAccepted ? "✓ 已采纳" : "采纳建议"}
        </button>
      </div>

      {/* Habit Streak Section */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>成就徽章</h3>
          <button className="text-xs" style={{ color: "#4A90D9" }}>查看全部</button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {ACHIEVEMENTS.map((achievement, index) => (
            <div
              key={index}
              className="flex-shrink-0 p-4 rounded-2xl"
              style={{
                width: 110,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2"
                style={{ background: `${achievement.color}15` }}
              >
                {achievement.icon}
              </div>
              <p className="text-xs mb-1" style={{ color: "#8A8A9A" }}>{achievement.label}</p>
              <p className="text-sm font-bold" style={{ color: achievement.color }}>{achievement.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Summary Preview */}
      <div
        className="mx-4 mt-4 p-5 rounded-2xl"
        style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: "#1A1A2E" }}>周报预览</h3>
          <button className="flex items-center gap-1 text-xs font-medium" style={{ color: "#4A90D9" }}>
            查看完整周报
            <ChevronRightIcon />
          </button>
        </div>
        
        {/* Weekly Trend Bar Chart */}
        <div className="h-32 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEKLY_TREND} barSize={20}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "#8A8A9A" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Bar
                dataKey="hours"
                fill="#4A90D9"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: "#F0F2F5" }}>
          {[
            { label: "总时长", value: "19.6h" },
            { label: "完成任务", value: "24 个" },
            { label: "专注率", value: "87%" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: "#4A90D9" }}>{stat.value}</p>
              <p className="text-xs" style={{ color: "#8A8A9A" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Coaching History */}
      <div className="px-4 mt-4 mb-2">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#1A1A2E" }}>历史建议</h3>
        
        <div className="flex flex-col gap-2">
          {[
            { date: "昨天", text: "尝试使用番茄钟长专注模式，可能更适合你的工作节奏", accepted: true },
            { date: "6月26日", text: "下午2点后效率下降，建议安排简单任务或休息", accepted: false },
          ].map((history, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: history.accepted ? "#EBF4FF" : "#F5F7FA" }}
              >
                <span className="text-sm">{history.accepted ? "✓" : "💡"}</span>
              </div>
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: "#8A8A9A" }}>{history.date}</p>
                <p className="text-sm" style={{ color: "#4A4A6A" }}>{history.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Button */}
      <div className="px-4 mt-4">
        <button
          className="w-full flex items-center justify-between p-4 rounded-2xl transition-all active:scale-98"
          style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#F5F7FA" }}>
              <span className="text-lg">⚙️</span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>AI 教练设置</p>
              <p className="text-xs" style={{ color: "#8A8A9A" }}>个性化建议偏好</p>
            </div>
          </div>
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}
