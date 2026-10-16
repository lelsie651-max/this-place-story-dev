function getTopBarStyle() {
  try {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menuButtonRect = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const statusBarHeight = windowInfo && windowInfo.statusBarHeight ? windowInfo.statusBarHeight : 0;
    const paddingTop = menuButtonRect && menuButtonRect.top
      ? menuButtonRect.top
      : statusBarHeight + 8;
    const minHeight = menuButtonRect && menuButtonRect.height
      ? menuButtonRect.height
      : 32;

    return 'padding-top:' + paddingTop + 'px; min-height:' + minHeight + 'px;';
  } catch (error) {
    return '';
  }
}

Page({
  data: {
    topBarStyle: '',
  },

  onLoad() {
    this.setData({
      topBarStyle: getTopBarStyle(),
    });
  },

  goToExplore() {
    wx.navigateTo({
      url: '/pages/discovery/discovery',
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    });
  },

  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish/publish',
    });
  },
});
