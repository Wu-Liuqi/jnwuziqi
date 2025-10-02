const assert = require('assert');
const { GameSession } = require('../backend/gameSession');

function testHorizontalWin() {
  const session = new GameSession('t-win');
  const black = 'black-player';
  const white = 'white-player';
  session.attachClient(black, '测试黑棋');
  session.attachClient(white, '测试白棋');

  for (let i = 0; i < 4; i += 1) {
    session.placeStone(black, i, 7);
    session.placeStone(white, i, 8);
  }
  session.placeStone(black, 4, 7);

  assert.strictEqual(session.winner, 'black', '黑棋应当获胜');
}

function testRemoveOpponentSkill() {
  const session = new GameSession('t-skill');
  const black = 'p1';
  const white = 'p2';
  session.attachClient(black, '黑棋');
  session.attachClient(white, '白棋');

  session.placeStone(black, 7, 7);
  session.placeStone(white, 1, 1);
  session.placeStone(black, 6, 7);
  session.placeStone(white, 2, 1);

  const before = session.board[1][1];
  assert.strictEqual(before, 'white', '坐标应当存在白棋');

  session.applySkill(black, 'flying-sand', {
    positions: [{ x: 1, y: 1 }]
  });

  const after = session.board[1][1];
  assert.strictEqual(after, null, '目标棋子应被移除');
}

function testForceRestart() {
  const session = new GameSession('t-restart');
  const black = 'p1';
  const white = 'p2';
  session.attachClient(black, '黑棋');
  session.attachClient(white, '白棋');

  session.placeStone(black, 7, 7);
  session.placeStone(white, 6, 6);
  session.applySkill(black, 'flying-sand', { positions: [{ x: 6, y: 6 }] });

  session.forceRestart();

  assert.strictEqual(session.turnNumber, 0, '回合数应被重置');
  assert.strictEqual(session.winner, null, '不应存在胜者');
  assert.strictEqual(session.board.flat().filter(Boolean).length, 0, '棋盘应清空');
}

function run() {
  testHorizontalWin();
  testRemoveOpponentSkill();
  testForceRestart();
  console.log('✔ 所有核心逻辑测试通过');
}

run();
