export type Status = 'unanswered' | 'in_review' | 'answered';
export type Reply = { id?: string; authorUid?: string; author: string; text: string; createdAt: string };
export type Question = { id: string; question: string; lessonReference: string; authorName: string; authorUid?: string; upvotes: string[]; upvoteCount: number; status: Status; createdAt: { seconds: number } | null; replies: Reply[] };
