const assert = require('assert');

const deleteMyStory = require('./index.js');

function createActor() {
  const store = {
    stories: {
      'story-rejected': {
        _id: 'story-rejected',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        status: 'rejected',
        title: '旧城夜话',
        content: '完整正文',
        createdAt: 'created-at-1',
        locationId: 'loc-1',
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
      },
      'story-pending': {
        _id: 'story-pending',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        status: 'pending',
      },
      'story-deleted': {
        _id: 'story-deleted',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        status: 'deleted',
      },
      'story-other-user': {
        _id: 'story-other-user',
        authorId: 'user-b',
        source: 'user',
        type: 'traveler',
        status: 'rejected',
      },
    },
  };
  let serverDateCount = 0;

  return {
    store: store,
    serverDate() {
      serverDateCount += 1;
      return 'server-date-' + serverDateCount;
    },
    collection() {
      return {
        doc(docId) {
          return {
            async get() {
              if (!store.stories[docId]) {
                throw new Error('document.get:fail');
              }

              return {
                data: Object.assign({}, store.stories[docId]),
              };
            },
            async update(options) {
              if (!store.stories[docId]) {
                throw new Error('document.get:fail');
              }

              store.stories[docId] = Object.assign({}, store.stories[docId], options.data || {});
              return {};
            },
          };
        },
      };
    },
  };
}

async function testValidateStoryId() {
  assert.strictEqual(deleteMyStory._private.validateStoryId({
    storyId: ' story-rejected ',
  }), 'story-rejected');

  assert.throws(function onMissing() {
    deleteMyStory._private.validateStoryId({});
  }, /storyId 不能为空/);
}

async function testSoftDeleteRejectedStory() {
  const actor = createActor();
  const story = await deleteMyStory._private.getStoryByIdWithActor(actor, 'story-rejected');

  deleteMyStory._private.assertDeletableStory(story, 'user-a');
  await deleteMyStory._private.softDeleteStoryWithActor(actor, 'story-rejected');

  assert.strictEqual(actor.store.stories['story-rejected'].status, 'deleted');
  assert.strictEqual(actor.store.stories['story-rejected'].updatedAt, 'server-date-1');
  assert.strictEqual(actor.store.stories['story-rejected'].deletedAt, 'server-date-2');
  assert.strictEqual(actor.store.stories['story-rejected'].createdAt, 'created-at-1');
  assert.strictEqual(actor.store.stories['story-rejected'].title, '旧城夜话');
}

async function testRejectNonAuthorAndNonRejectedStatus() {
  const actor = createActor();

  assert.throws(function rejectOtherUser() {
    deleteMyStory._private.assertDeletableStory(actor.store.stories['story-other-user'], 'user-a');
  }, /当前投稿暂不支持删除/);

  assert.throws(function rejectPending() {
    deleteMyStory._private.assertDeletableStory(actor.store.stories['story-pending'], 'user-a');
  }, /当前状态暂不支持删除/);

  assert.throws(function rejectDeleted() {
    deleteMyStory._private.assertDeletableStory(actor.store.stories['story-deleted'], 'user-a');
  }, /当前状态暂不支持删除/);
}

async function run() {
  const tests = [
    ['Validate storyId input', testValidateStoryId],
    ['Soft delete rejected story', testSoftDeleteRejectedStory],
    ['Reject non-author and non-rejected status', testRejectNonAuthorAndNonRejectedStatus],
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
