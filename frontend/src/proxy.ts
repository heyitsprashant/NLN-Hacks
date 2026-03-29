import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/journal/:path*",
    "/copilot/:path*",
    "/call/:path*",
    "/settings/:path*",
  ],
};

export function proxy(req: NextRequest) {
  void req;

  return NextResponse.next();
}

