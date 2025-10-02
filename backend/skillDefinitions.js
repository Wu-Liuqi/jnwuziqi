const SKILLS = [
  {
    id: 'flying-sand',
    name: '飞沙走石',
    description: '移除敌方1颗棋子',
    cooldown: 2,
    type: 'remove-opponent',
    payload: { count: 1 }
  },
  {
    id: 'calm-water',
    name: '静如止水',
    description: '冻结敌方1回合，敌方无法下子',
    cooldown: 4,
    type: 'freeze-opponent',
    payload: { turns: 1 }
  },
  {
    id: 'yale-ya',
    name: '呀嘞呀',
    description: '移除敌方2颗棋子',
    cooldown: 5,
    type: 'remove-opponent',
    payload: { count: 2 }
  },
  {
    id: 'capture',
    name: '擒拿擒拿',
    description: '随机生成己方棋子',
    cooldown: 6,
    type: 'random-self',
    payload: { count: 1 }
  },
  {
    id: 'rewind',
    name: '时光倒流',
    description: '悔棋一步，撤销上一步操作',
    cooldown: 7,
    type: 'undo',
    payload: { steps: 1 }
  },
  {
    id: 'reset-board',
    name: '力拔山兮',
    description: '清空整个棋盘，重置游戏',
    cooldown: 15,
    type: 'reset-board'
  },
  {
    id: 'restore',
    name: '东山再起',
    description: '恢复棋盘至某个历史状态',
    cooldown: 10,
    type: 'restore-history'
  },
  {
    id: 'see-you-again',
    name: 'See you again',
    description: '移除敌方所有棋子',
    cooldown: 20,
    type: 'remove-all-opponent'
  }
];

module.exports = {
  SKILLS,
  SKILL_MAP: new Map(SKILLS.map((skill) => [skill.id, skill]))
};
