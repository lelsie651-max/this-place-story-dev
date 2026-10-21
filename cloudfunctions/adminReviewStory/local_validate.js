const assert = require('assert');

process.env.ADMIN_LOGIN_SECRET = 'legend-secret';

const adminReviewStory = require('./index.js');

function createActor() {
  const removeToken = {
    __remove: true,
  };
  const store = {
    stories: {
      'story-pending': {
        _id: 'story-pending',
        source: 'user',
        type: 'traveler',
        status: 'pending',
        title: '待审稿件',
      },
      'story-published': {
        _id: 'story-published',
        source: 'user',
        type: 'traveler',
        status: 'published',
        title: '已发布稿件',
      },
      'story-rejected': {
        _id: 'story-rejected',
        source: 'user',
        type: 'traveler',
        status: 'rejected',
        title: '已打回稿件',
      },
      'story-ai': {
        _id: 'story-ai',
        source: 'deepseek',
        type: 'traveler',
        status: 'pending',
        title: 'AI 故事',
      },
    },
  };
  let serverDateCount = 0;

  return {
    command: {
      remove() {
        return removeToken;
      },
    },
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
          };
        },
        where(query) {
          return {
            async update(options) {
              const story = store.stories[query._id];

              if (
                !story
                || story.source !== query.source
                || story.type !== query.type
                || story.status !== query.status
              ) {
                return {
                  stats: {
                    updated: 0,
                  },
                };
              }

              const nextStory = Object.assign({}, story);
              Object.keys(options.data || {}).forEach(function applyField(fieldName) {
                if (options.data[fieldName] === removeToken) {
                  delete nextStory[fieldName];
                  return;
                }

                nextStory[fieldName] = options.data[fieldName];
              });
              store.stories[query._id] = nextStory;

              return {
                stats: {
                  updated: 1,
                },
              };
            },
          };
        },
      };
    },
    store: store,
  };
}

async function testPendingApproveSucceeds() {
  const actor = createActor();
  const transition = adminReviewStory._private.resolveAction('approve', 'pending', '');

  await adminReviewStory._private.updateStoryWithExpectedStatus(actor, actor.command, {
    storyId: 'story-pending',
    transition: transition,
    authInfo: {
      reviewerId: 'admin_from_token',
    },
  });

  assert.strictEqual(actor.store.stories['story-pending'].status, 'published');
  assert.strictEqual(actor.store.stories['story-pending'].reviewerId, 'admin_from_token');
}

function testRejectAndHideRequireReason() {
  assert.throws(function rejectWithoutReason() {
    adminReviewStory._private.resolveAction('reject', 'pending', '');
  }, /必须填写原因/);

  assert.throws(function hideWithoutReason() {
    adminReviewStory._private.resolveAction('hide', 'published', '');
  }, /必须填写原因/);
}

async function testExpectedStatusMismatchRejected() {
  const actor = createActor();
  const transition = adminReviewStory._private.resolveAction('approve', 'pending', '');

  actor.store.stories['story-pending'].status = 'rejected';

  await assert.rejects(async function rejectMismatchedStatus() {
    await adminReviewStory._private.updateStoryWithExpectedStatus(actor, actor.command, {
      storyId: 'story-pending',
      transition: transition,
      authInfo: {
        reviewerId: 'admin_from_token',
      },
    });
  }, function assertError(error) {
    return error && error.code === 'STATUS_CHANGED';
  });
}

async function testNonUserStoryRejected() {
  const actor = createActor();

  await assert.rejects(async function rejectAiStory() {
    await adminReviewStory._private.getStoryById(actor, 'story-ai');
  }, function assertError(error) {
    return error && error.code === 'FORBIDDEN';
  });
}

function testRepeatedReviewNotAllowed() {
  assert.throws(function rejectRepeatedReview() {
    adminReviewStory._private.assertStoryCanTransition({
      status: 'rejected',
    }, {
      expectedStatus: 'pending',
      newStatus: 'rejected',
    });
  }, function assertError(error) {
    return error && error.code === 'STATUS_CHANGED';
  });
}

async function run() {
  const tests = [
    ['Pending approve succeeds', testPendingApproveSucceeds],
    ['Reject and hide require reason', testRejectAndHideRequireReason],
    ['Expected status mismatch rejected', testExpectedStatusMismatchRejected],
    ['Non user story rejected', testNonUserStoryRejected],
    ['Repeated review not allowed', testRepeatedReviewNotAllowed],
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
