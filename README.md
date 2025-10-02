# 技能五子棋 (Skills Gomoku)

基于文档需求实现的端到端五子棋开发样例，前端使用原生 HTML5 + CSS3 + JavaScript，通过 Canvas 绘制 15×15 棋盘，并实现技能系统交互。后端使用 Node.js + Express + ws，负责房间管理、实时状态同步与技能判定，附带模拟的微信登录接口。

## 功能特性

- 🎯 **传统五子棋规则**：黑棋先行，任意直线先连五获胜，支持重新开始与悔棋。
- 🪄 **八大技能**：包含移除棋子、冻结、随机生成己方棋子、恢复历史状态等一次性技能，支持冷却与一次性限制。
- 👥 **实时对战架构**：内存中的房间管理，支持玩家/观战角色分配，状态通过 WebSocket 广播。
- 💡 **可视化界面**：动态渐变背景、半透明信息面板、技能冷却面板、回合提示、目标选择高亮。
- 🧪 **基础回归测试**：`scripts/run-tests.js` 覆盖核心胜负判定、技能生效、重开流程。

## 项目结构

```
backend/          # Node.js 服务端逻辑
  gameSession.js  # 对局状态、技能效果、历史记录
  gameManager.js  # WebSocket 客户端与房间管理
  server.js       # Express 服务、API、WebSocket 入口
  skillDefinitions.js
frontend/         # 前端静态资源
  index.html
  styles.css
  main.js         # Canvas 绘制、技能交互、房间加入
scripts/
  run-tests.js    # Node 自检脚本
wuziqi.txt        # 原始需求文档
```

## 快速开始

> 需要 Node.js 18+ 环境。

```bash
npm install
npm run dev
```

默认监听 <http://localhost:3000>，浏览器打开即可开始游戏。首次进入自动分配房间与身份，可通过右上角“复制邀请链接”分享给对手。

### 技能使用说明

1. 轮到自己且未被冻结时，可点击技能卡片。
2. 需要选取目标的技能（例如飞沙走石、呀嘞呀）会提示在棋盘上点选敌方棋子。
3. “东山再起”会弹出输入框，填写要恢复的历史回合号（`0` 表示开局）。
4. “力拔山兮”“See you again”会弹出二次确认，防止误触。

### 模拟微信登录接口

- `POST /api/login/wechat`：接收 `{ code }`，返回模拟 token 与昵称。
- 前端示例暂未接入，可在未来替换为真实微信开放平台流程。

## 脚本与测试

```bash
npm test        # 运行核心逻辑自检
```

测试脚本覆盖：
- 横向连五胜利判定
- “飞沙走石”技能移除对方棋子
- `forceRestart()` 重置棋局与技能状态

## 后续拓展建议

- 接入持久化存储（如 Redis）与匹配队列，支持多房间并发。
- 使用 JWT/Session 对接真实微信登录与好友邀请流程。
- 引入 WebRTC 或 Socket.IO，增强断线重连、房间广播能力。
- 为技能动画与提示增加音效、粒子效果，提升沉浸体验。
