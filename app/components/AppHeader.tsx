// components/layout/AppHeader.tsx
import { Bell, Plus, User } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-slate-900/80 px-6 backdrop-blur-sm lg:pl-72">
      {/* Mobile menu button - you can connect to sheet/drawer */}
      <button className="lg:hidden">
        {/* Hamburger icon */}
        <div className="space-y-1.5">
          <span className="block h-0.5 w-6 bg-teal-100"></span>
          <span className="block h-0.5 w-6 bg-teal-100"></span>
          <span className="block h-0.5 w-6 bg-teal-100"></span>
        </div>
      </button>

      <div className="ml-auto flex items-center gap-4">
        <button className="relative rounded-full p-2 hover:bg-slate-800">
          <Bell className="h-5 w-5 text-slate-300" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500">
          <Plus className="h-4 w-4" />
          Create Candidate
        </button>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-700">
            {/* Replace with real avatar */}
            <img src="/api/placeholder/36/36" alt="Sean Smith" className="h-full w-full object-cover" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium">Sean Smith</p>
            <p className="text-xs text-slate-400">Manager</p>
          </div>
        </div>
      </div>
    </header>
  );
}