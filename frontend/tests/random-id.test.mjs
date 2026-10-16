import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomId } from '../../shared/random-id.ts';

test('内网 HTTP 缺少 randomUUID 时使用安全随机字节产生合法 v4 UUID', () => {
  const source = { getRandomValues: values => crypto.getRandomValues(values) };
  const ids = Array.from({ length: 100 }, () => randomId(source));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
