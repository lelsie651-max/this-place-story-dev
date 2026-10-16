Page({
  data: {
    locationName: '深圳·南头古城',
    storyTitle: '',
    storyContent: '',
  },

  onTitleInput(event) {
    this.setData({
      storyTitle: event.detail.value,
    });
  },

  onContentInput(event) {
    this.setData({
      storyContent: event.detail.value,
    });
  },

  chooseLocation() {
    wx.showToast({
      title: '地点选择准备中',
      icon: 'none',
    });
  },

  submitStory() {
    wx.showToast({
      title: '感谢分享，内容审核后会展示。',
      icon: 'none',
    });
  },
});
