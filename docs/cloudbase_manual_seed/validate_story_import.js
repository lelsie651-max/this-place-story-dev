const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error('[validate_story_import] ' + message);
  process.exit(1);
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderLocationId(locationId) {
  const normalized = trimString(locationId);

  if (!normalized) {
    return true;
  }

  if (normalized.indexOf('填写真实') !== -1) {
    return true;
  }

  if (normalized.indexOf('<') !== -1 || normalized.indexOf('>') !== -1) {
    return true;
  }

  if (normalized === 'REPLACE_WITH_REAL_LOCATION_ID') {
    return true;
  }

  return false;
}

function validateStoryRecord(record, index) {
  const locationId = trimString(record.locationId);
  const type = trimString(record.type);
  const status = trimString(record.status);
  const source = trimString(record.source);

  if (!locationId) {
    fail('第 ' + index + ' 条记录缺少 locationId。');
  }

  if (isPlaceholderLocationId(locationId)) {
    fail('第 ' + index + ' 条记录的 locationId 仍是模板占位符：' + locationId);
  }

  if (type !== 'folk') {
    fail('第 ' + index + ' 条记录的 type 必须为 folk。');
  }

  if (status !== 'published') {
    fail('第 ' + index + ' 条记录的 status 必须为 published。');
  }

  if (source !== 'folk_archive') {
    fail('第 ' + index + ' 条记录的 source 必须为 folk_archive。');
  }

  if (!trimString(record.title)) {
    fail('第 ' + index + ' 条记录缺少 title。');
  }

  if (!trimString(record.summary)) {
    fail('第 ' + index + ' 条记录缺少 summary。');
  }

  if (!trimString(record.content)) {
    fail('第 ' + index + ' 条记录缺少 content。');
  }

  if (!trimString(record.language)) {
    fail('第 ' + index + ' 条记录缺少 language。');
  }
}

function parseCsv(content) {
  const rows = content.trim().split(/\r?\n/);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].split(',');

  return rows.slice(1).map(function mapRow(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const nextCharacter = line[index + 1];

      if (character === '"' && inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = !inQuotes;
      } else if (character === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += character;
      }
    }

    values.push(current);

    return headers.reduce(function buildRecord(record, header, headerIndex) {
      record[trimString(header)] = typeof values[headerIndex] === 'undefined' ? '' : values[headerIndex];
      return record;
    }, {});
  });
}

function parseJsonl(content) {
  return content
    .split(/\r?\n/)
    .map(function normalizeLine(line) {
      return line.trim();
    })
    .filter(Boolean)
    .map(function parseLine(line) {
      return JSON.parse(line);
    });
}

function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    fail('请传入待导入的 stories CSV 或 JSONL 文件路径。');
  }

  const absolutePath = path.resolve(targetPath);

  if (!fs.existsSync(absolutePath)) {
    fail('文件不存在：' + absolutePath);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const extension = path.extname(absolutePath).toLowerCase();
  let records = [];

  if (extension === '.csv') {
    records = parseCsv(content);
  } else if (extension === '.jsonl') {
    records = parseJsonl(content);
  } else {
    fail('当前只支持校验 .csv 或 .jsonl 文件。');
  }

  if (!records.length) {
    fail('文件中没有可校验的记录。');
  }

  records.forEach(function validateRecord(record, index) {
    validateStoryRecord(record, index + 1);
  });

  console.log('[validate_story_import] 校验通过，共 ' + records.length + ' 条 stories 记录。');
}

main();
