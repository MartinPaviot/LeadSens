import { Inngest } from 'inngest';
import { schemas } from './events';

export const inngest = new Inngest({ id: 'elevay-seo', schemas });
