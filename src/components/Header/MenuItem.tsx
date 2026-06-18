import Link from "next/link";
import type { ReactNode } from "react";

type MenuItemProps = {
    href: string;
    active: boolean;
    children: ReactNode;
};

export function MenuItem({ href, active, children }: MenuItemProps) {
    return (
        <Link
            href={href}
            className={`hover:text-blue-600 transition ${active ? "text-blue-600 font-semibold" : "text-gray-700"
                }`}
        >
            {children}
        </Link>
    );
}
