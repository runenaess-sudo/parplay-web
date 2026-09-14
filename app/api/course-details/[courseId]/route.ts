import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ courseId: string }> },
) {
    const { courseId } = await params;
    if (!await canOpenCourseEditor(courseId)) {
        return NextResponse.json({ error: "You do not have access to manage this course." }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!name || !location) {
        return NextResponse.json({ error: "Course name and location are required." }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
        .from("courses")
        .update({
            name,
            location,
            description: description || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", courseId)
        .select("name,location,description,updated_at")
        .maybeSingle();

    if (error || !data) {
        return NextResponse.json({ error: "Course details could not be saved." }, { status: 403 });
    }
    return NextResponse.json({ course: data });
}
