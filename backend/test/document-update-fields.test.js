const assert = require('node:assert/strict');
const test = require('node:test');
const { stripSharingFields } = require('../lib/authorization');

const body = {
  title: 'T',
  content: '<p>x</p>',
  sharedWith: [{ email: 'friend@example.com', role: 'owner' }],
  shareLinkEnabled: true,
  shareLinkRole: 'owner',
  accessPolicy: { allowDownload: true },
};

test('an editor save cannot change who the document is shared with', () => {
  const kept = stripSharingFields(body, { allowed: false });
  assert.deepEqual(kept, { title: 'T', content: '<p>x</p>' });
});

test('the owner keeps sharing fields in a save', () => {
  assert.deepEqual(stripSharingFields(body, { allowed: true }), body);
});

const { getEffectiveRole } = require('../lib/authorization');

test('a share link never makes its holder an owner', () => {
  const doc = { owner: { id: 'u1', email: 'owner@example.com' }, shareLinkEnabled: true, shareLinkRole: 'owner', sharedWith: [{ email: '', role: 'owner' }] };
  const role = getEffectiveRole(doc, { id: 'u2', email: 'stranger@example.com' });
  assert.notEqual(role, 'owner');
});

const { normalizeDoc } = require('../lib/documentStore');
test('document read preserves citation sources, page count, layout, and design', () => {
  const sources = [{ id: 'source', author: 'Jane Smith', title: 'Book', year: '2026' }];
  const mailMerge = { recipients: [{ FirstName: 'Ada' }], mapping: { FirstName: 'Name' } };
  const document = normalizeDoc({ id: 'test', references: { sources, mailMerge }, pageCount: 3, layout: { pageOrientation: 'landscape' }, design: { pageColor: '#dfeaea' } });
  assert.deepEqual(document.references.sources, sources);
  assert.deepEqual(document.references.mailMerge, mailMerge);
  assert.equal(document.pageCount, 3);
  assert.equal(document.layout.pageOrientation, 'landscape');
  assert.equal(document.design.pageColor, '#dfeaea');
});
