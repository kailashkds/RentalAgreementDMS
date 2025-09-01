import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
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
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Agreements", href: "/agreements", icon: FileSignature },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Properties", href: "/properties", icon: MapPin },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "PDF Templates", href: "/pdf-templates", icon: FileText },
  { name: "Societies", href: "/societies", icon: Building },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageSquare },
];

const settingsNavigation = [
  { name: "User & Role Management", href: "/admin/user-role-management", icon: Shield },
  { name: "System Settings", href: "/settings", icon: Settings },
  { name: "Profile", href: "/profile", icon: UserCircle },
];

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Use permission-based checks instead of role checks
  // This line is kept for backward compatibility but should use permissions
  
  // Filter main navigation based on permissions - STRICT permission-based filtering
  const filteredNavigation = navigation.filter(item => {
    // Dashboard - requires dashboard.view permission
    if (item.href === "/") {
      return hasPermission('dashboard.view');
    }
    
    // Agreements - requires agreement viewing permission
    if (item.href === "/agreements") {
      return hasPermission('agreement.view.own') || hasPermission('agreement.view.all');
    }
    
    // Customer management - requires customer management permission
    if (item.href === "/customers") {
      return hasPermission('customer.view.all') || hasPermission('customer.manage');
    }
    
    // Properties - requires property management permission (assuming staff+ access)
    if (item.href === "/properties") {
      return hasPermission('system.admin') || hasPermission('customer.manage');
    }
    
    // Documents - requires agreement viewing permission
    if (item.href === "/documents") {
      return hasPermission('agreement.view.all') || hasPermission('system.admin');
    }
    
    // PDF Templates - requires template management permission
    if (item.href === "/pdf-templates") {
      return hasPermission('template.manage') || hasPermission('template.edit') || hasPermission('template.create');
    }
    
    // Societies - requires property management permission (assuming staff+ access)
    if (item.href === "/societies") {
      return hasPermission('system.admin') || hasPermission('customer.manage');
    }
    
    // WhatsApp - requires system admin permission
    if (item.href === "/whatsapp") {
      return hasPermission('system.admin');
    }
    
    // Default: deny access unless explicitly allowed
    return false;
  });

  // Filter settings navigation based on permissions
  const filteredSettingsNavigation = settingsNavigation.filter(item => {
    if (item.href === "/admin/user-role-management") {
      return hasPermission('user.manage') || hasPermission('role.manage');
    }
    if (item.href === "/settings") {
      return hasPermission('system.admin');
    }
    // Profile is always visible
    return true;
  });

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", "POST");
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
        <div className="px-6 py-4 border-b border-gray-200 h-20 flex items-center flex-shrink-0">
          <div className="flex justify-center w-full">
            <img 
              src="https://quickkaraar.com/images/logo.png" 
              alt="QuickKaraar" 
              className="h-12 w-auto"
            />
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-2">
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
            
            {filteredSettingsNavigation.length > 0 && (
              <div className="mt-8">
                <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Settings
                </h3>
                <div className="mt-2 space-y-2">
                  {filteredSettingsNavigation.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <Link key={item.name} href={item.href}
                          className={cn(
                            "flex items-center px-4 py-3 rounded-lg transition-colors",
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
              </div>
            )}
          </div>
        </nav>
        
        {/* User info and logout at bottom */}
        <div className="px-4 py-4 bg-gray-50 border-t flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-900">{(user as any)?.name || 'User'}</div>
                <div className="text-gray-500">
                  {(user as any)?.mobile || `@${(user as any)?.username || 'admin'}`}
                </div>
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
