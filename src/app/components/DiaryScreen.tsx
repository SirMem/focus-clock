import { useState } from "react";

interface DiaryEntry {
  id: number;
  date: string;
  emotion: string;
  content: string;
  preview: string;
}

const EMOTIONS = [
  { emoji: "😊", label: "开心", id: "happy" },
  { emoji: "😐", label: "平静", id: "calm" },
  { emoji: "😢", label: "沮丧", id: "sad" },
  { emoji: "😤", label: "焦虑", id: "anxious" },
  { emoji: "🧘", label: "专注", id: "focused" },
];

const AI_PROMPTS = [
  "今天哪个番茄最难坚持？为什么？",
  "哪个时段专注度最高？做了什么让你保持专注？",
  "今天有哪些进步值得表扬自己？",
  "遇到的最大挑战是什么？如何克服的？",
  "明天想在哪方面做得更好？",
];

const TODAY_TASKS = [
  { id: 1, text: "📖 复习高数第三章", duration: 25, completed: true },
  { id: 2, text: "💻 写项目报告", duration: 50, completed: true },
  { id: 3, text: "📧 回复团队邮件", duration: 25, completed: true },
];

const HISTORY_ENTRIES: DiaryEntry[] = [
  {
    id: 1,
    date: "2026年6月27日 周六",
    emotion: "😊",
    content: "今天专注度很高，完成了三个重要任务。早上的咖啡帮助我快速进入状态...",
    preview: "今天专注度很高，完成了三个重要任务。早上的咖啡帮助我快速进入状态...",
  },
  {
    id: 2,
    date: "2026年6月26日 周五",
    emotion: "😤",
    content: "下午被打断了很多次，专注度不高。需要找个更安静的环境工作。",
    preview: "下午被打断了很多次，专注度不高。需要找个更安静的环境工作。",
  },
  {
    id: 3,
    date: "2026年6月25日 周四",
    emotion: "🧘",
    content: "尝试了番茄工作法的长专注模式，效果不错。今天心态很平和。",
    preview: "尝试了番茄工作法的长专注模式，效果不错。今天心态很平和。",
  },
];

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="#4A90D9" strokeWidth="1.5" />
      <path d="M3 8H17" stroke="#4A90D9" strokeWidth="1.5" />
      <path d="M7 2V5M13 2V5" stroke="#4A90D9" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="11" r="0.5" fill="#4A90D9" />
      <circle cx="10" cy="11" r="0.5" fill="#4A90D9" />
      <circle cx="13" cy="11" r="0.5" fill="#4A90D9" />
      <circle cx="7" cy="14" r="0.5" fill="#4A90D9" />
      <circle cx="10" cy="14" r="0.5" fill="#4A90D9" />
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

export function DiaryScreen() {
  const [selectedEmotion, setSelectedEmotion] = useState("happy");
  const [content, setContent] = useState("");
  const [promptIndex] = useState(0);
  
  const currentPrompt = AI_PROMPTS[promptIndex];
  const charCount = content.length;
  const maxChars = 2000;

  const handleSave = () => {
    if (!content.trim()) return;
    // Save logic here
    alert("日记已保存！");
    setContent("");
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6" style={{ background: "#F5F7FA" }}>
      {/* Date Display */}
      <div className="px-6 pt-6 pb-4" style={{ background: "linear-gradient(180deg, #FAFBFD 0%, #F5F7FA 100%)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>
            2026年6月28日
          </p>
          <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ background: "#EBF4FF" }}>
            <CalendarIcon />
          </button>
        </div>
        <p className="text-sm" style={{ color: "#8A8A9A" }}>周日 · 今日已完成 3 个番茄</p>
      </div>

      {/* Emotion Selector */}
      <div className="px-6 pb-6">
        <p className="text-xs font-medium mb-3" style={{ color: "#8A8A9A" }}>今天的心情</p>
        <div className="flex items-center justify-between">
          {EMOTIONS.map((emotion) => (
            <button
              key={emotion.id}
              onClick={() => setSelectedEmotion(emotion.id)}
              className="flex flex-col items-center gap-1.5 transition-all active:scale-95"
              style={{
                transform: selectedEmotion === emotion.id ? "scale(1.1)" : "scale(1)",
              }}
            >
              <div
                className="rounded-full flex items-center justify-center text-3xl transition-all"
                style={{
                  width: 48,
                  height: 48,
                  background: selectedEmotion === emotion.id ? "#fff" : "#F5F7FA",
                  border: selectedEmotion === emotion.id ? "3px solid #4A90D9" : "3px solid transparent",
                  boxShadow: selectedEmotion === emotion.id ? "0 4px 16px rgba(74, 144, 217, 0.2)" : "none",
                }}
              >
                {emotion.emoji}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: selectedEmotion === emotion.id ? "#4A90D9" : "#C0C4CC" }}
              >
                {emotion.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Reflection Prompt */}
      <div className="px-6 pb-3">
        <div className="flex items-start gap-2 px-4 py-3 rounded-2xl" style={{ background: "#FFF9EB", border: "1px solid #FFE6B8" }}>
          <span className="text-lg">💡</span>
          <div className="flex-1">
            <p className="text-xs font-semibold mb-1" style={{ color: "#E89B00" }}>AI 引导思考</p>
            <p className="text-sm" style={{ color: "#6B5A00" }}>{currentPrompt}</p>
          </div>
        </div>
      </div>

      {/* Text Input Area */}
      <div className="px-6 pb-4">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1.5px solid #E0E4EA", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
            placeholder="记录今天的感受、收获和反思..."
            className="w-full px-4 py-4 text-sm outline-none resize-none bg-transparent"
            style={{
              minHeight: 200,
              color: "#1A1A2E",
              fontFamily: "'PingFang SC', -apple-system, sans-serif",
              lineHeight: 1.6,
            }}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: "#F0F2F5" }}>
            <div className="flex items-center gap-2">
              <button className="text-lg opacity-60 hover:opacity-100 transition-opacity">📷</button>
              <button className="text-lg opacity-60 hover:opacity-100 transition-opacity">🎤</button>
            </div>
            <span className="text-xs" style={{ color: charCount > maxChars * 0.9 ? "#FF9500" : "#C0C4CC" }}>
              {charCount}/{maxChars}
            </span>
          </div>
        </div>
      </div>

      {/* Today's Pomodoro Association */}
      <div className="px-6 pb-4">
        <div className="p-4 rounded-2xl" style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📋</span>
            <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>今日完成</p>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "#EBF4FF", color: "#4A90D9" }}>
              3 个任务
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {TODAY_TASKS.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "#F5F7FA" }}
              >
                <span className="text-sm flex-1" style={{ color: "#4A4A6A" }}>
                  {task.text}
                </span>
                <span className="text-xs" style={{ color: "#8A8A9A" }}>
                  {task.duration}min
                </span>
                {task.completed && <span className="text-sm">✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="px-6 pb-6">
        <button
          onClick={handleSave}
          disabled={!content.trim()}
          className="w-full py-4 rounded-2xl text-base font-semibold transition-all active:scale-98"
          style={{
            background: content.trim() ? "linear-gradient(135deg, #4A90D9, #6C5CE7)" : "#E0E4EA",
            color: content.trim() ? "#fff" : "#C0C4CC",
            boxShadow: content.trim() ? "0 8px 24px rgba(74, 144, 217, 0.3)" : "none",
            cursor: content.trim() ? "pointer" : "not-allowed",
          }}
        >
          保存今日记录
        </button>
      </div>

      {/* History Section */}
      <div className="px-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>历史记录</p>
          <button className="text-xs" style={{ color: "#4A90D9" }}>查看全部</button>
        </div>
      </div>

      {/* History List */}
      <div className="px-6 pb-6">
        {HISTORY_ENTRIES.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-4"
              style={{ background: "#F5F7FA" }}
            >
              📔
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "#8A8A9A" }}>还没有记录</p>
            <p className="text-xs" style={{ color: "#C0C4CC" }}>开始写下今天的感受吧</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {HISTORY_ENTRIES.map((entry) => (
              <button
                key={entry.id}
                className="flex items-start gap-3 p-4 rounded-2xl text-left transition-all active:scale-98"
                style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
              >
                <span className="text-2xl flex-shrink-0">{entry.emotion}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1" style={{ color: "#8A8A9A" }}>{entry.date}</p>
                  <p className="text-sm truncate" style={{ color: "#4A4A6A" }}>{entry.preview}</p>
                </div>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
