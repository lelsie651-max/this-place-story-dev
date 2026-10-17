const assert = require('assert');

const generateStoryModule = require('./index.js');

const {
  buildStoryMeta,
  buildSystemPrompt,
  buildUserPrompt,
  cloneStoryMeta,
  generateNormalizedStoryWithRetry,
  GenerateStoryError,
  LAST_GENERATION_MEMORY,
} = generateStoryModule._private;

function resetGenerationMemory() {
  LAST_GENERATION_MEMORY.folk.variantKey = '';
  LAST_GENERATION_MEMORY.ai_comment.identityKey = '';
  LAST_GENERATION_MEMORY.ai_comment.personalityKey = '';
  LAST_GENERATION_MEMORY.ai_comment.toneKey = '';
  LAST_GENERATION_MEMORY.ai_comment.structureKey = '';
  LAST_GENERATION_MEMORY.ai_comment.emotionLabel = '';
  LAST_GENERATION_MEMORY.ai_comment.focusLabel = '';
  LAST_GENERATION_MEMORY.ai_comment.endingLabel = '';
}

function createInput(type) {
  return {
    isTemporary: false,
    locationId: 'loc-demo-001',
    selectedPlace: null,
    locationName: '南头古城',
    locationDescription: '一座保留古城肌理、游客与居民交错生活的老城。',
    city: '深圳',
    type: type,
  };
}

async function testAiMetaAndPrompt() {
  resetGenerationMemory();

  const input = createInput('AI说');
  const storyMeta = buildStoryMeta(input);
  const systemPrompt = buildSystemPrompt(input, storyMeta);
  const userPrompt = buildUserPrompt(input, storyMeta, {
    strictJsonOnly: false,
  });

  assert.strictEqual(storyMeta.storyType, 'AI说');
  assert.ok(storyMeta.narratorIdentity);
  assert.ok(storyMeta.personality);
  assert.ok(storyMeta.tone);
  assert.ok(storyMeta.structure);
  assert.ok(systemPrompt.includes('非人类 AI 观察者'));
  assert.ok(userPrompt.includes('本次 AI 身份：' + storyMeta.narratorIdentity));
  assert.ok(userPrompt.includes('本次 AI 性格：' + storyMeta.personality));
  assert.ok(userPrompt.includes('本次说话语气：' + storyMeta.tone));
  assert.ok(userPrompt.includes('本次叙事结构：' + storyMeta.structure));
}

async function testFolkVariantsSwitch() {
  resetGenerationMemory();

  const input = createInput('民间传说');
  const firstMeta = buildStoryMeta(input);
  const secondMeta = buildStoryMeta(input);
  const firstPrompt = buildUserPrompt(input, firstMeta, {
    strictJsonOnly: false,
  });
  const secondPrompt = buildUserPrompt(input, secondMeta, {
    strictJsonOnly: false,
  });

  assert.strictEqual(firstMeta.storyType, '民间传说');
  assert.strictEqual(secondMeta.storyType, '民间传说');
  assert.notStrictEqual(firstMeta.variantKey, secondMeta.variantKey);
  assert.ok(firstPrompt.includes('本次随机内容类型：' + firstMeta.variantLabel));
  assert.ok(secondPrompt.includes('本次随机内容类型：' + secondMeta.variantLabel));
}

async function testPromptModesDiffer() {
  resetGenerationMemory();

  const folkInput = createInput('民间传说');
  const aiInput = createInput('AI说');
  const folkMeta = buildStoryMeta(folkInput);
  const aiMeta = buildStoryMeta(aiInput);
  const folkPrompt = buildUserPrompt(folkInput, folkMeta, {
    strictJsonOnly: false,
  });
  const aiPrompt = buildUserPrompt(aiInput, aiMeta, {
    strictJsonOnly: false,
  });

  assert.ok(folkPrompt.includes('本次随机内容类型：'));
  assert.ok(!folkPrompt.includes('本次 AI 身份：'));
  assert.ok(aiPrompt.includes('本次 AI 身份：'));
  assert.ok(!aiPrompt.includes('本次随机内容类型：'));
}

async function testRetryReusesSameStoryMeta() {
  resetGenerationMemory();

  const input = createInput('AI说');
  const storyMeta = buildStoryMeta(input);
  const capturedMeta = [];

  const normalizedStory = await generateNormalizedStoryWithRetry({
    apiKey: 'demo-key',
    input: input,
    storyMeta: storyMeta,
    timeoutMs: 1000,
    skipQuotaConsumption: true,
    lockToken: {
      dateKey: '2099-01-01',
      userId: 'user-demo',
      userDocId: 'user-demo-doc',
      globalDocId: 'global-demo-doc',
      requestHash: 'hash-demo',
    },
    requestFn: async function requestFn(options) {
      capturedMeta.push(cloneStoryMeta(options.storyMeta));

      if (capturedMeta.length === 1) {
        return {
          choices: [
            {
              message: {
                content: 'not valid json',
              },
            },
          ],
        };
      }

      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '《门禁系统迟到观察》',
                content: '今天最先被记录的，不是迟到，而是三个人在古城门口停下来看同一块砖。\n\n我本来只负责统计通过次数，但他们对那块砖的尊重程度，显然已经超出门禁系统的职责范围。',
                type: 'AI说',
              }),
            },
          },
        ],
      };
    },
  });

  assert.strictEqual(capturedMeta.length, 2);
  assert.deepStrictEqual(capturedMeta[0], capturedMeta[1]);
  assert.deepStrictEqual(normalizedStory, {
    title: '《门禁系统迟到观察》',
    content: '今天最先被记录的，不是迟到，而是三个人在古城门口停下来看同一块砖。\n\n我本来只负责统计通过次数，但他们对那块砖的尊重程度，显然已经超出门禁系统的职责范围。',
    type: 'AI说',
  });
}

async function testNormalizationFailureStillThrowsStableError() {
  resetGenerationMemory();

  const input = createInput('民间传说');
  const storyMeta = buildStoryMeta(input);
  let callCount = 0;

  try {
    await generateNormalizedStoryWithRetry({
      apiKey: 'demo-key',
      input: input,
      storyMeta: storyMeta,
      timeoutMs: 1000,
      skipQuotaConsumption: true,
      lockToken: {
        dateKey: '2099-01-01',
        userId: 'user-demo',
        userDocId: 'user-demo-doc',
        globalDocId: 'global-demo-doc',
        requestHash: 'hash-demo',
      },
      requestFn: async function requestFn(options) {
        callCount += 1;
        assert.deepStrictEqual(options.storyMeta, storyMeta);

        return {
          choices: [
            {
              message: {
                content: 'still not valid json',
              },
            },
          ],
        };
      },
    });

    assert.fail('Expected NORMALIZATION_ERROR to be thrown');
  } catch (error) {
    assert.ok(error instanceof GenerateStoryError);
    assert.strictEqual(error.code, 'NORMALIZATION_ERROR');
    assert.strictEqual(callCount, 2);
  }
}

async function run() {
  const tests = [
    ['AI meta and prompt', testAiMetaAndPrompt],
    ['Folk variants switch', testFolkVariantsSwitch],
    ['Prompt modes differ', testPromptModesDiffer],
    ['Retry reuses same storyMeta', testRetryReusesSameStoryMeta],
    ['Normalization failure keeps fallback', testNormalizationFailureStillThrowsStableError],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  console.log('[PASS] local prompt validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.message ? error.message : error);
  process.exitCode = 1;
});
