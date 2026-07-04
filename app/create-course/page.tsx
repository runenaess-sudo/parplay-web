"use client";

import Link from "next/link";

export default function CreateCoursePage() {
    return (
        <div className="p-8 max-w-3xl mx-auto text-white">
            <h1 className="text-3xl font-bold mb-2">Course Admin Panel</h1>
            <p className="text-gray-400 mb-10">
                Manage all course creation and editing tools.
            </p>

            {/* GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* CREATE NEW COURSE */}
                <Link
                    href="/create-course/new"
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-6 flex flex-col items-center text-center transition"
                >
                    <div className="text-4xl mb-3">➕</div>
                    <div className="text-lg font-semibold">Create New Course</div>
                    <div className="text-sm text-gray-400 mt-1">
                        Start a brand new course from scratch.
                    </div>
                </Link>

                {/* EDIT EXISTING COURSE */}
                <Link
                    href="/create-course/edit"
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-6 flex flex-col items-center text-center transition"
                >
                    <div className="text-4xl mb-3">🛠️</div>
                    <div className="text-lg font-semibold">Edit Existing Course</div>
                    <div className="text-sm text-gray-400 mt-1">
                        Continue editing or update a published course.
                    </div>
                </Link>

            </div>
        </div>
    );
}
