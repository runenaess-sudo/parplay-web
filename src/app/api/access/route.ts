import { getUserAccess } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET() {
    const access = await getUserAccess();
    return NextResponse.json(access);
}
