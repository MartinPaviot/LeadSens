import { router } from "./trpc";
import { campaignRouter } from "./routers/campaign";
import { conversationRouter } from "./routers/conversation";
import { feedbackRouter } from "./routers/feedback";
import { integrationRouter } from "./routers/integration";
import { repliesRouter } from "./routers/replies";
import { workspaceRouter } from "./routers/workspace";

export const appRouter = router({
  campaign: campaignRouter,
  conversation: conversationRouter,
  feedback: feedbackRouter,
  integration: integrationRouter,
  replies: repliesRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
