const USER_MODEL = {
  collection: 'users',
  fields: {
    openid: '微信用户唯一标识',
    nickname: '昵称',
    avatarUrl: '头像地址',
    language: '语言偏好',
    magnifyingGlass: '放大镜道具数量',
    createdAt: '创建时间',
  },
};

module.exports = {
  USER_MODEL,
};
