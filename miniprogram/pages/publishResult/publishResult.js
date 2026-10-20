const DEFAULT_FAILURE_REASON = '投稿提交失败，请稍后再试。';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeReason(value) {
  const rawValue = trimString(value);

  if (!rawValue) {
    return '';
  }

  try {
    return trimString(decodeURIComponent(rawValue));
  } catch (error) {
    return '';
  }
}

function buildViewModel(options) {
  const resultType = trimString(options && options.resultType) === 'failure' ? 'failure' : 'success';
  const decodedReason = decodeReason(options && options.reason);

  if (resultType === 'failure') {
    return {
      resultType: 'failure',
      isSuccess: false,
      title: '发布失败',
      message: '',
      failureReason: decodedReason || DEFAULT_FAILURE_REASON,
    };
  }

  return {
    resultType: 'success',
    isSuccess: true,
    title: '感谢分享！',
    message: '内容会在审核通过后展示。',
    failureReason: '',
  };
}

Page({
  data: {
    resultType: 'success',
    isSuccess: true,
    title: '感谢分享！',
    message: '内容会在审核通过后展示。',
    failureReason: '',
  },

  onLoad(options) {
    this.setData(buildViewModel(options));
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});

if (typeof module !== 'undefined') {
  module.exports._private = {
    DEFAULT_FAILURE_REASON: DEFAULT_FAILURE_REASON,
    buildViewModel: buildViewModel,
    decodeReason: decodeReason,
  };
}
