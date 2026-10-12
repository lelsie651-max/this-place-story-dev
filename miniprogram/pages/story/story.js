const storyService = require('../../services/storyService');

Page({
  data: {
    currentStory: {
      title: 'AI观察报告：人类为什么喜欢拍照？',
      type: 'AI说',
      location: '深圳·南头古城',
      content:
        '作为一名驻扎在南头古城的AI观察员，\n我发现了一件有趣的事情。\n\n人类来到古老建筑前，\n第一反应通常不是研究历史，\n而是寻找一个最佳角度证明自己来过。\n\n这是一种非常特别的人类行为。',
      source: 'ai',
    },
    contentParagraphs: [
      '作为一名驻扎在南头古城的AI观察员，\n我发现了一件有趣的事情。',
      '人类来到古老建筑前，\n第一反应通常不是研究历史，\n而是寻找一个最佳角度证明自己来过。',
      '这是一种非常特别的人类行为。',
    ],
  },

  onLoad(options) {
    const storyType = (options && options.type) || 'ai_comment';

    this.loadStory(storyType);
  },

  loadStory(storyType) {
    const self = this;

    storyService.getStoryByType(storyType).then(function handleStory(currentStory) {
      self.setData({
        currentStory,
        contentParagraphs: currentStory.content.split('\n\n'),
      });
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
