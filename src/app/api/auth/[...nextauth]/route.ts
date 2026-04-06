import { handlers } from '@/lib/auth';

type AuthRouteHandler = (request: Request) => Response | Promise<Response>;

const getHandler = handlers.GET as AuthRouteHandler;
const postHandler = handlers.POST as AuthRouteHandler;

export function GET(request: Request) {
  return getHandler(request);
}

export function POST(request: Request) {
  return postHandler(request);
}
