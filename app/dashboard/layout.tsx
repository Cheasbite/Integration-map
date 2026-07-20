// app/dashboard/layout.tsx
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - fixed and visible on desktop */}
      <Sidebar />

      {/* Main Content Area - pushed over by sidebar width (ml-64) */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        {/* Optional Header Component */}
        <header className="h-16 bg-white border-b flex items-center px-6 sticky top-0 z-30">
          <span className="font-semibold text-gray-700">Dashboard Area</span>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto text-black">
          {children}
        </main>
      </div>
    </div>
  );
}

