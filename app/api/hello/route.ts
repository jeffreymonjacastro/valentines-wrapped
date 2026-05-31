import { NextResponse } from "next/server";

import type { ErrorResponse, HelloResponse } from "@/types";

export function GET(): NextResponse<HelloResponse | ErrorResponse> {
  try {
    return NextResponse.json({ message: "Hello World" }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
