Page({
  data: {
    storyModes: [
      {
        key: 'folk',
        title: '民间传说',
        description: '听听流传在当地的人间故事。',
        enabled: true,
      },
      {
        key: 'ai_comment',
        title: 'AI说',
        description: '让AI成为这里的观察者，用另一种视角讲述地点。',
        enabled: true,
        featured: true,
      },
      {
        key: 'traveler',
        title: '网友说',
        description: '看看其他旅人的真实分享。',
        enabled: false,
        statusText: '即将开放',
      },
    ],
  },

  goToDiscovery(event) {
    const { type, enabled } = event.currentTarget.dataset;

    if (enabled === false || enabled === 'false') {
      wx.showToast({
        title: '即将开放',
        icon: 'none',
      });
      return;
    }

    wx.switchTab({
      url: '/pages/discovery/discovery',
    });
  },
});
