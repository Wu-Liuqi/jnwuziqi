const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { GameManager, GameError } = require('./gameManager');
const { SKILLS } = require('./skillDefinitions');

const app = express();
const manager = new GameManager();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/skills', (_req, res) => {
  res.json(SKILLS);
});

app.post('/api/login/wechat', (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ message: '缺少微信授权码 code' });
  }

  const token = `mock-${Buffer.from(code).toString('base64url')}`;
  res.json({
    token,
    profile: {
      nickname: '微信玩家',
      avatar: null
    }
  });
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientId = manager.registerClient(ws);

  const safeSend = (message) => {
    ws.send(JSON.stringify(message));
  };

  safeSend({ type: 'connected', payload: { clientId } });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      safeSend({ type: 'error', payload: { message: '消息格式无效' } });
      return;
    }

    const { type, payload } = message || {};

    try {
      switch (type) {
        case 'join': {
          const joinResult = manager.handleJoin(clientId, payload);
          safeSend({ type: 'joined', payload: joinResult });
          break;
        }
        case 'move':
          manager.handleMove(clientId, payload);
          break;
        case 'skill':
          manager.handleSkill(clientId, payload);
          break;
        case 'restart':
          manager.handleRestart(clientId);
          break;
        case 'state': {
          const state = manager.getState(clientId);
          safeSend({ type: 'state', payload: state });
          break;
        }
        case 'ping':
          safeSend({ type: 'pong', payload: Date.now() });
          break;
        default:
          safeSend({ type: 'error', payload: { message: '未知消息类型' } });
      }
    } catch (err) {
      if (err instanceof GameError) {
        safeSend({ type: 'error', payload: { message: err.message, code: err.code } });
      } else {
        console.error('[ws] 未处理异常', err);
        safeSend({ type: 'error', payload: { message: '服务器内部错误' } });
      }
    }
  });

  ws.on('close', () => {
    manager.removeClient(clientId);
  });

  ws.on('error', (err) => {
    console.warn('[ws] 连接错误', err.message);
    manager.removeClient(clientId);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`技能五子棋服务已启动: http://localhost:${PORT}`);
});
