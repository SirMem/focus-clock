import * as echarts from '../../ec-canvas/echarts';

// ===== 4 个 ECharts 初始化函数（与原来完全一致） =====

function initTrendChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
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
      data: []
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
      data: []
    }]
  };
  chart.setOption(option);
  return chart;
}

function initHeatmapChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(chart);
  const option = {
    grid: { left: 32, right: 16, top: 14, bottom: 28 },
    xAxis: {
      type: 'category',
      data: [], // 由 _updateHeatmap 动态填充周标签
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#8A8A9A' }
    },
    yAxis: {
      type: 'category',
      data: ['一', '二', '三', '四', '五', '六', '日'],
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#8A8A9A', interval: 0 }
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

// ===== 组件 =====

Component({
  properties: {
    period:         { type: String, value: 'week' },
    todayStats:     { type: Object, value: null },
    weeklyStats:    { type: Object, value: null },
    monthlyStats:   { type: Object, value: null },
    todayDetail:    { type: Object, value: null },
    heatmapData:    { type: Array,  value: [] },
  },

  data: {
    // ECharts 初始化配置（ec-canvas 需要的格式）
    trendChart:     { onInit: initTrendChart },
    focusRestChart: { onInit: initRingChart },
    taskRingChart:  { onInit: initTaskRingChart },
    heatmapChart:   { onInit: initHeatmapChart },

    trendTitle: '本周专注趋势',
    focusPercent: 0,
    restPercent: 0,
    taskPercent: 0,
    doneTasks: 0,
    totalTasks: 0,

    heatmapLevels: ['#EBEDF0', '#C6E48B', '#7BC96F', '#239A3B', '#196127'],
    heatmapWeeks: ['', '一', '二', '三', '四', '五', '六', '日'],
  },

  // 监听属性变化 → 自动更新图表
  observers: {
    'period': function (period) {
      this._refreshTrendChart(period);
    },
    'todayStats, monthlyStats': function () {
      this._updateRingCharts();
    },
    'heatmapData': function (data) {
      if (Array.isArray(data) && data.length) {
        this._updateHeatmap();
      }
    },
  },

  lifetimes: {
    ready() {
      // 组件首次渲染完成时，用已有数据更新图表
      this._refreshTrendChart(this.data.period);
      this._updateRingCharts();
      if (Array.isArray(this.data.heatmapData) && this.data.heatmapData.length) {
        this._updateHeatmap();
      }
    },
  },

  methods: {
    /** 更新趋势图（日/周/月三视图） */
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

    /** 更新环形图（专注 vs 休息 + 任务完成率） */
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
          // 全零 → 无数据占位环；否则传真实值（注意：不能用 Math.max(...,1) 垫高，
          // 否则 100% 时另一侧显示为 1 导致图表永远到不了 100%）
          const focusData = (focus + rest === 0)
            ? [{ value: 0, name: '暂无', itemStyle: { color: '#E8E8E8' } }]
            : [
                { value: focus, name: '专注', itemStyle: { color: '#4A90D9' } },
                { value: rest, name: '休息', itemStyle: { color: '#FF9500' } },
              ];
          ecComp.chart.setOption({ series: [{ data: focusData }] });
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
          const taskData = (done + undone === 0)
            ? [{ value: 0, name: '暂无', itemStyle: { color: '#E8E8E8' } }]
            : [
                { value: done, name: '已完成', itemStyle: { color: '#4A90D9' } },
                { value: undone, name: '未完成', itemStyle: { color: '#E0E0E0' } },
              ];
          ecComp.chart.setOption({ series: [{ data: taskData }] });
        }
      }
    },

    /** 更新热力图 */
    _updateHeatmap() {
      const { heatmapData } = this.data;
      if (!Array.isArray(heatmapData) || !heatmapData.length) return;

      // 统一将基准时间归零到午夜，避免 new Date() 带时间分量导致 diffDays 偏差
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 41);

      // 6 周的 x 轴标签（如 "6/1", "6/8"……）
      const weekLabels = [];
      for (let w = 0; w < 6; w++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + w * 7);
        weekLabels.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}`);
      }

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
          date.setHours(0, 0, 0, 0); // 归一化到午夜

          const diffDays = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
          if (diffDays < 0 || diffDays > 41) return null;

          // w = 第几周（0-5），d = 星期几（0=周一……6=周日）
          const w = Math.floor(diffDays / 7);
          const dayOfWeek = date.getDay();
          const d = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const focusMinutes = item.focusMinutes || 0;

          return [w, d, focusMinutes];
        })
        .filter(Boolean);

      if (!data.length) return;

      const ecComp = this.selectComponent('#heatmapChart');
      if (ecComp && ecComp.chart) {
        ecComp.chart.setOption({
          xAxis: { data: weekLabels },
          series: [{ data }],
        });
      }
    },
  },
});
