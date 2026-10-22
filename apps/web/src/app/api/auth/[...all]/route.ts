import { getAuth } from "@/server/auth/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = (request: Request) => getAuth().handler(request);

export { handle as GET, handle as POST };
