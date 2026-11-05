export type Status = 'unanswered' | 'in_review' | 'answered';
export type Reply = { author: string; text: string; createdAt: string };
export type Question = { id: string; question: string; lessonReference: string; authorName: string; upvotes: string[]; upvoteCount: number; status: Status; createdAt: { seconds: number } | null; replies: Reply[] };
