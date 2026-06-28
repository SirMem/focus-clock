const MODE_COLORS = {
  focus: '#4A90D9',
  shortBreak: '#34C759',
  longBreak: '#FF9500',
};

Component({
  properties: {
    progress: {
      type: Number,
      value: 0,
      observer: 'drawRing',
    },
    mode: {
      type: String,
      value: 'focus',
      observer: 'handleModeChange',
    },
    timeLeft: {
      type: Number,
      value: 1500,
      observer: 'updateTimeDisplay',
    },
    state: {
      type: String,
      value: 'idle',
      observer: 'updateState',
    },
  },

  data: {
    formattedTime: '25:00',
    stateLabel: '准备开始',
    ringColor: '#4A90D9',
    canvasWidth: 360,
    canvasHeight: 360,
    _canvasInitialized: false,
  },

  methods: {
    async initCanvas() {
      if (this.data._canvasInitialized) return;
      
      try {
        const query = this.createSelectorQuery();
        const node = await new Promise((resolve) => {
          query.select('#timerCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
              resolve(res[0]);
            });
        });

        if (!node || !node.node) {
          console.error('Canvas node not found');
          return;
        }

        const canvas = node.node;
        const ctx = canvas.getContext('2d');

        // 适配像素密度
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = this.data.canvasWidth * dpr;
        canvas.height = this.data.canvasHeight * dpr;
        ctx.scale(dpr, dpr);

        this._canvas = canvas;
        this._ctx = ctx;
        this.setData({ _canvasInitialized: true });

        // 初始绘制
        this.drawRing(this.properties.progress);
      } catch (err) {
        console.error('Canvas init error:', err);
      }
    },

    drawRing(progress) {
      if (!this._ctx || !this.data._canvasInitialized) {
        // 延迟一次重试
        if (!this._retryTimer) {
          this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this.drawRing(this.properties.progress);
          }, 200);
        }
        return;
      }

      const ctx = this._ctx;
      const w = this.data.canvasWidth;
      const h = this.data.canvasHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = 155; // 半径
      const ringWidth = 14; // 圆环宽度
      const color = this.data.ringColor;

      // 清空画布
      ctx.clearRect(0, 0, w, h);

      // 背景圆环
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#E8ECF0';
      ctx.lineWidth = ringWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 进度圆环（从顶部开始，顺时针）
      if (progress > 0) {
        const startAngle = -Math.PI / 2; // 从12点钟方向开始
        const endAngle = startAngle + Math.PI * 2 * progress;
        
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = ringWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 起点小圆点装饰（只在进度>0且<1时显示）
      if (progress > 0 && progress < 1) {
        const dotAngle = -Math.PI / 2;
        const dotX = cx + radius * Math.cos(dotAngle);
        const dotY = cy + radius * Math.sin(dotAngle);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // 结束小圆点装饰
      if (progress > 0 && progress < 1) {
        const endAngle = -Math.PI / 2 + Math.PI * 2 * progress;
        const endX = cx + radius * Math.cos(endAngle);
        const endY = cy + radius * Math.sin(endAngle);
        ctx.beginPath();
        ctx.arc(endX, endY, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // 发光效果（运行中）
      if (this.properties.state === 'running' && progress < 1) {
        ctx.shadowColor = color + '40';
        ctx.shadowBlur = 20;
        // 重新绘制进度环带发光
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = ringWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    },

    handleModeChange(mode) {
      const color = MODE_COLORS[mode] || '#4A90D9';
      this.setData({ ringColor: color }, () => {
        this.drawRing(this.properties.progress);
      });
    },

    updateTimeDisplay(timeLeft) {
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      this.setData({ formattedTime: formatted });
    },

    updateState(state) {
      const labels = {
        idle: this.properties.mode === 'focus' ? '开始专注' : '休息一下',
        running: '专注中',
        paused: '已暂停',
      };
      this.setData({ stateLabel: labels[state] || '' });
    },
  },

  lifetimes: {
    attached() {
      this.updateTimeDisplay(this.properties.timeLeft);
      this.updateState(this.properties.state);
      const color = MODE_COLORS[this.properties.mode] || '#4A90D9';
      this.setData({ ringColor: color });
    },
    ready() {
      // 在组件渲染完成后初始化 Canvas
      this.initCanvas();
    },
    detached() {
      if (this._retryTimer) clearTimeout(this._retryTimer);
    },
  },
});
