const assert = require('assert');

const getMyStoryById = require('./index.js');

function createActor() {
  const store = {
    stories: [
      {
        _id: 'story-1',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        title: '旧城夜话',
        content: '完整正文',
        summary: '摘要',
        status: 'rejected',
        rejectionReason: '地点信息不足',
        locationId: 'loc-1',
        isTemporary: false,
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
        createdAt: 'created-at',
        updatedAt: 'updated-at',
      },
      {
        _id: 'story-2',
        authorId: 'user-b',
        source: 'user',
        type: 'traveler',
        title: '他人投稿',
        content: '他人正文',
        status: 'pending',
      },
      {
        _id: 'story-3',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        title: '已删除投稿',
        content: '删除正文',
        status: 'deleted',
      },
    ],
    locations: {
      'loc-1': {
        _id: 'loc-1',
        name: '南头古城',
      },
    },
  };

  return {
    collection(name) {
      if (name === 'stories') {
        return {
          where(query) {
            return {
              limit() {
                return {
                  async get() {
                    const data = store.stories.filter(function match(doc) {
                      return Object.keys(query).every(function compare(key) {
                        return doc[key] === query[key];
                      });
                    });
                    return {
                      data: data,
                    };
                  },
                };
              },
            };
          },
        };
      }

      return {
        doc(docId) {
          return {
            async get() {
              return {
                data: store.locations[docId] || null,
              };
            },
          };
        },
      };
    },
  };
}

async function testValidateStoryId() {
  assert.strictEqual(getMyStoryById._private.validateStoryId({
    storyId: ' story-1 ',
  }), 'story-1');

  assert.throws(function onMissing() {
    getMyStoryById._private.validateStoryId({});
  }, /storyId 不能为空/);
}

async function testReadOwnStoryOnly() {
  const actor = createActor();
  const story = await getMyStoryById._private.getStoryByAuthorWithActor(actor, 'story-1', 'user-a');
  const normalized = await getMyStoryById._private.normalizeStoryWithActor(actor, story);

  assert.strictEqual(normalized.id, 'story-1');
  assert.strictEqual(normalized.statusLabel, '未通过');
  assert.strictEqual(normalized.rejectionReason, '地点信息不足');
  assert.strictEqual(normalized.locationName, '南头古城');
}

async function testRejectOtherUsersStory() {
  const actor = createActor();

  await assert.rejects(
    function rejectRead() {
      return getMyStoryById._private.getStoryByAuthorWithActor(actor, 'story-2', 'user-a');
    },
    /当前投稿不存在或暂不可查看/
  );
}

async function testRejectDeletedStory() {
  const actor = createActor();

  await assert.rejects(
    function rejectDeletedRead() {
      return getMyStoryById._private.getStoryByAuthorWithActor(actor, 'story-3', 'user-a');
    },
    /当前投稿不存在或暂不可查看/
  );
}

async function run() {
  const tests = [
    ['Validate storyId input', testValidateStoryId],
    ['Read own story only', testReadOwnStoryOnly],
    ['Reject other users story', testRejectOtherUsersStory],
    ['Reject deleted story', testRejectDeletedStory],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
