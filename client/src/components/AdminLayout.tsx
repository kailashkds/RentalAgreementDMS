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
  Shield,
  FileCheck
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Agreements", href: "/agreements", icon: FileSignature },
  { name: "Notarized Documents", href: "/notarized-documents", icon: FileCheck },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Properties", href: "/properties", icon: MapPin },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "PDF Templates", href: "/pdf-templates", icon: FileText },
  { name: "Societies", href: "/societies", icon: Building },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageSquare },
];


export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Filter navigation based on user role - only super admin can see customers
  const filteredNavigation = navigation.filter(item => {
    if (item.href === "/customers") {
      return (user as any)?.role === "super_admin";
    }
    return true;
  });

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
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col h-screen">
        <div className="px-6 py-4 border-b border-gray-200 h-20 flex items-center">
          <div className="flex justify-center w-full">
            <img 
              src="https://quickkaraar.com/images/logo.png" 
              alt="QuickKaraar" 
              className="h-12 w-auto"
            />
          </div>
        </div>
        
        <nav className="mt-6 flex-1 flex flex-col">
          <div className="px-4 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}
                    className={cn(
                      "flex items-center px-4 py-3 rounded-lg font-medium transition-colors",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-gray-600 hover:bg-gray-50 hover:text-primary"
                    )}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                </Link>
              );
            })}
          </div>
          
          
          {/* Spacer to push user info to bottom */}
          <div className="flex-1"></div>
        </nav>
        
        {/* User info and logout at bottom */}
        <div className="px-4 py-4 bg-gray-50 border-t flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-900">{(user as any)?.name || 'Administrator'}</div>
                <div className="text-gray-500">@{(user as any)?.username || 'admin'}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="px-6 py-4 h-20 flex items-center">
            <div className="flex items-center justify-between w-full">
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
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">{(user as any)?.name || "System Administrator"}</p>
                    <p className="text-xs text-gray-600">Administrator</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-muted/30">
          <div className="px-6 py-6 min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
