const BOARD_SIZE = 15;
const BOARD_PADDING = 28;
const STAR_POINTS = [
  [3, 3],
  [3, 11],
  [11, 3],
  [11, 11],
  [7, 7]
];

const SKILL_META = {
  'flying-sand': {
    targetType: 'opponent',
    maxTargets: 1,
    instruction: '选择1颗敌方棋子以移除'
  },
  'yale-ya': {
    targetType: 'opponent',
    maxTargets: 2,
    instruction: '最多选择2颗敌方棋子以移除'
  },
  'calm-water': {
    instruction: '冻结对手1回合'
  },
  capture: {
    instruction: '为己方随机生成棋子'
  },
  rewind: {
    instruction: '悔棋一步'
  },
  'reset-board': {
    instruction: '清空棋盘并重置游戏',
    confirm: '确定要清空整个棋盘并重置技能冷却吗？'
  },
  restore: {
    instruction: '恢复至指定历史回合',
    requiresInput: true,
    prompt: '输入要恢复的历史回合号（0 表示开局状态）'
  },
  'see-you-again': {
    instruction: '移除敌方所有棋子',
    confirm: '确定要移除对方所有棋子吗？'
  }
};

const RULES_HTML = `
  <p>• 棋盘为15×15，黑棋（子琪）先行，任意直线上率先连成五子者胜。</p>
  <p>• 玩家共享 8 个一次性技能，每个技能具有不同冷却与效果：</p>
  <ul>
    <li><strong>飞沙走石</strong>：移除敌方1颗棋子（冷却2回合）。</li>
    <li><strong>静如止水</strong>：冻结敌方1回合，期间无法落子（冷却4回合）。</li>
    <li><strong>呀嘞呀</strong>：移除敌方2颗棋子（冷却5回合）。</li>
    <li><strong>擒拿擒拿</strong>：随机生成己方棋子（冷却6回合）。</li>
    <li><strong>时光倒流</strong>：悔棋一步（冷却7回合）。</li>
    <li><strong>力拔山兮</strong>：清空棋盘并保留双方阵营（冷却15回合）。</li>
    <li><strong>东山再起</strong>：恢复至指定历史回合（冷却10回合）。</li>
    <li><strong>See you again</strong>：移除敌方所有棋子（冷却20回合）。</li>
  </ul>
  <p>• 技能只能在己方回合且未被冻结时发动，每个技能每局仅可使用一次。</p>
  <p>• 点击技能图标按提示选择目标，或使用重新开始按钮重置整局。</p>
  <p>• 微信登录及好友邀请功能可通过后端接口接入真实服务，此演示提供模拟登录。</p>
`;

const elements = {
  subtitle: document.getElementById('subtitle'),
  roomCode: document.getElementById('room-code'),
  copyRoom: document.getElementById('copy-room'),
  boardCanvas: document.getElementById('board-canvas'),
  restartBtn: document.getElementById('restart-btn'),
  rulesBtn: document.getElementById('rules-btn'),
  turnNumber: document.getElementById('turn-number'),
  moveCount: document.getElementById('move-count'),
  gameStatus: document.getElementById('game-status'),
  playerBlackName: document.getElementById('player-black-name'),
  playerWhiteName: document.getElementById('player-white-name'),
  playerBlackTurn: document.getElementById('player-black-turn'),
  playerWhiteTurn: document.getElementById('player-white-turn'),
  playerCards: {
    black: document.querySelector('.player-card[data-color="black"]'),
    white: document.querySelector('.player-card[data-color="white"]')
  },
  skillGrid: document.getElementById('skill-grid'),
  skillsPanelTitle: document.querySelector('.skills-panel h2'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalClose: document.getElementById('modal-close'),
  toast: document.getElementById('toast'),
  mobilePanelTabs: document.querySelector('.mobile-panel-tabs'),
  mobilePanelButtons: Array.from(document.querySelectorAll('.panel-tab[data-panel-target]')),
  mobilePanels: Array.from(document.querySelectorAll('.mobile-panel[data-panel]'))
};

const state = {
  socket: null,
  clientId: null,
  roomId: new URLSearchParams(window.location.search).get('room') || null,
  displayName: null,
  role: 'spectator',
  color: null,
  game: null,
  selection: null,
  hoverCell: null,
  pingTimer: null,
  toastTimer: null,
  activeMobilePanel: null,
  resizeObserver: null
};

function init() {
  state.displayName = ensureDisplayName();
  wireEvents();
  setupMobilePanels();
  connectSocket();
  adjustCanvasSize();
  drawBoard();
  window.requestAnimationFrame(() => {
    adjustCanvasSize();
    drawBoard();
  });
}

function ensureDisplayName() {
  const stored = localStorage.getItem('skills-gomoku-name');
  if (stored) {
    return stored;
  }
  const fallback = `玩家${Math.floor(Math.random() * 1000)}`;
  const input = window.prompt('请输入昵称（用于展示给对手）', fallback) || fallback;
  const trimmed = input.trim().slice(0, 12) || fallback;
  localStorage.setItem('skills-gomoku-name', trimmed);
  return trimmed;
}

function wireEvents() {
  elements.copyRoom.addEventListener('click', copyRoomLink);
  elements.restartBtn.addEventListener('click', handleRestart);
  elements.rulesBtn.addEventListener('click', showRules);
  elements.modalClose.addEventListener('click', hideModal);
  elements.modal.addEventListener('click', (evt) => {
    if (evt.target === elements.modal) {
      hideModal();
    }
  });

  const canvas = elements.boardCanvas;
  if (canvas) {
    canvas.addEventListener('click', handleBoardClick);

    const supportsPointer = typeof window.PointerEvent === 'function';
    if (supportsPointer) {
      canvas.addEventListener('pointermove', handleBoardHover, { passive: true });
      canvas.addEventListener('pointerdown', handleBoardHover);
      canvas.addEventListener('pointerleave', clearHoverCell);
    } else {
      canvas.addEventListener('mousemove', handleBoardHover);
      canvas.addEventListener('mouseleave', clearHoverCell);
      canvas.addEventListener('touchstart', handleBoardHover, { passive: true });
      canvas.addEventListener('touchmove', handleBoardHover, { passive: true });
      canvas.addEventListener('touchend', clearHoverCell, { passive: true });
      canvas.addEventListener('touchcancel', clearHoverCell, { passive: true });
    }

    if (window.ResizeObserver && canvas.parentElement) {
      if (state.resizeObserver) {
        state.resizeObserver.disconnect();
      }
      state.resizeObserver = new ResizeObserver(() => {
        adjustCanvasSize();
        drawBoard();
      });
      state.resizeObserver.observe(canvas.parentElement);
    }
  }

  const handleResize = () => {
    adjustCanvasSize();
    drawBoard();
  };

  window.addEventListener('resize', handleResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.selection) {
      cancelSelection('取消当前技能目标选择');
    }
  });
}

function setupMobilePanels() {
  const buttons = elements.mobilePanelButtons;
  const panels = elements.mobilePanels;
  if (!Array.isArray(buttons) || buttons.length === 0 || !Array.isArray(panels) || panels.length === 0) {
    return;
  }

  const fallback = panels[0]?.dataset?.panel || 'info';
  let preferred = fallback;

  try {
    const stored = localStorage.getItem('skills-mobile-panel-active');
    if (stored && panels.some((panel) => panel.dataset.panel === stored)) {
      preferred = stored;
    }
  } catch (err) {
    console.warn('无法读取面板偏好', err);
  }

  const mediaQuery = window.matchMedia('(max-width: 640px)');

  const apply = (panelId, options = {}) => {
    const { skipPersist = false } = options;
    const resolved = panels.some((panel) => panel.dataset.panel === panelId) ? panelId : fallback;
    const isDesktop = !mediaQuery.matches;

    panels.forEach((panel) => {
      const active = isDesktop || panel.dataset.panel === resolved;
      panel.classList.toggle('is-active', active);
      if (isDesktop) {
        panel.removeAttribute('aria-hidden');
      } else {
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      }
    });

    buttons.forEach((button) => {
      const isActive = button.dataset.panelTarget === resolved;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.setAttribute('aria-pressed', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    state.activeMobilePanel = resolved;

    if (!skipPersist) {
      try {
        localStorage.setItem('skills-mobile-panel-active', resolved);
      } catch (err) {
        console.warn('无法保存面板偏好', err);
      }
    }

    adjustCanvasSize();
    drawBoard();
  };

  const setActive = (panelId, options) => {
    apply(panelId, options);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => setActive(button.dataset.panelTarget));
  });

  const handleMediaChange = () => {
    apply(state.activeMobilePanel || preferred, { skipPersist: true });
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleMediaChange);
  }

  setActive(preferred, { skipPersist: true });
}

function connectSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}`;
  const socket = new WebSocket(wsUrl);
  state.socket = socket;

  socket.addEventListener('open', () => {
    updateSubtitle('连接成功，正在加入房间...');
  });

  socket.addEventListener('message', handleSocketMessage);

  socket.addEventListener('close', () => {
    clearInterval(state.pingTimer);
    showToast('连接已断开，如需继续请刷新页面', 'error', 6000);
    updateSubtitle('连接已断开');
  });

  socket.addEventListener('error', () => {
    showToast('网络异常，请检查网络后刷新页面', 'error');
  });

  state.pingTimer = setInterval(() => {
    sendMessage('ping', { time: Date.now() });
  }, 20000);
}

function handleSocketMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch (err) {
    console.warn('无法解析消息', err);
    return;
  }

  const { type, payload } = message;

  switch (type) {
    case 'connected':
      state.clientId = payload?.clientId || null;
      sendJoin();
      break;
    case 'joined':
      applyJoinResult(payload);
      break;
    case 'state':
      applyGameState(payload);
      break;
    case 'error':
      handleServerError(payload);
      break;
    case 'pong':
      break;
    default:
      console.debug('收到未知消息类型', type, payload);
  }
}

function sendJoin() {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }
  sendMessage('join', {
    roomId: state.roomId,
    displayName: state.displayName
  });
}

function applyJoinResult(payload) {
  if (!payload) {
    return;
  }

  state.roomId = payload.roomId || state.roomId;
  state.role = payload.role || state.role;
  state.color = payload.color || null;
  state.displayName = payload.displayName || state.displayName;

  if (state.roomId) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', state.roomId);
    window.history.replaceState(null, '', url.toString());
  }

  elements.roomCode.textContent = state.roomId || '--';
  elements.copyRoom.disabled = !state.roomId;

  if (payload.state) {
    applyGameState(payload.state);
  }

  const identity = state.role === 'player'
    ? `已加入房间，身份：${state.color === 'black' ? '黑棋（子琪）' : '白棋（张呈）'}`
    : '以观战者身份加入房间';
  showToast(identity, 'info');
}

function applyGameState(gameState) {
  if (!gameState) {
    return;
  }
  state.game = gameState;

  if (state.selection) {
    const skillId = state.selection.skill.id;
    const ownerSkills = gameState.skills?.[state.color || 'black'] || [];
    const skillNow = ownerSkills.find((item) => item.id === skillId);
    if (!skillNow || skillNow.used || !skillNow.available) {
      cancelSelection();
    }
  }

  updateUiFromState();
  drawBoard();
}

function handleServerError(payload) {
  const message = payload?.message || '服务器内部错误';
  showToast(message, 'error');
  if (state.selection) {
    cancelSelection();
  }
}

function sendMessage(type, payload) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }
  state.socket.send(JSON.stringify({ type, payload }));
}

function handleRestart() {
  if (!state.game) {
    return;
  }
  if (!window.confirm('确定重新开始？这会清空当前棋盘并重置技能使用状态。')) {
    return;
  }
  sendMessage('restart');
  showToast('已发送重新开始请求', 'info');
}

function showRules() {
  elements.modalTitle.textContent = '技能与规则说明';
  elements.modalBody.innerHTML = RULES_HTML;
  elements.modal.classList.remove('hidden');
}

function hideModal() {
  elements.modal.classList.add('hidden');
}

function copyRoomLink() {
  if (!state.roomId) {
    showToast('房间尚未创建', 'warning');
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('room', state.roomId);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url.toString()).then(() => {
      showToast('邀请链接已复制', 'success');
    }).catch(() => {
      legacyCopy(url.toString());
    });
  } else {
    legacyCopy(url.toString());
  }
}

function legacyCopy(text) {
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', 'true');
  temp.style.position = 'absolute';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);
  temp.select();
  try {
    document.execCommand('copy');
    showToast('邀请链接已复制', 'success');
  } catch (err) {
    showToast('复制失败，请手动复制地址栏链接', 'error');
  } finally {
    document.body.removeChild(temp);
  }
}

function showToast(message, variant = 'info', duration = 3200) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.variant = variant;
  elements.toast.classList.remove('hidden');
  requestAnimationFrame(() => {
    elements.toast.classList.add('visible');
  });
  state.toastTimer = setTimeout(() => {
    elements.toast.classList.remove('visible');
  }, duration);
}

function updateUiFromState() {
  const { game } = state;
  if (!game) {
    return;
  }

  const moveCount = countPlacedStones(game.board);
  elements.turnNumber.textContent = game.turnNumber ?? moveCount;
  elements.moveCount.textContent = moveCount;

  const statusText = {
    waiting: '等待玩家加入',
    playing: '对局进行中',
    finished: '对局已结束'
  }[game.status?.phase] || '对局状态未知';

  elements.gameStatus.textContent = statusText;

  if (game.players?.black) {
    elements.playerBlackName.textContent = game.players.black.displayName;
  }
  if (game.players?.white) {
    elements.playerWhiteName.textContent = game.players.white.displayName;
  }

  updatePlayerCard('black');
  updatePlayerCard('white');
  renderSkillGrid();
  updateSubtitleFromState();
}

function updatePlayerCard(color) {
  const card = elements.playerCards[color];
  if (!card || !state.game) {
    return;
  }
  const turnElement = color === 'black' ? elements.playerBlackTurn : elements.playerWhiteTurn;
  const isActive = state.game.currentTurn === color && !state.game.winner;
  const freezeTurns = state.game.freeze?.[color] ?? 0;

  card.classList.toggle('active', isActive);
  card.classList.toggle('frozen', freezeTurns > 0);

  if (state.game.winner === color) {
    turnElement.textContent = '已获胜';
  } else if (state.game.winner) {
    turnElement.textContent = '对局结束';
  } else if (freezeTurns > 0) {
    turnElement.textContent = `冻结中（剩余 ${freezeTurns} 回合）`;
  } else if (isActive) {
    turnElement.textContent = '进行中';
  } else {
    turnElement.textContent = '等待中';
  }
}

function renderSkillGrid() {
  const { game } = state;
  if (!game || !game.skills) {
    elements.skillGrid.innerHTML = '<p class="empty-hint">等待数据...</p>';
    return;
  }

  const owner = state.color || 'black';
  const skillList = game.skills[owner] || [];
  const ownerName = game.players?.[owner]?.displayName || (owner === 'black' ? '子琪' : '张呈');
  elements.skillsPanelTitle.textContent = `技能冷却（${ownerName}）`;

  const canOperate = canOperateNow();
  const fragment = document.createDocumentFragment();

  skillList.forEach((skill) => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.dataset.skillId = skill.id;

    const statusTag = document.createElement('span');
    statusTag.classList.add('status-tag');

    if (skill.used) {
      card.classList.add('used');
      statusTag.classList.add('used');
      statusTag.textContent = '已使用';
    } else if (!skill.available) {
      card.classList.add('disabled');
      statusTag.classList.add('cooldown');
      statusTag.textContent = `冷却 ${skill.remainingCooldown}`;
    } else if (!canOperate || owner !== state.color) {
      card.classList.add('disabled');
      statusTag.classList.add('ready');
      statusTag.textContent = '待机';
    } else {
      statusTag.classList.add('ready');
      statusTag.textContent = '就绪';
    }

    if (state.selection?.skill?.id === skill.id) {
      card.classList.add('selected');
    }

    card.innerHTML = `
      <header>
        <span class="skill-name">${skill.name}</span>
        <span class="cooldown">CD ${skill.cooldown}</span>
      </header>
      <p class="skill-desc">${skill.description}</p>
    `;
    card.appendChild(statusTag);

    if (!card.classList.contains('disabled') && !card.classList.contains('used')) {
      card.addEventListener('click', () => handleSkillClick(skill));
    }

    fragment.appendChild(card);
  });

  elements.skillGrid.innerHTML = '';
  elements.skillGrid.appendChild(fragment);
}

function handleSkillClick(skill) {
  if (!canOperateNow()) {
    showToast('当前无法使用技能（可能未轮到你或处于冻结状态）', 'warning');
    return;
  }

  const meta = SKILL_META[skill.id];
  if (!meta) {
    sendMessage('skill', { skillId: skill.id });
    return;
  }

  if (meta.confirm && !window.confirm(meta.confirm)) {
    return;
  }

  if (meta.requiresInput) {
    const turn = window.prompt(meta.prompt, '0');
    if (turn === null) {
      return;
    }
    const parsed = Number.parseInt(turn, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      showToast('请输入合法的回合号', 'warning');
      return;
    }
    sendMessage('skill', { skillId: skill.id, data: { turnNumber: parsed } });
    return;
  }

  if (meta.targetType === 'opponent') {
    startTargetSelection(skill, meta);
    return;
  }

  sendMessage('skill', { skillId: skill.id });
}

function startTargetSelection(skill, meta) {
  const validTargets = computeValidTargets(meta);
  if (!validTargets.length) {
    showToast('当前没有可选的敌方棋子', 'warning');
    return;
  }
  state.selection = {
    skill,
    meta,
    targets: [],
    validTargets
  };
  updateSubtitleFromState();
  drawBoard();
}

function cancelSelection(message) {
  state.selection = null;
  if (message) {
    showToast(message, 'info');
  }
  updateSubtitleFromState();
  drawBoard();
}

function computeValidTargets(meta) {
  if (!state.game) {
    return [];
  }
  const opponent = state.color === 'black' ? 'white' : 'black';
  const valid = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (state.game.board?.[y]?.[x] === opponent) {
        valid.push({ x, y });
      }
    }
  }
  return valid;
}

function handleBoardClick(event) {
  const cell = locateCell(event);
  if (!cell) {
    return;
  }

  if (state.selection) {
    handleSelectionClick(cell);
    return;
  }

  if (!canOperateNow()) {
    showToast('当前无法落子', 'warning');
    return;
  }

  if (state.game?.board?.[cell.y]?.[cell.x]) {
    showToast('该位置已有棋子', 'warning');
    return;
  }

  sendMessage('move', cell);
}

function handleSelectionClick(cell) {
  const selection = state.selection;
  if (!selection) {
    return;
  }
  const key = `${cell.x},${cell.y}`;
  const isValid = selection.validTargets.some((target) => target.x === cell.x && target.y === cell.y);
  if (!isValid) {
    showToast('该位置不是有效目标', 'warning');
    return;
  }

  const existingIndex = selection.targets.findIndex((target) => target.x === cell.x && target.y === cell.y);
  if (existingIndex >= 0) {
    selection.targets.splice(existingIndex, 1);
  } else {
    if (selection.meta.maxTargets && selection.targets.length >= selection.meta.maxTargets) {
      showToast(`最多可选择 ${selection.meta.maxTargets} 个目标`, 'warning');
      return;
    }
    selection.targets.push(cell);
  }

  if (selection.targets.length > 0 && (!selection.meta.maxTargets || selection.targets.length === selection.meta.maxTargets)) {
    sendMessage('skill', {
      skillId: selection.skill.id,
      data: { positions: selection.targets }
    });
    state.selection = null;
  }

  updateSubtitleFromState();
  drawBoard();
}

function handleBoardHover(event) {
  if (event?.touches && event.touches.length > 1) {
    return;
  }
  if (typeof event?.isPrimary === 'boolean' && event.isPrimary === false) {
    return;
  }
  const cell = locateCell(event);
  const changed = (state.hoverCell?.x !== cell?.x) || (state.hoverCell?.y !== cell?.y);
  if (changed) {
    state.hoverCell = cell;
    drawBoard();
  }
}

function clearHoverCell() {
  if (!state.hoverCell) {
    return;
  }
  state.hoverCell = null;
  drawBoard();
}


function getInputPoint(event) {
  if (!event) {
    return null;
  }
  if (event.touches && event.touches.length > 0) {
    return event.touches[0];
  }
  if (event.changedTouches && event.changedTouches.length > 0) {
    return event.changedTouches[0];
  }
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return event;
  }
  return null;
}

function locateCell(event) {
  const canvas = elements.boardCanvas;
  if (!canvas) {
    return null;
  }
  const point = getInputPoint(event);
  if (!point) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const size = rect.width;
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }
  const gap = (size - BOARD_PADDING * 2) / (BOARD_SIZE - 1);
  if (!Number.isFinite(gap) || gap <= 0) {
    return null;
  }
  const relativeX = (point.clientX - rect.left) - BOARD_PADDING;
  const relativeY = (point.clientY - rect.top) - BOARD_PADDING;
  const x = relativeX / gap;
  const y = relativeY / gap;
  const gridX = Math.round(x);
  const gridY = Math.round(y);
  if (gridX < 0 || gridX >= BOARD_SIZE || gridY < 0 || gridY >= BOARD_SIZE) {
    return null;
  }
  const dx = Math.abs(gridX - x);
  const dy = Math.abs(gridY - y);
  if (dx > 0.4 || dy > 0.4) {
    return null;
  }
  return { x: gridX, y: gridY };
}

function adjustCanvasSize() {
  const canvas = elements.boardCanvas;
  if (!canvas) {
    return;
  }

  const parent = canvas.parentElement;
  const fallbackWidth = canvas.clientWidth || 320;
  const parentWidth = parent ? parent.clientWidth : 0;
  const measuredWidth = canvas.getBoundingClientRect().width || fallbackWidth;
  const baseWidth = Math.max(220, parentWidth > 0 ? parentWidth : measuredWidth);
  let size = Math.min(baseWidth, 640);

  if (!Number.isFinite(size) || size <= 0) {
    size = Math.min(Math.max(baseWidth, 220), 320);
  }

  const isCompact = window.innerWidth <= 720;
  if (isCompact) {
    const viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight || size;
    const reservedForPanels = Math.min(Math.max(viewportHeight * 0.4, 240), 380);
    const availableHeight = viewportHeight - reservedForPanels - 72;
    const mobileLimit = Math.max(220, Math.min(availableHeight, viewportHeight * 0.62));
    size = Math.min(size, mobileLimit);
  }

  size = Math.max(220, size);

  const dpr = window.devicePixelRatio || 1;
  canvas.style.maxWidth = '100%';
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.width = Math.max(1, Math.floor(size * dpr));
  canvas.height = Math.max(1, Math.floor(size * dpr));
}




function drawBoard() {
  const canvas = elements.boardCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const size = canvas.width / dpr;
  const playableSize = size - BOARD_PADDING * 2;
  const gap = playableSize / (BOARD_SIZE - 1);

  ctx.clearRect(0, 0, size, size);

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#f4d8aa');
  gradient.addColorStop(1, '#d7b07c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(48, 28, 12, 0.8)';
  ctx.lineWidth = 1;

  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const offset = BOARD_PADDING + i * gap;
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING, offset);
    ctx.lineTo(size - BOARD_PADDING, offset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset, BOARD_PADDING);
    ctx.lineTo(offset, size - BOARD_PADDING);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(48, 28, 12, 0.9)';
  STAR_POINTS.forEach(([gx, gy]) => {
    const { x, y } = gridToPixel(gx, gy, gap);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (state.selection) {
    ctx.fillStyle = 'rgba(59, 169, 255, 0.16)';
    state.selection.validTargets.forEach(({ x, y }) => {
      const pos = gridToPixel(x, y, gap);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, gap * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (state.game?.board) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = state.game.board[y][x];
        if (cell) {
          drawStone(ctx, cell, gridToPixel(x, y, gap), gap);
        }
      }
    }
  }

  if (state.selection) {
    ctx.strokeStyle = 'rgba(59, 169, 255, 0.9)';
    ctx.lineWidth = 2;
    state.selection.targets.forEach(({ x, y }) => {
      const { x: px, y: py } = gridToPixel(x, y, gap);
      ctx.beginPath();
      ctx.arc(px, py, gap * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  if (state.game?.lastPlacement) {
    const { x, y } = state.game.lastPlacement;
    const { x: px, y: py } = gridToPixel(x, y, gap);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, gap * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.hoverCell && canOperateNow() && !state.selection) {
    const { x, y } = gridToPixel(state.hoverCell.x, state.hoverCell.y, gap);
    ctx.fillStyle = 'rgba(59, 169, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(x, y, gap * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gridToPixel(gridX, gridY, gap) {
  return {
    x: BOARD_PADDING + gridX * gap,
    y: BOARD_PADDING + gridY * gap
  };
}

function drawStone(ctx, color, position, gap) {
  const radius = gap * 0.42;
  const gradient = ctx.createRadialGradient(position.x - radius * 0.4, position.y - radius * 0.4, radius * 0.2, position.x, position.y, radius);

  if (color === 'black') {
    gradient.addColorStop(0, '#5a5a5a');
    gradient.addColorStop(1, '#141414');
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#d7d7d7');
  }

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function canOperateNow() {
  if (!state.game || state.role !== 'player') {
    return false;
  }
  if (state.game.winner) {
    return false;
  }
  if (state.game.currentTurn !== state.color) {
    return false;
  }
  if ((state.game.freeze?.[state.color] ?? 0) > 0) {
    return false;
  }
  return true;
}

function updateSubtitleFromState() {
  if (state.selection) {
    const { meta, targets } = state.selection;
    const done = targets.length;
    const total = meta.maxTargets || 1;
    updateSubtitle(`${meta.instruction}（${done}/${total}）`);
    return;
  }

  const { game } = state;
  if (!game) {
    updateSubtitle('等待服务器同步数据...');
    return;
  }

  if (game.winner) {
    const name = game.winner === 'black'
      ? (game.players?.black?.displayName || '子琪')
      : (game.players?.white?.displayName || '张呈');
    updateSubtitle(`对局结束，${name} 获胜`);
    return;
  }

  if (!game.players?.black || !game.players?.white) {
    updateSubtitle('等待另一位玩家加入...');
    return;
  }

  if (state.role !== 'player') {
    const actor = game.currentTurn === 'black'
      ? (game.players.black.displayName || '子琪')
      : (game.players.white.displayName || '张呈');
    updateSubtitle(`观战中，轮到 ${actor}`);
    return;
  }

  const freezeTurns = game.freeze?.[state.color] ?? 0;
  if (freezeTurns > 0) {
    updateSubtitle(`你被静如止水冻结，还需等待 ${freezeTurns} 回合`);
    return;
  }

  if (game.currentTurn === state.color) {
    updateSubtitle('轮到你落子或使用技能');
  } else {
    const opponent = state.color === 'black'
      ? (game.players?.white?.displayName || '张呈')
      : (game.players?.black?.displayName || '子琪');
    updateSubtitle(`等待 ${opponent} 行动`);
  }
}

function updateSubtitle(text) {
  elements.subtitle.textContent = text;
}

function countPlacedStones(board) {
  if (!board) {
    return 0;
  }
  let count = 0;
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x]) {
        count += 1;
      }
    }
  }
  return count;
}

init();


