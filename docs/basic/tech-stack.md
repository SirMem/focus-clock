# 项目技术栈

## 运行环境

- **小程序端**：微信小程序（基础库 3.7.12+）
- **后端**：微信云开发 CloudBase（FaaS + 云数据库）
- **云函数运行时**：Node.js 18（@cloudbase/node-sdk v2.x）

## 核心依赖

### 小程序端

| 依赖 | 用途 |
|------|------|
| tdesign-miniprogram | TDesign 组件库（UI 组件 + Icon） |
| echarts (ec-canvas) | 统计图表（后续使用） |

### 云函数端

| 依赖 | 用途 |
|------|------|
| @cloudbase/node-sdk | 云开发 Node.js SDK（数据库读写） |
| tcb-router | Koa 风格云函数路由分发 |

## 工具链

- **开发工具**：微信开发者工具
- **云函数部署**：微信开发者工具中"上传并部署"，或 CloudBase CLI
- **版本管理**：Git + GitHub
- **代码审查**：Claude Code diff review + 合并

## 维护规则

- 每次新增、移除或升级核心依赖后，更新本文件
- 云函数在 `cloudfunctions/` 各自的目录下 `npm install` 管理依赖
