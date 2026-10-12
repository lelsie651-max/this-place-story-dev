const STORY_MAP = {
  ai_comment: {
    title: 'AI观察报告：人类为什么喜欢拍照？',
    type: 'AI说',
    location: '深圳·南头古城',
    content:
      '作为一名驻扎在南头古城的AI观察员，\n我发现了一件有趣的事情。\n\n人类来到古老建筑前，\n第一反应通常不是研究历史，\n而是寻找一个最佳角度证明自己来过。\n\n这是一种非常特别的人类行为。',
    source: 'ai',
  },
  folk: {
    title: '城门边的灯，总替晚归的人亮着',
    type: '民间传说',
    location: '西安·城墙',
    content:
      '老一辈常说，夜色落在城墙上以后，\n总会有一盏灯替晚归的人多亮一会儿。\n\n它照的不是路，\n而是提醒每一个走远的人，\n总还有一个地方在等你回来。',
    source: 'folk',
  },
};

Page({
  data: {
    currentStory: STORY_MAP.ai_comment,
    contentParagraphs: STORY_MAP.ai_comment.content.split('\n\n'),
  },

  onLoad(options) {
    const storyType = (options && options.type) || 'ai_comment';
    const currentStory = STORY_MAP[storyType] || STORY_MAP.ai_comment;

    this.setData({
      currentStory,
      contentParagraphs: currentStory.content.split('\n\n'),
    });
  },

  handleCollect() {
    wx.showToast({
      title: '已加入收藏占位',
      icon: 'none',
    });
  },

  backToHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});
