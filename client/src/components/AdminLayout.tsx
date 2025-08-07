import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  FileSignature,
  Users,
  FolderOpen,
  FileText,
  MapPin,
  MessageSquare,
  Settings,
  UserCircle,
  Bell,
  Home,
  Building,
  LogOut,
  Shield
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Agreements", href: "/agreements", icon: FileSignature },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "PDF Templates", href: "/pdf-templates", icon: FileText },
  { name: "Societies", href: "/societies", icon: Building },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageSquare },
];

const settingsNavigation = [
  { name: "Admin Users", href: "/admin/users", icon: Shield },
  { name: "System Settings", href: "/settings", icon: Settings },
  { name: "Profile", href: "/profile", icon: UserCircle },
];

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      queryClient.clear();
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-center">
            <img 
              src="https://quickkaraar.com/images/logo.png" 
              alt="QuickKaraar" 
              className="h-12 w-auto"
            />
          </div>
        </div>
        
        <nav className="mt-6">
          <div className="px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center px-4 py-3 rounded-lg font-medium transition-colors",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-gray-600 hover:bg-gray-50 hover:text-primary"
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </a>
                </Link>
              );
            })}
          </div>
          
          <div className="px-4 mt-8">
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Settings
            </h3>
            <div className="mt-2 space-y-2">
              {settingsNavigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center px-4 py-3 rounded-lg transition-colors",
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-gray-600 hover:bg-gray-50 hover:text-primary"
                      )}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
        
        {/* User info and logout at bottom */}
        <div className="mt-auto p-4 bg-gray-50 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-900">{user?.name}</div>
                <div className="text-gray-500">@{user?.username}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
              </div>
              <div className="flex items-center space-x-4">
                <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    3
                  </span>
                </button>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                    <img 
                      src="https://quickkaraar.com/images/logo.png" 
                      alt="QuickKaraar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{user?.name || "Admin User"}</p>
                    <p className="text-xs text-gray-600">Administrator</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
