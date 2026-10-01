import type {Prisma} from './generated/prisma/client';

// Authored showcase content is limited to the explicitly configured local store.
// Never publish sample testimonials when switching to real commerce.
export function publicReviewWhere(testMode=process.env.TEST_MODE==='true'):Prisma.ReviewWhereInput {
 return {status:'APPROVED',...(testMode?{OR:[{isDemo:false},{isDemo:true,id:{startsWith:'showcase-review-'}}]}:{isDemo:false})};
}
