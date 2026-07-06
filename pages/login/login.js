const app = getApp()
const userAPI = require('../../miniprogram/api/user.api');
const { saveLoginState, clearLoginState } = require('../../miniprogram/api/auth');

// SVG base64 data URLs（避免 WXML 过长）
const TOMATO_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ibGctYm9keSIgY3g9IjM4JSIgY3k9IjMyJSIgcj0iNjUlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI0ZGOEE3MCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjU1JSIgc3RvcC1jb2xvcj0iI0YwNEUzNyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNDMDM5MkIiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImxnLXNoaW5lIiBjeD0iMzUlIiBjeT0iMjglIiByPSIzOCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNSkiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSJyZ2JhKDI1NSwyNTUsMjU1LDApIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogICAgPGZpbHRlciBpZD0ibGctc2hhZG93IiB4PSItMjAlIiB5PSItMTAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlRHJvcFNoYWRvdyBkeD0iMCIgZHk9IjMiIHN0ZERldmlhdGlvbj0iMyIgZmxvb2QtY29sb3I9IiNDMDM5MkIiIGZsb29kLW9wYWNpdHk9IjAuMjUiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KICA8cGF0aCBkPSJNMzYgMTQgQzM2IDE0IDM0IDggMzYgNiIgc3Ryb2tlPSIjMjdBRTYwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZmlsbD0ibm9uZSIvPgogIDxwYXRoIGQ9Ik0zMyAxNSBDMjggMTEgMjQgMTQgMjYgMTggQzI4IDIwIDMzIDE4IDM1IDE2WiIgZmlsbD0iIzJFQ0M3MSIvPgogIDxwYXRoIGQ9Ik0zOSAxNSBDNDQgMTEgNDggMTQgNDYgMTggQzQ0IDIwIDM5IDE4IDM3IDE2WiIgZmlsbD0iIzI3QUU2MCIvPgogIDxwYXRoIGQ9Ik0zNiAxNSBMMzEgMTcgTTM2IDE1IEw0MSAxNyIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNCkiIHN0cm9rZS13aWR0aD0iMC44IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNMTQgMzggQzE0IDI0IDI0IDE3IDM2IDE3IEM0OCAxNyA1OCAyNCA1OCAzOCBDNTggNTIgNDggNjAgMzYgNjAgQzI0IDYwIDE0IDUyIDE0IDM4WiIgZmlsbD0idXJsKCNsZy1ib2R5KSIgZmlsdGVyPSJ1cmwoI2xnLXNoYWRvdykiLz4KICA8cGF0aCBkPSJNMzYgMTkgQzMzIDI4IDMzIDQyIDM0IDU4IiBzdHJva2U9InJnYmEoMCwwLDAsMC4wNykiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIGZpbGw9Im5vbmUiLz4KICA8cGF0aCBkPSJNMzYgMTkgQzM5IDI4IDM5IDQyIDM4IDU4IiBzdHJva2U9InJnYmEoMCwwLDAsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIi8+CiAgPGVsbGlwc2UgY3g9IjI3IiBjeT0iMjgiIHJ4PSI3IiByeT0iNSIgZmlsbD0idXJsKCNsZy1zaGluZSkiIHRyYW5zZm9ybT0icm90YXRlKC0yNSAyNyAyOCkiLz4KPC9zdmc+"

const WECHAT_ICON =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjIiIGhlaWdodD0iMjIiIHZpZXdCb3g9IjAgMCAyMiAyMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNOC41IDRDNC45MSA0IDIgNi40NiAyIDkuNUMyIDExLjE5IDIuOSAxMi43IDQuMjkgMTMuNzJMMy41IDE2LjVMNi41IDE1QzcuMTMgMTUuMTcgNy44IDE1LjI2IDguNSAxNS4yNkM4LjY4IDE1LjI2IDguODYgMTUuMjUgOS4wNCAxNS4yM0M4Ljg4IDE0LjgzIDguNzkgMTQuNCA4Ljc5IDEzLjk1QzguNzkgMTEuMjIgMTEuNDEgOSAxNC42IDlDMTQuNzMgOSAxNC44NyA5LjAxIDE1IDkuMDJDMTQuNDEgNi4yIDExLjczIDQgOC41IDRaIiBmaWxsPSJ3aGl0ZSIvPgogIDxwYXRoIGQ9Ik0yMCAxMy45NUMyMCAxMS43NiAxNy45MSAxMCAxNS4zOCAxMEMxMi44NSAxMCAxMC43NiAxMS43NiAxMC43NiAxMy45NUMxMC43NiAxNi4xNCAxMi44NSAxNy45IDE1LjM4IDE3LjlDMTUuOTEgMTcuOSAxNi40MyAxNy44MiAxNi45IDE3LjY4TDE5LjI1IDE5TDE4LjYyIDE3LjAyQzE5LjQ3IDE2LjMxIDIwIDE1LjE5IDIwIDEzLjk1WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+"

const SPINNER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSI4IiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4zKSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHBhdGggZD0iTTEwIDJBOCA4IDAgMCAxIDE4IDEwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4="

Page({
  data: {
    statusBarHeight: 44,
    btnState: 'default',
    btnClass: '',
    btnDisabled: false,
    btnText: '微信登录',
    tomatoLogoSrc: TOMATO_LOGO,
    wechatLogoSrc: WECHAT_ICON,
    spinnerSrc: SPINNER
  },

  onLoad() {
    let statusBarHeight = 44;
    try {
      const sysInfo = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
      statusBarHeight = sysInfo.statusBarHeight || 44;
    } catch (err) {
      console.warn('[login] get window info failed:', err);
    }
    this.setData({
      statusBarHeight
    })
  },

  // 更新按钮状态的统一方法
  _setBtnState(state) {
    const stateMap = {
      default: { btnClass: '', btnDisabled: false, btnText: '微信登录' },
      loading: { btnClass: 'btn-loading', btnDisabled: true, btnText: '登录中...' },
      disabled: { btnClass: 'btn-disabled', btnDisabled: true, btnText: '微信登录' }
    }
    const update = stateMap[state] || stateMap.default
    this.setData({
      btnState: state,
      btnClass: update.btnClass,
      btnDisabled: update.btnDisabled,
      btnText: update.btnText
    })
  },

  async handleLogin() {
    if (this.data.btnState !== 'default') return
    this._setBtnState('loading')

    wx.login({
      success: (res) => {
        if (!res.code) {
        
          wx.showToast({ title: '获取登录凭证失败', icon: 'none' });
          this._setBtnState('default');
          return;
        }
        console.log(res);
        this._doCloudLogin(res.code);
      },
      fail: (err) => {
        console.warn('[login] wx.login failed:', err);
        wx.showToast({ title: '微信登录失败，请重试', icon: 'none' });
        this._setBtnState('default');
      },
    });
  },

  async _doCloudLogin(code) {
    try {
      // wx.login 只做身份鉴权；头像昵称由 Profile 页通过 chooseAvatar + type=nickname 主动采集
      const res = await userAPI.login(code);
      if (res.code !== 0 || !res.data || !res.data.openid) {
        console.warn('[login] unexpected response:', res);
        wx.showToast({ title: res && res.message ? res.message : '登录异常', icon: 'none' });
        this._setBtnState('default');
        return;
      }

      const { openid, user } = res.data;

      // 保存登录态
      saveLoginState({ openid, user });

      // 更新全局数据
      app.globalData.userInfo = user;
      app.globalData.isLoggedIn = true;

      wx.showToast({ title: '已使用微信身份登录', icon: 'none' });

      // 跳转到专注页
      wx.switchTab({
        url: '/pages/focus/focus',
        fail: (navErr) => {
          console.error('[login] switchTab failed:', navErr);
          clearLoginState();
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          wx.showToast({ title: '登录跳转失败', icon: 'none' });
          this._setBtnState('default');
        }
      });
    } catch (err) {
      console.error('login failed:', err);
      wx.showToast({ title: '登录服务异常', icon: 'none' });
      this._setBtnState('default');
    }
  }
})
