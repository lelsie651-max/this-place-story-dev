const assert = require('assert');

const submitStory = require('./index.js');

function createActor() {
  const store = {
    stories: {
      'story-pending': {
        _id: 'story-pending',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        language: 'zh-CN',
        status: 'pending',
        title: '原标题',
        summary: '原摘要',
        content: '原正文',
        locationId: 'loc-1',
        isTemporary: false,
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
        createdAt: 'created-at-1',
        updatedAt: 'updated-at-1',
        rejectionReason: '旧原因',
        reviewedAt: 'reviewed-at-1',
        reviewerId: 'admin-1',
        moderationNote: '旧备注',
      },
      'story-rejected': {
        _id: 'story-rejected',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        language: 'zh-CN',
        status: 'rejected',
        title: '原标题',
        summary: '原摘要',
        content: '原正文',
        locationId: 'loc-1',
        isTemporary: false,
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
        createdAt: 'created-at-2',
        rejectionReason: '旧原因',
      },
      'story-published': {
        _id: 'story-published',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        language: 'zh-CN',
        status: 'published',
        title: '原标题',
        summary: '原摘要',
        content: '原正文',
        locationId: 'loc-1',
        isTemporary: false,
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
        createdAt: 'created-at-3',
      },
      'story-deleted': {
        _id: 'story-deleted',
        authorId: 'user-a',
        source: 'user',
        type: 'traveler',
        language: 'zh-CN',
        status: 'deleted',
        title: '原标题',
        summary: '原摘要',
        content: '原正文',
        locationId: 'loc-1',
        isTemporary: false,
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
        createdAt: 'created-at-4',
      },
    },
    locations: {
      'loc-1': {
        _id: 'loc-1',
        name: '南头古城',
      },
    },
  };
  let addedCount = 0;
  let serverDateCount = 0;
  const removeToken = {
    __remove: true,
  };

  return {
    store: store,
    command: {
      remove() {
        return removeToken;
      },
    },
    serverDate() {
      serverDateCount += 1;
      return 'server-date-' + serverDateCount;
    },
    collection(name) {
      if (name === 'locations') {
        return {
          doc(docId) {
            return {
              async get() {
                if (!store.locations[docId]) {
                  throw new Error('document.get:fail');
                }

                return {
                  data: Object.assign({}, store.locations[docId]),
                };
              },
            };
          },
        };
      }

      return {
        async add(options) {
          addedCount += 1;
          const storyId = 'story-new-' + addedCount;
          store.stories[storyId] = Object.assign({}, options.data, {
            _id: storyId,
          });
          return {
            _id: storyId,
          };
        },
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
              const existing = store.stories[docId];

              if (!existing) {
                throw new Error('document.get:fail');
              }

              const nextDoc = Object.assign({}, existing);
              Object.keys(options.data || {}).forEach(function applyField(key) {
                if (options.data[key] === removeToken) {
                  delete nextDoc[key];
                  return;
                }

                nextDoc[key] = options.data[key];
              });
              store.stories[docId] = nextDoc;
              return {};
            },
          };
        },
      };
    },
  };
}

async function testCreateStillAddsNewStory() {
  const actor = createActor();
  const storyId = await submitStory._private.createTravelerStoryWithActor(actor, {
    locationId: 'loc-1',
    isTemporary: false,
    placeSnapshot: {
      name: '南头古城',
      address: '深圳市南山区南头古城',
      latitude: null,
      longitude: null,
      poiid: '',
    },
    title: '新标题',
    content: '新正文',
  }, 'user-a');

  assert.ok(storyId.indexOf('story-new-') === 0);
  assert.strictEqual(actor.store.stories[storyId].status, 'pending');
  assert.strictEqual(actor.store.stories[storyId].authorId, 'user-a');
  assert.strictEqual(actor.store.stories[storyId].createdAt, 'server-date-1');
}

async function testEditUpdatesOriginalDocAndKeepsIdentity() {
  const actor = createActor();
  const existing = await submitStory._private.getTravelerStoryByIdWithActor(actor, 'story-rejected');

  submitStory._private.assertEditableTravelerStory(existing, 'user-a');
  await submitStory._private.updateTravelerStoryWithActor(actor, actor.command, 'story-rejected', {
    storyId: 'story-rejected',
    title: '修改后的标题',
    content: '修改后的正文',
  });

  const updated = actor.store.stories['story-rejected'];
  assert.strictEqual(updated._id, 'story-rejected');
  assert.strictEqual(updated.createdAt, 'created-at-2');
  assert.strictEqual(updated.updatedAt, 'server-date-1');
  assert.strictEqual(updated.status, 'pending');
  assert.strictEqual(updated.title, '修改后的标题');
  assert.strictEqual(updated.content, '修改后的正文');
  assert.strictEqual(updated.summary, '修改后的正文');
  assert.strictEqual(updated.locationId, 'loc-1');
  assert.strictEqual(updated.authorId, 'user-a');
  assert.strictEqual(typeof updated.rejectionReason, 'undefined');
  assert.strictEqual(typeof updated.reviewedAt, 'undefined');
  assert.strictEqual(typeof updated.reviewerId, 'undefined');
  assert.strictEqual(typeof updated.moderationNote, 'undefined');
}

async function testRejectNonAuthorAndNonEditableStatus() {
  const actor = createActor();

  assert.throws(function rejectNonAuthor() {
    const story = actor.store.stories['story-pending'];
    submitStory._private.assertEditableTravelerStory(story, 'user-b');
  }, /当前投稿暂不支持编辑/);

  assert.throws(function rejectPublished() {
    const story = actor.store.stories['story-published'];
    submitStory._private.assertEditableTravelerStory(story, 'user-a');
  }, /当前状态暂不支持编辑/);

  assert.throws(function rejectDeleted() {
    const story = actor.store.stories['story-deleted'];
    submitStory._private.assertEditableTravelerStory(story, 'user-a');
  }, /当前状态暂不支持编辑/);
}

async function testValidationRulesStaySafe() {
  const createInput = submitStory._private.validateCreateEvent({
    locationId: 'loc-1',
    isTemporary: false,
    placeSnapshot: {
      name: '南头古城',
      address: '深圳市南山区南头古城',
      latitude: null,
      longitude: null,
      poiid: '',
    },
    title: '新标题',
    content: '新正文',
    authorId: 'fake-user',
  });
  const editInput = submitStory._private.validateEditEvent({
    storyId: ' story-pending ',
    title: '新标题',
    content: '新正文',
    authorId: 'fake-user',
  });

  assert.strictEqual(createInput.locationId, 'loc-1');
  assert.strictEqual(editInput.storyId, 'story-pending');
  assert.deepStrictEqual(
    Object.keys(submitStory._private.buildReviewFieldClearData({
      remove() {
        return 'REMOVE';
      },
    })).sort(),
    submitStory._private.REVIEW_FIELD_NAMES.slice().sort()
  );
}

async function run() {
  const tests = [
    ['Create still adds new story', testCreateStillAddsNewStory],
    ['Edit updates original document safely', testEditUpdatesOriginalDocAndKeepsIdentity],
    ['Reject non-author and non-editable states', testRejectNonAuthorAndNonEditableStatus],
    ['Validation rules stay safe', testValidationRulesStaySafe],
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
