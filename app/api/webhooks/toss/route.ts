import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // TODO: Toss Payments webhook integration
  // 1. Verify webhook signature
  // 2. Parse payment event
  // 3. Update user tier in profiles table
  // 4. Return 200

  const body = await request.json();

  console.log("Toss Payments webhook received:", body);

  return NextResponse.json({ received: true });
}
