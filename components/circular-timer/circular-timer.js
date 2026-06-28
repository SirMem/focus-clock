const MODE_COLORS = {
  focus: '#4A90D9',
  shortBreak: '#34C759',
  longBreak: '#FF9500',
};

const MODE_LABELS = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
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
    canvasWidth: 300,
    canvasHeight: 300,
    _canvasInitialized: false,
  },

  methods: {
    async initCanvas() {
      if (this.data._canvasInitialized) return;

      try {
        const query = this.createSelectorQuery();
        const node = await new Promise((resolve) => {
          query
            .select('#timerCanvas')
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
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = node.width || this.data.canvasWidth;
        const height = node.height || this.data.canvasHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this._canvas = canvas;
        this._ctx = ctx;
        this._canvasWidth = width;
        this._canvasHeight = height;
        this.setData({ _canvasInitialized: true });

        this.drawRing(this.properties.progress);
      } catch (err) {
        console.error('Canvas init error:', err);
      }
    },

    drawRing(progress = this.properties.progress) {
      if (!this._ctx || !this.data._canvasInitialized) {
        if (!this._retryTimer) {
          this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this.drawRing(this.properties.progress);
          }, 200);
        }
        return;
      }

      const ctx = this._ctx;
      const w = this._canvasWidth || this.data.canvasWidth;
      const h = this._canvasHeight || this.data.canvasHeight;
      const size = Math.min(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const radius = size * (110 / 300);
      const ringWidth = size * (8 / 300);
      const color = this.data.ringColor;
      const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));

      ctx.clearRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = ringWidth;
      ctx.lineCap = 'butt';
      ctx.stroke();

      if (safeProgress > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * safeProgress;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = ringWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    },

    handleModeChange(mode) {
      const color = MODE_COLORS[mode] || MODE_COLORS.focus;
      this.setData({ ringColor: color }, () => {
        this.updateState(this.properties.state);
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
      const modeLabel = MODE_LABELS[this.properties.mode] || MODE_LABELS.focus;
      const labels = {
        idle: '准备开始',
        running: `${modeLabel}中`,
        paused: '已暂停',
      };
      this.setData({ stateLabel: labels[state] || '' });
    },
  },

  lifetimes: {
    attached() {
      this.updateTimeDisplay(this.properties.timeLeft);
      this.updateState(this.properties.state);
      const color = MODE_COLORS[this.properties.mode] || MODE_COLORS.focus;
      this.setData({ ringColor: color });
    },
    ready() {
      this.initCanvas();
    },
    detached() {
      if (this._retryTimer) clearTimeout(this._retryTimer);
    },
  },
});
