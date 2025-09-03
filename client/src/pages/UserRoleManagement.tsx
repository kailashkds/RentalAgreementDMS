import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Shield, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  UserPlus,
  Settings,
  Key,
  Eye,
  EyeOff,
  Info,
  UserCheck
} from "lucide-react";

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string; // Add mobile field from API
  status: string;
  isActive: boolean;
  defaultRole?: string;
  role?: string;
  roles?: Role[]; // Array of assigned roles from the unified system
  permissions?: string[];
  manualPermissions?: {
    added: string[];
    removed: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export default function UserRoleManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("users");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isViewPermissionsModalOpen, setIsViewPermissionsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [managingPermissionsUser, setManagingPermissionsUser] = useState<User | null>(null);
  const [viewingPermissionsUser, setViewingPermissionsUser] = useState<User | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [isRoleAssignmentModalOpen, setIsRoleAssignmentModalOpen] = useState(false);
  const [managingRoleAssignments, setManagingRoleAssignments] = useState<Role | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // User form data
  const [userFormData, setUserFormData] = useState({
    username: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    roleId: "",
    status: "active"
  });

  // Role form data
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[]
  });

  // Fetch data
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<{ users: User[]; total: number }>({
    queryKey: ["/api/unified/users"],
  });
  
  const users = usersData?.users || [];

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/unified/roles"],
  });

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/unified/permissions"],
  });

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: (userData: any) => 
      apiRequest("/api/unified/users", "POST", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      setIsUserModalOpen(false);
      resetUserForm();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/unified/users/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      setIsUserModalOpen(false);
      setEditingUser(null);
      resetUserForm();
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest(`/api/unified/users/${userId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest(`/api/unified/users/${userId}/reset-password`, "PATCH");
      return response.json();
    },
    onSuccess: (data: { password: string }) => {
      toast({
        title: "Password Reset Successful",
        description: `New password: ${data.password}`,
        duration: 10000, // Show for 10 seconds so admin can copy it
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  // Role mutations
  const createRoleMutation = useMutation({
    mutationFn: (roleData: typeof roleFormData) => 
      apiRequest("/api/unified/roles", "POST", roleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/roles"] });
      setIsRoleModalOpen(false);
      resetRoleForm();
      toast({
        title: "Success",
        description: "Role created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof roleFormData> }) => 
      apiRequest(`/api/unified/roles/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/roles"] });
      setIsRoleModalOpen(false);
      setEditingRole(null);
      resetRoleForm();
      toast({
        title: "Success",
        description: "Role updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => 
      apiRequest(`/api/unified/roles/${roleId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/roles"] });
      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/unified/users/${id}/toggle-status`, 'PATCH', { isActive });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "User status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  // Permission override mutations - Re-enabled for UserRoleManagement
  const addPermissionOverrideMutation = useMutation({
    mutationFn: async ({ userId, permissionId, isGranted = true }: { userId: string; permissionId: string; isGranted?: boolean }) => {
      const response = await apiRequest(`/api/unified/users/${userId}/permission-overrides`, "POST", { permissionId, isGranted });
      return response.json();
    },
    onSuccess: async () => {
      // No automatic state clearing or dialog closing here - handled in batch save
    },
    onError: (error: any) => {
      console.error('Permission override error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update permission",
        variant: "destructive",
      });
    },
  });

  const removePermissionOverrideMutation = useMutation({
    mutationFn: async ({ userId, permissionId }: { userId: string; permissionId: string }) => {
      const response = await apiRequest(`/api/unified/users/${userId}/permission-overrides/${permissionId}`, "DELETE");
      return response.json();
    },
    onSuccess: async () => {
      // No automatic state clearing or dialog closing here - handled in batch save
    },
    onError: (error: any) => {
      console.error('Permission override removal error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove permission",
        variant: "destructive",
      });
    },
  });

  // Role assignment mutations
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      return await apiRequest(`/api/unified/users/${userId}`, "PUT", { roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      toast({
        title: "Success",
        description: "Role assigned successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return await apiRequest(`/api/unified/users/${userId}`, "PUT", { roleId: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      toast({
        title: "Success",
        description: "Role removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove role",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const resetUserForm = () => {
    setUserFormData({
      username: "",
      name: "",
      email: "",
      phone: "",
      password: "",
      roleId: "",
      status: "active"
    });
  };

  const resetRoleForm = () => {
    setRoleFormData({
      name: "",
      description: "",
      permissions: []
    });
  };

  const openCreateUser = () => {
    setEditingUser(null);
    resetUserForm();
    setIsUserModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    
    // Get the first assigned role for editing (in case user has multiple roles)
    const userRole = user.roles && user.roles.length > 0 ? user.roles[0] : null;
    
    setUserFormData({
      username: user.username,
      name: user.name,
      email: user.email || "",
      phone: user.mobile || "", // Use mobile field from API instead of phone
      password: "",
      roleId: userRole?.id || "", // Use the actual role ID for proper Select mapping
      status: user.status
    });
    setIsUserModalOpen(true);
  };

  const openCreateRole = () => {
    setEditingRole(null);
    resetRoleForm();
    setIsRoleModalOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions
    });
    setIsRoleModalOpen(true);
  };

  const openManagePermissions = (user: User) => {
    setManagingPermissionsUser(user);
    setIsPermissionsModalOpen(true);
    // Reset local state when opening dialog
    setLocalPermissionChanges(new Map());
    setHasUnsavedChanges(false);
    // Force refresh user data when opening dialog
    queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
  };

  const openRoleAssignments = (role: Role) => {
    setManagingRoleAssignments(role);
    setIsRoleAssignmentModalOpen(true);
  };

  const handleRoleAssignmentToggle = async (user: User, role: Role, isAssigned: boolean) => {
    if (isAssigned) {
      // Remove role from user
      removeRoleMutation.mutate({ userId: user.id });
    } else {
      // Assign role to user
      assignRoleMutation.mutate({ userId: user.id, roleId: role.id });
    }
  };

  const isUserAssignedToRole = (user: User, roleId: string): boolean => {
    return user.roles?.some(role => role.id === roleId) || false;
  };

  // Local state for permission changes
  const [localPermissionChanges, setLocalPermissionChanges] = useState<Map<string, boolean>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handlePermissionToggle = (userId: string, permissionId: string, permissionName: string, checked: boolean) => {
    // Visual-only change - no API calls
    setLocalPermissionChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(permissionId, checked);
      return newMap;
    });
    setHasUnsavedChanges(true);
  };

  // Get changes summary for confirmation dialog
  const getChangesSummary = () => {
    if (!managingPermissionsUser) return { adding: 0, removing: 0 };
    
    let adding = 0;
    let removing = 0;
    
    const userPermissions = getUserPermissions(managingPermissionsUser);
    
    localPermissionChanges.forEach((newCheckedState, permissionId) => {
      const permission = permissions.find(p => p.id === permissionId);
      if (!permission) return;
      
      const currentHasPermission = userPermissions.total.includes(permission.name);
      
      if (newCheckedState && !currentHasPermission) {
        adding++;
      } else if (!newCheckedState && currentHasPermission) {
        removing++;
      }
    });
    
    return { adding, removing };
  };

  // Batch save all permission changes
  const handleSavePermissionChanges = async () => {
    if (!managingPermissionsUser || localPermissionChanges.size === 0) return;
    
    try {
      const promises: Promise<any>[] = [];
      const userPermissions = getUserPermissions(managingPermissionsUser);
      
      localPermissionChanges.forEach((newCheckedState, permissionId) => {
        // Find the permission object to get the permission name
        const permission = permissions.find(p => p.id === permissionId);
        if (!permission) return;
        
        const currentHasPermission = userPermissions.total.includes(permission.name);
        
        // If new state is different from current state, make the change
        if (newCheckedState && !currentHasPermission) {
          // Add permission
          promises.push(addPermissionOverrideMutation.mutateAsync({ 
            userId: managingPermissionsUser.id, 
            permissionId 
          }));
        } else if (!newCheckedState && currentHasPermission) {
          // Remove permission using DELETE endpoint
          promises.push(removePermissionOverrideMutation.mutateAsync({ 
            userId: managingPermissionsUser.id, 
            permissionId
          }));
        }
      });
      
      await Promise.all(promises);
      
      // Invalidate and refetch user data to show updated permissions
      await queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
      
      // DO NOT clear local state here - keep the toggles in their updated state
      // Local state will be cleared when the dialog is closed or discarded
      
      toast({
        title: "Permissions Updated",
        description: `${localPermissionChanges.size} permission changes applied successfully`,
      });
      
      // Auto-close the permissions dialog after showing notification
      setTimeout(() => {
        setIsPermissionsModalOpen(false);
        // Clear local state only when dialog actually closes
        setLocalPermissionChanges(new Map());
        setHasUnsavedChanges(false);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to save permission changes:', error);
      toast({
        title: "Error",
        description: "Failed to save some permission changes",
        variant: "destructive",
      });
    }
  };

  const handleDiscardPermissionChanges = () => {
    setLocalPermissionChanges(new Map());
    setHasUnsavedChanges(false);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Map phone field to mobile for API compatibility
    const { phone, ...restFormData } = userFormData;
    const apiData = {
      ...restFormData,
      mobile: phone
    };
    
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: apiData });
    } else {
      createUserMutation.mutate(apiData);
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: roleFormData });
    } else {
      createRoleMutation.mutate(roleFormData);
    }
  };

  const togglePermission = (permission: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const getPermissionsByCategory = () => {
    const categorized: Record<string, Permission[]> = {};
    permissions.forEach(permission => {
      if (!categorized[permission.category]) {
        categorized[permission.category] = [];
      }
      categorized[permission.category].push(permission);
    });
    return categorized;
  };

  const formatPermissionName = (permission: string) => {
    // Safety check: ensure permission is a string before calling split
    if (typeof permission !== 'string') {
      console.warn('formatPermissionName received non-string:', permission);
      return String(permission);
    }
    
    return permission
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getRoleByName = (roleName: string) => {
    if (!roleName) return undefined;
    return roles.find(role => role.name?.toLowerCase().replace(' ', '_') === roleName.toLowerCase());
  };

  const getUserPermissions = (user: User) => {
    // Get permissions from all assigned roles
    const rolePermissions = user.roles?.flatMap(role => role.permissions || []) || [];
    const manualAdded = user.manualPermissions?.added || [];
    const manualRemoved = user.manualPermissions?.removed || [];
    
    // Remove duplicates from role permissions
    const uniqueRolePermissions = Array.from(new Set(rolePermissions));
    
    // Calculate inherited permissions (role permissions minus manually removed ones)
    const inherited = uniqueRolePermissions.filter(p => !manualRemoved.includes(p));
    
    // Calculate manual permissions (only those not already in role permissions)
    const manual = manualAdded.filter(p => !uniqueRolePermissions.includes(p));
    
    // Calculate total permissions (inherited + manual, then remove duplicates)
    const total = Array.from(new Set([...inherited, ...manualAdded]));
    
    return {
      inherited,
      manual,
      total
    };
  };

  if (usersLoading || rolesLoading || permissionsLoading) {
    return (
      <AdminLayout title="User & Role Management" subtitle="Manage users, roles, and permissions">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="User & Role Management" subtitle="Manage users, roles, and permissions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User & Role Management</h1>
            <p className="text-muted-foreground">
              Manage users, roles, and permissions in a unified interface
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Roles & Permissions</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-medium">User Management</span>
                <Badge variant="secondary">{users.length} users</Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreateUser} data-testid="button-add-user">
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <UserPlus className="h-5 w-5" />
                        <span>{editingUser ? "Edit User" : "Add New User"}</span>
                      </DialogTitle>
                      <DialogDescription>
                        {editingUser ? "Update user details and permissions" : "Create a new user account with role assignment"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUserSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="username">Username *</Label>
                          <Input
                            id="username"
                            data-testid="input-username"
                            value={userFormData.username}
                            onChange={(e) => setUserFormData(prev => ({ ...prev, username: e.target.value }))}
                            placeholder="Enter username"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="name">Full Name *</Label>
                          <Input
                            id="name"
                            data-testid="input-name"
                            value={userFormData.name}
                            onChange={(e) => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter full name"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            data-testid="input-email"
                            type="email"
                            value={userFormData.email}
                            onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="Enter email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            data-testid="input-phone"
                            value={userFormData.phone}
                            onChange={(e) => setUserFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Enter phone"
                          />
                        </div>
                      </div>

                      {!editingUser && (
                        <div>
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            data-testid="input-password"
                            type="password"
                            value={userFormData.password}
                            onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter password"
                            required
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="role">Role *</Label>
                          <Select 
                            value={userFormData.roleId} 
                            onValueChange={(value) => setUserFormData(prev => ({ ...prev, roleId: value }))}
                          >
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="status">Status</Label>
                          <Select 
                            value={userFormData.status} 
                            onValueChange={(value) => setUserFormData(prev => ({ ...prev, status: value }))}
                          >
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createUserMutation.isPending || updateUserMutation.isPending}
                        data-testid="button-submit-user"
                      >
                        {createUserMutation.isPending || updateUserMutation.isPending ? 
                          "Saving..." : 
                          editingUser ? "Update User" : "Create User"
                        }
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Users Table */}
            <Card className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">User</TableHead>
                    <TableHead className="w-[180px]">Contact</TableHead>
                    <TableHead className="w-[120px]">Role</TableHead>
                    <TableHead className="w-[150px]">Permissions</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : usersError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-red-600">
                        Error loading users: {usersError.message}
                      </TableCell>
                    </TableRow>
                  ) : !users || users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    (Array.isArray(users) ? users : []).map((user) => {
                    const userPermissions = getUserPermissions(user);
                    return (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium" data-testid={`text-username-${user.id}`}>{user.username}</div>
                              <div className="text-sm text-muted-foreground">{user.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {user.email && <div>{user.email}</div>}
                            {user.phone && <div className="text-muted-foreground">{user.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.roles && user.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map((role: any) => (
                                <Badge key={role.id} variant="outline" data-testid={`badge-role-${user.id}`}>
                                  {role.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-role-${user.id}`}>
                              No Role
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setViewingPermissionsUser(user);
                                setIsViewPermissionsModalOpen(true);
                              }}
                              data-testid={`button-view-permissions-${user.id}`}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="ml-1">{userPermissions.total.length}</span>
                            </Button>
                            {userPermissions.manual.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                +{userPermissions.manual.length} manual
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.status === 'active' ? "default" : "secondary"}
                            data-testid={`status-${user.id}`}
                          >
                            {user.status === 'active' ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-${user.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditUser(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Key className="h-4 w-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Reset Password</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to reset this user's password? A new password will be generated and the user will need to be notified.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => resetPasswordMutation.mutate(user.id)}
                                      disabled={resetPasswordMutation.isPending}
                                    >
                                      {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <DropdownMenuItem onClick={() => openManagePermissions(user)}>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Manage Permissions
                              </DropdownMenuItem>
                              {/* Hide deactivate option for Super Admin */}
                              {!(user.roles?.some(role => role.name === 'Super Admin')) && (
                                <DropdownMenuItem 
                                  onClick={() => toggleUserStatusMutation.mutate({ id: user.id, isActive: user.status !== 'active' })}
                                >
                                  {user.status === 'active' ? (
                                    <>
                                      <EyeOff className="h-4 w-4 mr-2" />
                                      Deactivate User
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Activate User
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {/* Hide delete option for Super Admin and current user */}
                              {(currentUser as any)?.id !== user.id && !(user.roles?.some(role => role.name === 'Super Admin')) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this user? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteUserMutation.mutate(user.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-medium">Role & Permission Management</span>
                <Badge variant="secondary">{roles.length} roles</Badge>
              </div>
              
              <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateRole} data-testid="button-add-role">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5" />
                      <span>{editingRole ? "Edit Role" : "Create New Role"}</span>
                    </DialogTitle>
                    <DialogDescription>
                      {editingRole ? "Update role details and permissions" : "Create a new role with specific permissions"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRoleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="roleName">Role Name *</Label>
                        <Input
                          id="roleName"
                          data-testid="input-role-name"
                          value={roleFormData.name}
                          onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter role name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="roleDescription">Description</Label>
                        <Input
                          id="roleDescription"
                          data-testid="input-role-description"
                          value={roleFormData.description}
                          onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter description"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Label className="text-base font-medium">Permissions</Label>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {Object.entries(getPermissionsByCategory()).map(([category, categoryPermissions]) => (
                        <Card key={category} className="p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <h4 className="font-medium text-sm">{category.toUpperCase()}</h4>
                            <Badge variant="outline" className="text-xs">
                              {categoryPermissions.filter(p => roleFormData.permissions.includes(p.name)).length}/{categoryPermissions.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {categoryPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={permission.id}
                                  checked={roleFormData.permissions.includes(permission.name)}
                                  onCheckedChange={() => togglePermission(permission.name)}
                                  data-testid={`checkbox-permission-${permission.name}`}
                                />
                                <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                                  {formatPermissionName(permission.name)}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                      data-testid="button-submit-role"
                    >
                      {createRoleMutation.isPending || updateRoleMutation.isPending ? 
                        "Saving..." : 
                        editingRole ? "Update Role" : "Create Role"
                      }
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Roles Table */}
            <div className="grid gap-4">
              {roles.map((role) => (
                <Card key={role.id} data-testid={`card-role-${role.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-role-name-${role.id}`}>
                            {role.name}
                          </CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {role.permissions.length} permissions
                        </Badge>
                        <Badge variant="secondary">
                          {users.filter(u => u.roles?.some(userRole => userRole.id === role.id)).length} users
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-role-actions-${role.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditRole(role)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRoleAssignments(role)}>
                              <Users className="h-4 w-4 mr-2" />
                              Manage Users
                            </DropdownMenuItem>
                            {/* Hide delete option if role is assigned to users */}
                            {users.filter(u => u.roles?.some(userRole => userRole.id === role.id)).length === 0 && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Role
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this role? Users with this role will need to be reassigned.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteRoleMutation.mutate(role.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 8).map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {formatPermissionName(permission)}
                        </Badge>
                      ))}
                      {role.permissions.length > 8 && (
                        <Badge variant="secondary" className="text-xs">
                          +{role.permissions.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Manage User Permissions Modal */}
      <Dialog open={isPermissionsModalOpen} onOpenChange={setIsPermissionsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>Manage Permissions for {managingPermissionsUser?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Manage individual permissions for this user. These permissions will be added to or removed from their role-based permissions.
            </DialogDescription>
          </DialogHeader>
          
          {managingPermissionsUser && (
            <div className="space-y-6">
              {/* Current Role Information */}
              <Card className="p-4">
                <h4 className="font-medium mb-2">Current Role & Permissions</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{managingPermissionsUser.roles?.[0]?.name || 'No Role'}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Base Role: {managingPermissionsUser.roles?.[0]?.permissions?.length || 0} permissions
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-green-600">+{managingPermissionsUser.manualPermissions?.added?.length || 0} added</span>
                    <span className="mx-2">|</span>
                    <span className="text-red-600">-{managingPermissionsUser.manualPermissions?.removed?.length || 0} removed</span>
                  </div>
                </div>
              </Card>

              {/* Permission Categories */}
              <div className="space-y-4">
                <h4 className="font-medium">Available Permissions</h4>
                {Object.entries(getPermissionsByCategory()).map(([category, categoryPermissions]) => (
                  <Card key={category} className="p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <h5 className="font-medium text-sm">{category.toUpperCase()}</h5>
                      <Badge variant="outline" className="text-xs">
                        {categoryPermissions.filter(p => {
                          const userPermissions = getUserPermissions(managingPermissionsUser);
                          return userPermissions.total.includes(p.name);
                        }).length}/{categoryPermissions.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {categoryPermissions.map((permission) => {
                        const userPermissions = getUserPermissions(managingPermissionsUser);
                        const hasPermission = userPermissions.total.includes(permission.name);
                        const isFromRole = managingPermissionsUser.roles?.[0]?.permissions?.includes(permission.name) || false;
                        const isManuallyAdded = managingPermissionsUser.manualPermissions?.added?.includes(permission.name) || false;
                        const isManuallyRemoved = managingPermissionsUser.manualPermissions?.removed?.includes(permission.name) || false;
                        
                        return (
                          <div key={permission.name} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{formatPermissionName(permission.name)}</span>
                                {isFromRole && <Badge variant="outline" className="text-xs">Role</Badge>}
                                {isManuallyAdded && <Badge variant="default" className="text-xs bg-green-100 text-green-800">+Added</Badge>}
                                {isManuallyRemoved && <Badge variant="default" className="text-xs bg-red-100 text-red-800">-Removed</Badge>}
                                {(() => {
                                  const hasLocalChange = localPermissionChanges.has(permission.id);
                                  const localState = localPermissionChanges.get(permission.id);
                                  if (hasLocalChange && localState !== hasPermission) {
                                    return (
                                      <Badge variant="outline" className="text-xs text-amber-600">
                                        {localState ? 'Adding' : 'Removing'}
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch 
                                checked={(() => {
                                  // If we have a local change, use that, otherwise use the original state
                                  if (localPermissionChanges.has(permission.id)) {
                                    return localPermissionChanges.get(permission.id)!;
                                  }
                                  return hasPermission;
                                })()}
                                onCheckedChange={(checked) => {
                                  handlePermissionToggle(managingPermissionsUser.id, permission.id, permission.name, checked);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600">
                  {localPermissionChanges.size} unsaved changes
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant={hasUnsavedChanges ? "default" : "outline"}
                onClick={hasUnsavedChanges ? () => setShowConfirmDialog(true) : () => {
                  setIsPermissionsModalOpen(false);
                  handleDiscardPermissionChanges();
                }}
                disabled={addPermissionOverrideMutation.isPending || removePermissionOverrideMutation.isPending}
              >
                {(addPermissionOverrideMutation.isPending || removePermissionOverrideMutation.isPending) 
                  ? 'Saving...' 
                  : hasUnsavedChanges 
                    ? 'Save Changes' 
                    : 'Close'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permission Changes</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const { adding, removing } = getChangesSummary();
                return (
                  <div className="space-y-2">
                    <div>You are about to change permissions for <strong>{managingPermissionsUser?.name}</strong>:</div>
                    {adding > 0 && <div className="text-blue-600">Adding {adding} permissions</div>}
                    {removing > 0 && <div className="text-red-600">Removing {removing} permissions</div>}
                    <div className="text-sm text-muted-foreground mt-2">
                      These changes will take effect immediately and may affect the user's access to system features.
                    </div>
                  </div>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                handleSavePermissionChanges();
              }}
              disabled={addPermissionOverrideMutation.isPending || removePermissionOverrideMutation.isPending}
            >
              {(addPermissionOverrideMutation.isPending || removePermissionOverrideMutation.isPending) ? 'Applying...' : 'Apply Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View User Permissions Modal */}
      <Dialog open={isViewPermissionsModalOpen} onOpenChange={setIsViewPermissionsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Permissions - {viewingPermissionsUser?.name || 'Unknown User'}
            </DialogTitle>
            <DialogDescription>
              View all permissions for this user. Permissions are inherited from roles and can be manually added.
            </DialogDescription>
          </DialogHeader>
          
          {viewingPermissionsUser && (
            <div className="space-y-6">
              {(() => {
                const userPermissions = getUserPermissions(viewingPermissionsUser);
                return (
                  <>
                    {/* Inherited from Roles */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Inherited from Roles ({userPermissions.inherited.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {userPermissions.inherited.map(permission => (
                          <Badge key={permission} variant="outline" className="text-sm px-3 py-1">
                            {formatPermissionName(permission)}
                          </Badge>
                        ))}
                        {userPermissions.inherited.length === 0 && (
                          <p className="text-muted-foreground text-sm">No permissions inherited from roles.</p>
                        )}
                      </div>
                    </div>

                    {/* Manual Permissions */}
                    {userPermissions.manual.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">
                          Manual Permissions ({userPermissions.manual.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {userPermissions.manual.map(permission => (
                            <Badge key={permission} variant="default" className="text-sm px-3 py-1">
                              {formatPermissionName(permission)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Total Summary */}
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        <strong>Total Permissions: {userPermissions.total.length}</strong>
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsViewPermissionsModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={isRoleAssignmentModalOpen} onOpenChange={setIsRoleAssignmentModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Users - Role: {managingRoleAssignments?.name}
            </DialogTitle>
            <DialogDescription>
              All users in the system - check/uncheck to assign/remove from this role
            </DialogDescription>
          </DialogHeader>
          
          {managingRoleAssignments && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isAssigned = isUserAssignedToRole(user, managingRoleAssignments.id);
                    const currentRole = user.roles?.[0]?.name || 'No Role';
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={isAssigned}
                            onCheckedChange={() => handleRoleAssignmentToggle(user, managingRoleAssignments, isAssigned)}
                            data-testid={`checkbox-assign-role-${user.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.username || '-'}</TableCell>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={currentRole === managingRoleAssignments.name ? "default" : "secondary"}>
                            {currentRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "destructive"}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsRoleAssignmentModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}