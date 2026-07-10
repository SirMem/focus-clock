const statsAPI = require('../../miniprogram/api/stats.api');
const { formatDuration } = require('../../miniprogram/api/mappers');

import * as echarts from '../../components/ec-canvas/echarts';

// ===== ECharts 初始化函数 =====

function initTrendChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);

  // 初始化空配置，真实数据由 _updateTrendChart 填充
  const option = {
    grid: { left: 40, right: 16, top: 20, bottom: 28 },
    xAxis: {
      type: 'category',
      data: [],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#8A8A9A' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F0F2F5', type: 'dashed' } },
      axisLabel: { fontSize: 10, color: '#8A8A9A' },
      min: 0
    },
    series: [{
      type: 'line',
      data: [],
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: '#4A90D9' },
      itemStyle: { color: '#4A90D9' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(74, 144, 217, 0.25)' },
            { offset: 1, color: 'rgba(74, 144, 217, 0.02)' }
          ]
        }
      }
    }],
    tooltip: { show: false }
  };

  chart.setOption(option);
  return chart;
}

function initRingChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);

  const option = {
    series: [{
      type: 'pie',
      radius: ['60%', '80%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      silent: true,
      itemStyle: { borderRadius: 6 },
      label: { show: false },
      emphasis: { scale: false },
      data: [
        { value: 0, name: '专注', itemStyle: { color: '#4A90D9' } },
        { value: 100, name: '休息', itemStyle: { color: '#FF9500' } },
      ]
    }]
  };

  chart.setOption(option);
  return chart;
}

function initTaskRingChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);

  const option = {
    series: [{
      type: 'pie',
      radius: ['60%', '80%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      silent: true,
      itemStyle: { borderRadius: 6 },
      label: { show: false },
      emphasis: { scale: false },
      data: [
        { value: 0, name: '已完成', itemStyle: { color: '#4A90D9' } },
        { value: 100, name: '未完成', itemStyle: { color: '#E0E0E0' } },
      ]
    }]
  };

  chart.setOption(option);
  return chart;
}

function initHeatmapChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);

  const option = {
    grid: { left: 32, right: 16, top: 14, bottom: 24 },
    xAxis: {
      type: 'category',
      data: ['', '一', '二', '三', '四', '五', '六', '日'],
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#8A8A9A' }
    },
    yAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#8A8A9A' }
    },
    visualMap: {
      min: 0,
      max: 10,
      calculable: false,
      show: false,
      inRange: {
        color: ['#EBEDF0', '#C6E48B', '#7BC96F', '#239A3B', '#196127']
      }
    },
    series: [{
      type: 'heatmap',
      data: [],
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } }
    }],
    tooltip: { show: false }
  };

  chart.setOption(option);
  return chart;
}

// ===== 工具函数 =====

/**
 * 从 API 标准响应 { code, data, message } 中提取 data。
 * 非 0 code 返回 fallback，不 throw，确保单接口失败不会丢弃其他已成功的并行结果。
 */
function extractData(res, fallback) {
  if (!res) return fallback;
  if (res.code !== undefined) {
    if (res.code !== 0) return fallback;
    return 'data' in res ? res.data : fallback;
  }
  return res;
}

// ===== 页面 =====

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    // ECharts 初始化函数
    trendChart: { onInit: initTrendChart },
    focusRestChart: { onInit: initRingChart },
    taskRingChart: { onInit: initTaskRingChart },
    heatmapChart: { onInit: initHeatmapChart },

    period: 'week',
    periods: [
      { key: 'day', label: '日' },
      { key: 'week', label: '周' },
      { key: 'month', label: '月' },
    ],
    trendTitle: '本周专注趋势',

    // 统计卡片（由 _updateSummaryCards 填充）
    summaryCards: [
      { icon: '⏱', value: '0m', label: '专注时长', isUp: true, trend: '—' },
      { icon: '🍅', value: '0 个', label: '完成番茄', isUp: true, trend: '—' },
      { icon: '✅', value: '0%', label: '本月出勤率', isUp: false, trend: '—' },
    ],

    focusPercent: 0,
    restPercent: 0,
    taskPercent: 0,
    doneTasks: 0,
    totalTasks: 0,

    // 热力图
    heatmapLevels: ['#EBEDF0', '#C6E48B', '#7BC96F', '#239A3B', '#196127'],
    heatmapWeeks: ['', '一', '二', '三', '四', '五', '六', '日'],
    heatmapData: [],

    score: 0,
    scoreInsight: '暂无数据',
    scoreEmoji: '📊',

    // 真实数据
    loading: false,
    todayStats: null,
    weeklyStats: null,
    monthlyStats: null,
    todayDetail: null,
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      capsuleHeight: 44,
    });
    this._loadStats();
  },

  onShow() {
    this._loadStats();
  },

  async _loadStats() {
    this.setData({ loading: true });
    try {
      const now = new Date();
      const [todayRes, weeklyRes, monthlyRes, heatmapRes, todayDetailRes] = await Promise.all([
        statsAPI.today(),
        statsAPI.weekly(),
        statsAPI.monthly(),
        statsAPI.heatmap(now.getFullYear(), now.getMonth() + 1),
        statsAPI.todayDetail(),
      ]);

      const today = extractData(todayRes, {});
      const weekly = extractData(weeklyRes, {});
      const monthly = extractData(monthlyRes, {});
      const heatmap = extractData(heatmapRes, []);
      const todayDetail = extractData(todayDetailRes, null);
      const didFail = todayRes.code !== 0 || weeklyRes.code !== 0 ||
                      monthlyRes.code !== 0 || heatmapRes.code !== 0;

      // todayDetail: 新用户无 session 不是错误，用默认 24 个 0 兜底
      const safeDetail = todayDetail || { hourlyBreakdown: [] };
      if (!Array.isArray(safeDetail.hourlyBreakdown) || safeDetail.hourlyBreakdown.length !== 24) {
        safeDetail.hourlyBreakdown = new Array(24).fill(0).map((_, i) => ({ hour: i, focusMinutes: 0 }));
      }

      this.setData({
        todayStats: today || {},
        weeklyStats: weekly || {},
        monthlyStats: monthly || {},
        heatmapData: Array.isArray(heatmap) ? heatmap : [],
        todayDetail: safeDetail,
      });

      if (didFail) {
        wx.showToast({ title: '部分统计数据加载失败', icon: 'none' });
      }

      // 更新所有视图
      this._updateSummaryCards();
      this._updateTrendChart();
      this._updateRingCharts();
      this._updateHeatmap();
      this._updateScoreCard();
    } catch (err) {
      console.error('[stats] 加载统计失败', err);
      wx.showToast({ title: '加载统计数据失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 更新摘要卡片 */
  _updateSummaryCards() {
    const todayStats = this.data.todayStats || {};
    const monthlyStats = this.data.monthlyStats || {};

    const focusMinutes = todayStats.focusMinutes || 0;
    const pomodoroCount = todayStats.pomodoroCount || 0;
    const completionRate = monthlyStats ? (monthlyStats.completionRate || 0) : 0;

    const summaryCards = [
      { icon: '⏱', value: formatDuration(focusMinutes), label: '专注时长', isUp: true, trend: '—' },
      { icon: '🍅', value: `${pomodoroCount} 个`, label: '完成番茄', isUp: true, trend: '—' },
      { icon: '✅', value: `${Math.round(completionRate * 100)}%`, label: '本月出勤率', isUp: false, trend: '—' },
    ];

    this.setData({ summaryCards });
  },

  /** 更新折线图（日/周/月三视图） */
  _updateTrendChart() {
    this._refreshTrendChart(this.data.period);
  },

  /** 更新环形图 */
  _updateRingCharts() {
    const { todayStats, monthlyStats } = this.data;

    // 专注 vs 休息
    if (todayStats) {
      const focus = todayStats.focusMinutes || 0;
      const rest = todayStats.restMinutes || todayStats.breakMinutes || 0;
      const total = focus + rest;
      const focusPercent = total > 0 ? Math.round((focus / total) * 100) : 0;
      const restPercent = total > 0 ? Math.max(0, 100 - focusPercent) : 0;

      this.setData({ focusPercent, restPercent });

      const ecComp = this.selectComponent('#focusRestChart');
      if (ecComp && ecComp.chart) {
        ecComp.chart.setOption({
          series: [{ data: [
            { value: Math.max(focus, 1), name: '专注', itemStyle: { color: '#4A90D9' } },
            { value: Math.max(rest, 1), name: '休息', itemStyle: { color: '#FF9500' } },
          ] }],
        });
      }
    }

    // 任务完成率
    if (monthlyStats) {
      const done = monthlyStats.completedTasks || monthlyStats.doneTasks || 0;
      const total = monthlyStats.totalTasks || 0;
      const undone = Math.max(0, total - done);
      const taskPercent = total > 0 ? Math.round((done / total) * 100) : 0;

      this.setData({ taskPercent, doneTasks: done, totalTasks: total });

      const ecComp = this.selectComponent('#taskRingChart');
      if (ecComp && ecComp.chart) {
        ecComp.chart.setOption({
          series: [{ data: [
            { value: Math.max(done, 1), name: '已完成', itemStyle: { color: '#4A90D9' } },
            { value: Math.max(undone, 1), name: '未完成', itemStyle: { color: '#E0E0E0' } },
          ] }],
        });
      }
    }
  },

  /** 更新热力图 */
  _updateHeatmap() {
    const { heatmapData } = this.data;
    if (!Array.isArray(heatmapData) || !heatmapData.length) return;

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 41);

    const data = heatmapData
      .map(item => {
        let date;
        if (typeof item.date === 'string') {
          date = new Date(item.date);
        } else if (item.date instanceof Date) {
          date = item.date;
        } else {
          return null;
        }

        if (isNaN(date.getTime())) return null;

        const diffDays = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
        if (diffDays < 0 || diffDays > 41) return null;

        const w = Math.floor(diffDays / 7);
        const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
        const d = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon, 6=Sun
        const focusMinutes = item.focusMinutes || 0;

        return [w, d, focusMinutes];
      })
      .filter(Boolean);

    if (!data.length) return;

    const ecComp = this.selectComponent('#heatmapChart');
    if (ecComp && ecComp.chart) {
      ecComp.chart.setOption({ series: [{ data }] });
    }
  },

  /** 更新评分卡片 */
  _updateScoreCard() {
    const todayStats = this.data.todayStats || {};
    const hasScore = todayStats.aiScore != null;
    const score = hasScore ? todayStats.aiScore : 0;
    const insight = hasScore ? '今日专注表现已生成' : '完成一次专注后生成分析';

    let emoji = '📊';
    if (score >= 90) emoji = '🎯';
    else if (score >= 70) emoji = '👍';
    else if (score >= 50) emoji = '💪';

    this.setData({
      score,
      scoreInsight: insight,
      scoreEmoji: emoji,
    });
  },

  onPeriodChange(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ period: key });
    this._refreshTrendChart(key);
  },

  _refreshTrendChart(period) {
    const { weeklyStats, monthlyStats, todayDetail } = this.data;
    let data = [];
    let title = '';
    let seriesType = 'line';

    if (period === 'day') {
      title = '今日专注趋势';
      seriesType = 'bar';
      if (todayDetail && Array.isArray(todayDetail.hourlyBreakdown)) {
        data = todayDetail.hourlyBreakdown.map(d => ({
          label: d.hour + '时',
          value: d.focusMinutes || 0,
        }));
      }
    } else if (period === 'week') {
      title = '本周专注趋势';
      if (weeklyStats && Array.isArray(weeklyStats.dailyBreakdown)) {
        data = weeklyStats.dailyBreakdown.map(d => ({
          label: (d.date || '').slice(-2) + '日',
          value: d.focusMinutes || 0,
        }));
      }
    } else {
      title = '本月专注趋势';
      if (monthlyStats && Array.isArray(monthlyStats.dailyBreakdown)) {
        data = monthlyStats.dailyBreakdown.map(d => ({
          label: (d.date || '').slice(-2) + '日',
          value: d.focusMinutes || 0,
        }));
      }
    }

    this.setData({ trendTitle: title });

    const ecComp = this.selectComponent('#trendChart');
    if (ecComp && ecComp.chart) {
      ecComp.chart.setOption({
        xAxis: { data: data.map(d => d.label) },
        series: [{ type: seriesType, data: data.map(d => d.value) }],
      });
    }
  },

  onJournalTap() {
    wx.switchTab({ url: '/pages/diary/diary' });
  },

  onMenuTap() {
    wx.showToast({ title: '更多功能', icon: 'none' });
  },
});
