"use client"

import {
  LayoutDashboard,
  Users,
  Calendar,
  Bell,
  Settings,
  LogOut,
  FileText,
} from "lucide-react"

export default function AppSidebar() {
  return (
    <div className="w-[72px] h-screen bg-[#0B3D3B] flex flex-col items-center py-6 justify-between">

      {/* TOP SECTION */}
      <div className="flex flex-col items-center gap-8">

        {/* LOGO */}
        <div className="w-10 h-10 flex items-center justify-center">
          <img src="/images/logo-icon.png" alt="logo" className="w-8 h-8" />
        </div>

        {/* ICON MENU */}
        <div className="flex flex-col items-center gap-8 text-white/80">

          <SidebarIcon icon={<LayoutDashboard size={22} />} />
          <SidebarIcon icon={<FileText size={22} />} />
          <SidebarIcon icon={<Users size={22} />} active />
          <SidebarIcon icon={<Calendar size={22} />} />
          <SidebarIcon icon={<Bell size={22} />} />
          <SidebarIcon icon={<Settings size={22} />} />

        </div>

      </div>

      {/* BOTTOM */}
      <div className="flex flex-col items-center gap-6">

        <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm">
          N
        </div>

        <button className="text-white/80 hover:text-white">
          <LogOut size={22} />
        </button>

      </div>
    </div>
  )
}

function SidebarIcon({
  icon,
  active = false,
}: {
  icon: React.ReactNode
  active?: boolean
}) {
  return (
    <div
      className={`w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition ${
        active
          ? "bg-[#0F5C57] text-white"
          : "hover:bg-white/10 text-white/70"
      }`}
    >
      {icon}
    </div>
  )
}