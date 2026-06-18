import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";

type MenuItemProps = {
    href: string;
    active: boolean;
    children: ReactNode;
};

export function MenuItem({ href, active, children }: MenuItemProps) {
    return (
        <Link
            href={href}
            className={clsx(
                "transition-colors duration-150",
                "text-white hover:text-gray-300",
                active && "font-semibold text-white"
            )}
        >
            {children}
        </Link>
    );
}
