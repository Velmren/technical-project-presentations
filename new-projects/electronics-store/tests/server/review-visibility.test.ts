import {describe,it,expect} from 'vitest';
import {publicReviewWhere} from '../../src/server/review-visibility';
describe('Review visibility',()=>{
 it('excludes authored content outside the local showcase',()=>{
  expect(publicReviewWhere(false)).toEqual({status:'APPROVED',isDemo:false});
 });
 it('allows only the curated sample series in the local showcase',()=>{
  expect(publicReviewWhere(true)).toEqual({status:'APPROVED',OR:[{isDemo:false},{isDemo:true,id:{startsWith:'showcase-review-'}}]});
 });
});
