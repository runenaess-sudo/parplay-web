import { NextResponse } from "next/server";
import { getUserAccess } from "@/src/lib/access";

export async function GET() {
    const access = await getUserAccess();
    return NextResponse.json(access);
}
