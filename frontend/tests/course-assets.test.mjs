import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseAssetIds,assetMediaUrl,normalizeAssetDocument} from '../../shared/course-assets.ts';
test('素材引用去重并按管理/学员视图切换，标准化不改写原版本',()=>{
 const document={scenes:[{src:'/api/admin/course-assets/one',poster:'/api/learn/course-assets/two',content:'<img src="/api/admin/course-assets/one">'}]};
 assert.deepEqual(courseAssetIds(document),['one','two']);const normalized=normalizeAssetDocument(document);assert.equal(normalized.scenes[0].src,'/api/learn/course-assets/one');assert.equal(document.scenes[0].src,'/api/admin/course-assets/one');assert.equal(assetMediaUrl(normalized.scenes[0].src,'admin'),'/api/admin/course-assets/one');
});
