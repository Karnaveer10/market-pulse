import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Megaphone, Users, Radio, MousePointerClick,
  BarChart3, Menu, X, ChevronLeft, Search, Bell, Moon, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { title: 'Dashboard', path: '/', icon: LayoutDashboard },
  { title: 'Products', path: '/products', icon: Package },
  { title: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { title: 'Customers', path: '/customers', icon: Users },
  { title: 'Channels', path: '/channels', icon: Radio },
  { title: 'Interactions', path: '/interactions', icon: MousePointerClick },
  { title: 'Analytics', path: '/analytics', icon: BarChart3 },
];

export default function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  // Set dark mode on mount
  if (typeof window !== 'undefined' && !document.documentElement.classList.contains('dark') && isDark) {
    document.documentElement.classList.add('dark');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary-foreground" />
        </div>
        {sidebarOpen && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-bold text-sidebar-accent-foreground tracking-tight"
          >
            MarketPulse
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="text-sm">{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={toggleTheme}
          className="sidebar-item w-full"
        >
          {isDark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          {sidebarOpen && <span className="text-sm">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-[68px]'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-sidebar-border z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) setMobileOpen(!mobileOpen);
                else setSidebarOpen(!sidebarOpen);
              }}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : sidebarOpen ? <ChevronLeft className="w-5 h-5 hidden lg:block" /> : <Menu className="w-5 h-5" />}
              <Menu className="w-5 h-5 lg:hidden" />
            </button>

            <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
              MP
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
