import { router } from "./trpc";
import { conversationRouter } from "./routers/conversation";
import { brandProfileRouter } from "./routers/brand-profile";

export const appRouter = router({
  conversation: conversationRouter,
  brandProfile: brandProfileRouter,
});

export type AppRouter = typeof appRouter;
