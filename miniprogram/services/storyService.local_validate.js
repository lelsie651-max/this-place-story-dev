const assert = require('assert');
const path = require('path');

const servicePath = path.join(__dirname, 'storyService.js');

function loadStoryService(wxMock) {
  delete require.cache[servicePath];
  global.wx = wxMock;
  return require(servicePath);
}

function cleanup() {
  delete global.wx;
  delete require.cache[servicePath];
}

async function testStatusAndTimeFormatting() {
  const storyService = loadStoryService({
    cloud: {
      init() {},
      callFunction() {},
      database() {
        return {};
      },
    },
  });

  assert.strictEqual(storyService._private.normalizeMyStoryStatus('pending'), '审核中');
  assert.strictEqual(storyService._private.normalizeMyStoryStatus('published'), '已通过');
  assert.strictEqual(storyService._private.normalizeMyStoryStatus('rejected'), '未通过');
  assert.strictEqual(storyService._private.normalizeMyStoryStatus('hidden'), '已隐藏');
  assert.strictEqual(storyService._private.normalizeMyStoryStatus('deleted'), '已删除');
  assert.strictEqual(storyService._private.normalizeMyStoryStatus('unknown'), '审核中');
  assert.strictEqual(storyService._private.canDeleteMyStory('rejected'), true);
  assert.strictEqual(storyService._private.canDeleteMyStory('pending'), false);

  assert.strictEqual(
    storyService.formatStorySubmissionTime(new Date(2026, 9, 21, 4, 30, 0)),
    '2026年10月21日 04:30'
  );
  assert.strictEqual(
    storyService.formatStorySubmissionTime({ $date: '2026-10-21 12:30:00' }),
    '2026年10月21日 12:30'
  );
  const localSeconds = Math.floor(new Date(2026, 9, 21, 12, 30, 0).getTime() / 1000);
  assert.strictEqual(
    storyService.formatStorySubmissionTime({ seconds: localSeconds, nanoseconds: 0 }),
    '2026年10月21日 12:30'
  );
  assert.strictEqual(
    storyService.formatStorySubmissionTime('2026-10-21 09:15:00'),
    '2026年10月21日 09:15'
  );
  assert.strictEqual(
    storyService.formatStorySubmissionTime({
      createdAt: new Date(2026, 9, 21, 10, 0, 0),
      updatedAt: new Date(2026, 9, 21, 11, 0, 0),
    }),
    '2026年10月21日 11:00'
  );
}

async function testGetMyStoryByIdAndUpdateTravelerStory() {
  const calls = [];
  const storyService = loadStoryService({
    cloud: {
      init() {},
      callFunction(options) {
        calls.push({
          name: options.name,
          data: options.data,
        });

        if (options.name === 'getMyStoryById') {
          options.success({
            result: {
              ok: true,
              story: {
                id: 'story-1',
                title: '标题',
                content: '正文',
                summary: '摘要',
                status: 'rejected',
                rejectionReason: '地点信息不足',
                locationId: 'loc-1',
                isTemporary: false,
                placeSnapshot: {
                  name: '南头古城',
                  address: '深圳市南山区南头古城',
                },
                locationName: '南头古城',
                createdAt: '2026-10-21T10:00:00.000Z',
                updatedAt: '2026-10-21T11:00:00.000Z',
              },
            },
          });
          return;
        }

        if (options.name === 'submitStory') {
          options.success({
            result: {
              ok: true,
              storyId: 'story-1',
              status: 'pending',
              updated: true,
              message: '修改已提交，审核通过后会展示。',
            },
          });
          return;
        }

        if (options.name === 'deleteMyStory') {
          options.success({
            result: {
              ok: true,
              storyId: 'story-1',
              deleted: true,
            },
          });
          return;
        }

        throw new Error('Unexpected function call');
      },
      database() {
        return {};
      },
    },
  });

  const story = await storyService.getMyStoryById('story-1');
  assert.strictEqual(story.id, 'story-1');
  assert.strictEqual(story.statusLabel, '未通过');
  assert.strictEqual(story.rejectionReason, '地点信息不足');
  assert.strictEqual(story.placeSnapshot.address, '深圳市南山区南头古城');

  const updateResult = await storyService.updateTravelerStory({
    storyId: 'story-1',
    title: '新标题',
    content: '新正文',
  });
  const deleteResult = await storyService.deleteMyStory('story-1');
  assert.strictEqual(updateResult.updated, true);
  assert.strictEqual(updateResult.status, 'pending');
  assert.strictEqual(deleteResult.deleted, true);
  assert.deepStrictEqual(calls[0], {
    name: 'getMyStoryById',
    data: {
      storyId: 'story-1',
    },
  });
  assert.deepStrictEqual(calls[1], {
    name: 'submitStory',
    data: {
      storyId: 'story-1',
      title: '新标题',
      content: '新正文',
    },
  });
  assert.deepStrictEqual(calls[2], {
    name: 'deleteMyStory',
    data: {
      storyId: 'story-1',
    },
  });
}

async function testPublishedQueryAndDetailGuard() {
  let lastWhere = null;
  const storyService = loadStoryService({
    cloud: {
      init() {},
      callFunction() {},
      database() {
        return {
          collection() {
            return {
              where(query) {
                lastWhere = query;
                return {
                  orderBy() {
                    return {
                      async get() {
                        return {
                          data: [{
                            _id: 'pub-1',
                            locationId: 'loc-1',
                            type: 'traveler',
                            source: 'user',
                            status: 'published',
                            title: '公开故事',
                            content: '公开正文',
                          }],
                        };
                      },
                    };
                  },
                };
              },
              doc(storyId) {
                return {
                  async get() {
                    if (storyId === 'published') {
                      return {
                        data: {
                          _id: 'published',
                          status: 'published',
                          title: '公开故事',
                          content: '公开正文',
                        },
                      };
                    }

                    if (storyId === 'pending') {
                      return {
                        data: {
                          _id: 'pending',
                          status: 'pending',
                          title: '待审故事',
                          content: '待审正文',
                        },
                      };
                    }

                    throw new Error('document.get:fail');
                  },
                };
              },
            };
          },
        };
      },
    },
  });

  const list = await storyService.listPublishedUserStoriesByLocation('loc-1');
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(lastWhere, {
    locationId: 'loc-1',
    type: 'traveler',
    source: 'user',
    status: 'published',
  });

  const publishedStory = await storyService.getStoryById('published');
  assert.strictEqual(publishedStory.id, 'published');

  await assert.rejects(
    function rejectPending() {
      return storyService.getStoryById('pending');
    },
    function checkError(error) {
      return error && error.code === 'CONTENT_NOT_AVAILABLE' && error.message === '该内容暂不可查看。';
    }
  );
}

async function run() {
  const tests = [
    ['Status and time formatting', testStatusAndTimeFormatting],
    ['My story detail and update cloud calls', testGetMyStoryByIdAndUpdateTravelerStory],
    ['Published query and detail guard', testPublishedQueryAndDetailGuard],
  ];

  for (const [label, testFn] of tests) {
    cleanup();
    await testFn();
    console.log('[PASS]', label);
  }

  cleanup();
}

run().catch(function onError(error) {
  cleanup();
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
