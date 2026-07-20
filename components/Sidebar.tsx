// components/Sidebar.tsx
"use client" // Remove this text and type 'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rooms', href: '/dashboard/rooms' },
    { label: 'Kiosks', href: '/dashboard/kiosks' },
    { label: 'Map', href: '/dashboard/maps' },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 flex flex-col justify-between p-4 z-40 hidden md:flex">
      <div className="flex flex-col gap-6 w-full">
        <div className="text-xl font-bold px-2">My App</div>
        <nav className="flex flex-col gap-1 w-full">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="text-xs text-gray-500 border-t border-gray-800 pt-4 px-2">
        v1.0.0
      </div>
    </aside>
  );
}

