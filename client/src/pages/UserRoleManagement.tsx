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
import { usePermissions } from "@/hooks/usePermissions";
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
  Download,
  Upload,
  RefreshCw,
  UserCheck,
  UserX
} from "lucide-react";

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  mobile?: string;
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
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("users");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [managingPermissionsUser, setManagingPermissionsUser] = useState<User | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<any>(null);
  
  // Password reset dialog state
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [isLoadingCurrentPassword, setIsLoadingCurrentPassword] = useState(false);
  
  // Role users management dialog state
  const [manageUsersDialogOpen, setManageUsersDialogOpen] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null);
  
  // Local state for pending permission changes (before saving)
  const [pendingPermissionChanges, setPendingPermissionChanges] = useState<{
    toAdd: string[]; // permission IDs to add
    toRemove: string[]; // permission IDs to remove
  }>({ toAdd: [], toRemove: [] });

  // User form data
  const [userFormData, setUserFormData] = useState({
    username: "",
    name: "",
    email: "",
    mobile: "",
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
    mutationFn: (userData: typeof userFormData) => 
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
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof userFormData> }) => 
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
    onSuccess: (data: { currentPassword: string | null; newPassword: string }) => {
      // Update the current password display with the new password
      setCurrentPassword(data.newPassword);
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiRequest(`/api/unified/users/${userId}/toggle-status`, "PATCH", { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
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

  // Batch save mutation for all permission changes
  const savePermissionChangesMutation = useMutation({
    mutationFn: async ({ userId, changes }: { userId: string; changes: typeof pendingPermissionChanges }) => {
      const promises = [];
      
      // Add permissions
      for (const permissionId of changes.toAdd) {
        promises.push(
          apiRequest(`/api/unified/users/${userId}/permission-overrides`, "POST", { permissionId })
        );
      }
      
      // Remove permissions
      for (const permissionId of changes.toRemove) {
        promises.push(
          apiRequest(`/api/unified/users/${userId}/permission-overrides/${permissionId}`, "DELETE")
        );
      }
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      setPendingPermissionChanges({ toAdd: [], toRemove: [] }); // Reset pending changes
      setIsPermissionsModalOpen(false);
      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update permissions",
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
      mobile: "",
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

  const openEditUser = (user: User) => {
    setEditingUser(user);
    
    // Get the first assigned role for editing (in case user has multiple roles)
    const userRole = user.roles && user.roles.length > 0 ? user.roles[0] : null;
    
    setUserFormData({
      username: user.username,
      name: user.name,
      email: user.email || "",
      mobile: user.mobile || "",
      password: "",
      roleId: userRole?.id || "", // Use the actual role ID for proper Select mapping
      status: user.status
    });
    setIsUserModalOpen(true);
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
    setPendingPermissionChanges({ toAdd: [], toRemove: [] }); // Reset pending changes
    setIsPermissionsModalOpen(true);
  };

  const openManageRoleUsers = (role: Role) => {
    setSelectedRoleForUsers(role);
    setManageUsersDialogOpen(true);
  };

  const openResetPasswordDialog = async (user: User) => {
    setResetPasswordUser(user);
    setCurrentPassword(null);
    setIsLoadingCurrentPassword(true);
    setResetPasswordDialogOpen(true);
    
    try {
      // Fetch current password without resetting
      const response = await apiRequest(`/api/unified/users/${user.id}/current-password`, "GET");
      const data = await response.json();
      setCurrentPassword(data.currentPassword || "Unable to decrypt current password");
    } catch (error) {
      setCurrentPassword("Error loading current password");
    } finally {
      setIsLoadingCurrentPassword(false);
    }
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: userFormData });
    } else {
      createUserMutation.mutate(userFormData);
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

  // Helper function to get effective permission state including pending changes
  const getEffectivePermissionState = (permission: Permission) => {
    if (!managingPermissionsUser) return false;
    
    const userPermissions = getUserPermissions(managingPermissionsUser);
    const currentlyHasPermission = userPermissions.total.includes(permission.name);
    
    // Check if this permission is in pending changes
    const isPendingAdd = pendingPermissionChanges.toAdd.includes(permission.id);
    const isPendingRemove = pendingPermissionChanges.toRemove.includes(permission.id);
    
    // Calculate effective state
    if (isPendingAdd) return true;
    if (isPendingRemove) return false;
    return currentlyHasPermission;
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
    
    return {
      inherited: uniqueRolePermissions.filter(p => !manualRemoved.includes(p)),
      manual: manualAdded.filter(p => !uniqueRolePermissions.includes(p)),
      total: [...uniqueRolePermissions.filter(p => !manualRemoved.includes(p)), ...manualAdded]
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
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-user">
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
                          <Label htmlFor="mobile">Mobile Number</Label>
                          <Input
                            id="mobile"
                            data-testid="input-mobile"
                            value={userFormData.mobile}
                            onChange={(e) => setUserFormData(prev => ({ ...prev, mobile: e.target.value }))}
                            placeholder="Enter mobile number"
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
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
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
                            {user.mobile && <div className="text-muted-foreground">{user.mobile}</div>}
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
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUserPermissions({
                                  user: user,
                                  permissions: userPermissions
                                });
                                setPermissionsDialogOpen(true);
                              }}
                              data-testid={`button-show-permissions-${user.id}`}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="ml-1">{userPermissions.total.length}</span>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.isActive ? "default" : "secondary"}
                            data-testid={`status-${user.id}`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
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
                                    <AlertDialogTitle>Reset User Password</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to reset the password for <strong>{user.name}</strong>? 
                                      A new random password will be generated and the current password will be lost.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => openResetPasswordDialog(user)}
                                      className="bg-orange-600 text-white hover:bg-orange-700"
                                    >
                                      Reset Password
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <DropdownMenuItem onClick={() => openManagePermissions(user)}>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Manage Permissions
                              </DropdownMenuItem>
                              {hasPermission('user.status.change') && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} data-testid={`button-toggle-status-${user.id}`}>
                                      {user.isActive ? (
                                        <>
                                          <UserX className="h-4 w-4 mr-2" />
                                          Deactivate User
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-4 w-4 mr-2" />
                                          Activate User
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {user.isActive ? "Deactivate User" : "Activate User"}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {user.isActive 
                                          ? `Are you sure you want to deactivate ${user.name}? 
                                          
⚠️ WARNING: This action will:
• Immediately revoke all system access
• Prevent login to admin panel and customer portal
• Block all document creation and management
• Disable any automated processes for this user
• User will receive no notification of deactivation

This change takes effect immediately but can be reversed by reactivating the user.`
                                          : `Are you sure you want to activate ${user.name}? They will regain access to the system.`
                                        }
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => toggleUserStatusMutation.mutate({ 
                                          userId: user.id, 
                                          isActive: !user.isActive 
                                        })}
                                        className={user.isActive ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-green-600 text-white hover:bg-green-700"}
                                      >
                                        {user.isActive ? "Deactivate" : "Activate"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {(currentUser as any)?.id !== user.id && (
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
                  <Button data-testid="button-add-role">
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
                            <DropdownMenuItem onClick={() => openManageRoleUsers(role)}>
                              <Users className="h-4 w-4 mr-2" />
                              Manage Users ({role.userCount || 0})
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Reset Permissions
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reset Role Permissions</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to reset all permissions for the role "{role.name}"? 
                                    This will remove all permissions and set the role to have no access rights.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-orange-600 text-white hover:bg-orange-700"
                                    onClick={() => {
                                      setRoleFormData(prev => ({ ...prev, permissions: [] }));
                                      updateRoleMutation.mutate({ id: role.id, data: { ...role, permissions: [] } });
                                    }}
                                  >
                                    Reset Permissions
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
                        const currentlyHasPermission = userPermissions.total.includes(permission.name);
                        const effectiveState = getEffectivePermissionState(permission);
                        const isFromRole = managingPermissionsUser.roles?.[0]?.permissions?.includes(permission.name) || false;
                        const isManuallyAdded = managingPermissionsUser.manualPermissions?.added?.includes(permission.name) || false;
                        const isManuallyRemoved = managingPermissionsUser.manualPermissions?.removed?.includes(permission.name) || false;
                        
                        // Check if there are pending changes for this permission
                        const isPendingAdd = pendingPermissionChanges.toAdd.includes(permission.id);
                        const isPendingRemove = pendingPermissionChanges.toRemove.includes(permission.id);
                        const hasPendingChanges = isPendingAdd || isPendingRemove;
                        
                        return (
                          <div key={permission.name} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{formatPermissionName(permission.name)}</span>
                                {(() => {
                                  // Smart badge logic: if both added and removed, they cancel out
                                  if (isManuallyAdded && isManuallyRemoved) {
                                    // Both actions cancel out - show original state
                                    if (isFromRole) {
                                      // Originally from role, removed, then added back = Role
                                      return <Badge variant="outline" className="text-xs">Role</Badge>;
                                    } else {
                                      // Originally not from role, added, then removed = nothing (back to original state)
                                      return null;
                                    }
                                  }
                                  
                                  // Show individual states
                                  const badges = [];
                                  if (isFromRole && !isManuallyRemoved) {
                                    badges.push(<Badge key="role" variant="outline" className="text-xs">Role</Badge>);
                                  }
                                  if (isManuallyAdded && !isManuallyRemoved) {
                                    badges.push(<Badge key="added" variant="default" className="text-xs bg-green-100 text-green-800">+Added</Badge>);
                                  }
                                  if (isManuallyRemoved && !isManuallyAdded) {
                                    badges.push(<Badge key="removed" variant="default" className="text-xs bg-red-100 text-red-800">-Removed</Badge>);
                                  }
                                  
                                  return badges;
                                })()}
                                {isPendingAdd && <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">Pending +</Badge>}
                                {isPendingRemove && <Badge variant="default" className="text-xs bg-orange-100 text-orange-800">Pending -</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch 
                                checked={effectiveState}
                                disabled={permissionsLoading || savePermissionChangesMutation.isPending}
                                onCheckedChange={(checked) => {
                                  setPendingPermissionChanges(prev => {
                                    const newChanges = { ...prev };
                                    
                                    if (checked) {
                                      // User wants to enable this permission
                                      // Remove from toRemove if it's there
                                      newChanges.toRemove = newChanges.toRemove.filter(id => id !== permission.id);
                                      // Add to toAdd if not currently having permission
                                      if (!currentlyHasPermission && !newChanges.toAdd.includes(permission.id)) {
                                        newChanges.toAdd.push(permission.id);
                                      }
                                    } else {
                                      // User wants to disable this permission
                                      // Remove from toAdd if it's there
                                      newChanges.toAdd = newChanges.toAdd.filter(id => id !== permission.id);
                                      // Add to toRemove if currently having permission
                                      if (currentlyHasPermission && !newChanges.toRemove.includes(permission.id)) {
                                        newChanges.toRemove.push(permission.id);
                                      }
                                    }
                                    
                                    return newChanges;
                                  });
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
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsPermissionsModalOpen(false)}>
              Cancel
            </Button>
            {(pendingPermissionChanges.toAdd.length > 0 || pendingPermissionChanges.toRemove.length > 0) ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={savePermissionChangesMutation.isPending}>
                    {savePermissionChangesMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Permission Changes</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to change permissions for <strong>{managingPermissionsUser?.name}</strong>:
                      {pendingPermissionChanges.toAdd.length > 0 && (
                        <div className="mt-2">
                          <span className="text-green-600">Adding {pendingPermissionChanges.toAdd.length} permissions</span>
                        </div>
                      )}
                      {pendingPermissionChanges.toRemove.length > 0 && (
                        <div className="mt-1">
                          <span className="text-red-600">Removing {pendingPermissionChanges.toRemove.length} permissions</span>
                        </div>
                      )}
                      <div className="mt-2 text-sm text-gray-600">
                        These changes will take effect immediately and may affect the user's access to system features.
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (managingPermissionsUser) {
                          savePermissionChangesMutation.mutate({
                            userId: managingPermissionsUser.id,
                            changes: pendingPermissionChanges
                          });
                        }
                      }}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Apply Changes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button onClick={() => setIsPermissionsModalOpen(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Popup Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Permissions - {selectedUserPermissions?.user?.name}</DialogTitle>
            <DialogDescription>
              View all permissions for this user. Permissions are inherited from roles and can be manually added.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUserPermissions && (
            <div className="space-y-4">
              {/* Inherited Permissions */}
              <div>
                <h4 className="font-medium mb-2">Inherited from Roles ({selectedUserPermissions.permissions.inherited.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedUserPermissions.permissions.inherited.map((permission: string) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {formatPermissionName(permission)}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Manual Permissions */}
              {selectedUserPermissions.permissions.manual.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Manually Added ({selectedUserPermissions.permissions.manual.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUserPermissions.permissions.manual.map((permission: string) => (
                      <Badge key={permission} variant="default" className="text-xs bg-green-100 text-green-800">
                        {formatPermissionName(permission)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Total Summary */}
              <div className="border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  Total Permissions: {selectedUserPermissions.permissions.total.length}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button onClick={() => setPermissionsDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Current password for user: {resetPasswordUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type="text"
                  value={currentPassword || ""}
                  readOnly
                  className="bg-gray-50"
                  placeholder={isLoadingCurrentPassword ? "Loading..." : "No password available"}
                />
                {isLoadingCurrentPassword && (
                  <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (resetPasswordUser) {
                  resetPasswordMutation.mutate(resetPasswordUser.id);
                }
              }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Users for Role Dialog */}
      <Dialog open={manageUsersDialogOpen} onOpenChange={setManageUsersDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Users - Role: {selectedRoleForUsers?.name}</DialogTitle>
            <DialogDescription>
              Users assigned to the {selectedRoleForUsers?.name} role ({selectedRoleForUsers?.userCount || 0} total)
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoleForUsers && (
            <div className="space-y-4">
              {/* Users Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users
                      .filter(user => user.roleId === selectedRoleForUsers.id)
                      .map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={user.isActive ? "default" : "secondary"}
                              className={user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditUser(user)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openManagePermissions(user)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Manage Permissions
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                
                {usersData?.users.filter(user => user.roleId === selectedRoleForUsers.id).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No users assigned to this role
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button onClick={() => setManageUsersDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}