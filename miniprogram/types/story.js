const STORY_MODEL = {
  collection: 'stories',
  fields: {
    locationId: '地点ID',
    type: '故事类型，例如 ai_comment / folk',
    title: '故事标题',
    content: '故事正文',
    source: '内容来源，例如 ai / folk / traveler',
    language: '内容语言',
    authorId: '作者或生成者ID',
    status: '状态，例如 draft / published / archived',
    createdAt: '创建时间',
  },
};

module.exports = {
  STORY_MODEL,
};
