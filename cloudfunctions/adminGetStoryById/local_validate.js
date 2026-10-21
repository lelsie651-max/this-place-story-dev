const assert = require('assert');

process.env.ADMIN_LOGIN_SECRET = 'legend-secret';

const adminGetStoryById = require('./index.js');

function createActor() {
  const store = {
    locations: {
      'loc-1': {
        _id: 'loc-1',
        name: '南头古城',
      },
    },
    stories: {
      'story-pending': {
        _id: 'story-pending',
        title: '待审稿件',
        summary: '摘要',
        content: '正文内容',
        source: 'user',
        type: 'traveler',
        status: 'pending',
        authorId: 'openid-a',
        locationId: 'loc-1',
        placeSnapshot: {
          name: '南头古城',
          address: '深圳市南山区南头古城',
        },
        moderationStatus: 'manual_only',
        manualReviewRequired: true,
        createdAt: '2026-10-21T10:00:00.000Z',
      },
      'story-ai': {
        _id: 'story-ai',
        title: 'AI 故事',
        summary: '摘要',
        content: '正文内容',
        source: 'deepseek',
        type: 'traveler',
        status: 'published',
        authorId: 'openid-b',
      },
      'story-deleted': {
        _id: 'story-deleted',
        title: '已删除',
        summary: '摘要',
        content: '正文内容',
        source: 'user',
        type: 'traveler',
        status: 'deleted',
        authorId: 'openid-c',
      },
    },
  };

  return {
    collection(name) {
      if (name === 'locations') {
        return {
          doc(docId) {
            return {
              async get() {
                return {
                  data: store.locations[docId],
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
              if (!store.stories[docId]) {
                throw new Error('document.get:fail');
              }

              return {
                data: store.stories[docId],
              };
            },
          };
        },
      };
    },
  };
}

async function testStoryDetailReturnsCompleteData() {
  const actor = createActor();
  const story = await adminGetStoryById._private.getStoryById(actor, 'story-pending');
  const detail = await adminGetStoryById._private.normalizeStoryDetail(actor, story);

  assert.strictEqual(detail.storyId, 'story-pending');
  assert.strictEqual(detail.locationName, '南头古城');
  assert.strictEqual(detail.authorDisplayId.indexOf('openid-a') === -1, true);
  assert.strictEqual(detail.moderationStatus, 'manual_only');
  assert.strictEqual(detail.manualReviewRequired, true);
}

async function testNonUserTravelerStoryRejected() {
  const actor = createActor();

  await assert.rejects(async function rejectAiStory() {
    await adminGetStoryById._private.getStoryById(actor, 'story-ai');
  }, function assertError(error) {
    return error && error.code === 'FORBIDDEN';
  });
}

async function testDeletedStoryRejected() {
  const actor = createActor();

  await assert.rejects(async function rejectDeletedStory() {
    await adminGetStoryById._private.getStoryById(actor, 'story-deleted');
  }, function assertError(error) {
    return error && error.code === 'STORY_NOT_FOUND';
  });
}

async function run() {
  const tests = [
    ['Story detail returns complete data', testStoryDetailReturnsCompleteData],
    ['Non user traveler story rejected', testNonUserTravelerStoryRejected],
    ['Deleted story rejected', testDeletedStoryRejected],
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
