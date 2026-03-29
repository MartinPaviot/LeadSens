import { auth } from '@/lib/auth';
import {
  createOnboardingState,
  applyAnswer,
  getCurrentQuestion,
  finalizeOnboarding,
} from '@/agents/seo-geo/onboarding';
import type { OnboardingState } from '@/agents/seo-geo/onboarding';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as {
    action: 'start' | 'answer';
    state?: OnboardingState;
    answer?: string;
    agentFamily?: string;
  };

  if (body.action === 'start') {
    const state = createOnboardingState(session.user.id, body.agentFamily ?? 'seo-geo');
    const question = getCurrentQuestion(state);
    return Response.json({ state, question });
  }

  if (body.action === 'answer' && body.state && body.answer !== undefined) {
    const nextState = applyAnswer(body.state, body.answer);
    if (nextState.status === 'complete') {
      const result = finalizeOnboarding(nextState);
      return Response.json({ state: nextState, complete: true, result });
    }
    const question = getCurrentQuestion(nextState);
    return Response.json({ state: nextState, question, complete: false });
  }

  return new Response('Bad request', { status: 400 });
}
