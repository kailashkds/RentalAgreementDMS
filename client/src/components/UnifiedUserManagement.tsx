import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PermissionGuard } from "./PermissionGuard";
import { formatDateToDDMMYYYY } from "@/lib/dateUtils";
import {
  User,
  Shield,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
  UserPlus,
  Users,
  Settings
} from "lucide-react";

interface UnifiedUser {
  id: string;
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  roles: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface Permission {
  id: string;
  code: string;
  description: string;
}

interface PermissionWithSource {
  code: string;
  source: 'role' | 'override';
  roleName?: string;
  isGranted?: boolean;
  isPending?: boolean;
}

interface GroupedPermission {
  category: string;
  permissions: (Permission & {
    userPermission?: PermissionWithSource;
    hasPermission: boolean;
    isFromRole: boolean;
    isOverride: boolean;
    isPending?: boolean;
  })[];
}

interface CreateUserData {
  name: string;
  email: string;
  username?: string;
  phone?: string;
  roleId: string;
  password?: string;
}

export function UnifiedUserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UnifiedUser | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [passwordResult, setPasswordResult] = useState<string>("");
  const [localPermissionChanges, setLocalPermissionChanges] = useState<Map<string, boolean>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    name: "",
    email: "",
    username: "",
    phone: "",
    roleId: "",
    password: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for all permissions (for permission override management)
  const { data: allPermissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/unified/permissions"],
    enabled: showPermissionsDialog && !!selectedUser,
  });

  // Query for user permissions with sources
  const { data: userPermissionsWithSources = [] } = useQuery<PermissionWithSource[]>({
    queryKey: [`/api/unified/users/${selectedUser?.id}/permissions-with-sources`],
    enabled: showPermissionsDialog && !!selectedUser,
  });

  // Users query
  const { data: usersData } = useQuery({
    queryKey: ["/api/unified/users"],
  });

  const users = (usersData as any)?.users || [];

  // Roles query
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/unified/roles"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await apiRequest("/api/unified/users", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setShowCreateDialog(false);
      setCreateUserData({
        name: "",
        email: "",
        username: "",
        phone: "",
        roleId: "",
        password: "",
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

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: CreateUserData }) => {
      const response = await apiRequest(`/api/unified/users/${id}`, "PUT", userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/unified/users/${id}`, "DELETE");
      return response.json();
    },
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

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest(`/api/unified/users/${userId}/reset-password`, "POST");
      return response.json();
    },
    onSuccess: (data) => {
      setPasswordResult(data.password);
      setShowPasswordDialog(true);
      toast({
        title: "Password Reset",
        description: "New password generated successfully",
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

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
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

  // Batch permission changes mutation - Production workflow
  const saveBatchPermissionsMutation = useMutation({
    mutationFn: async ({ userId, changes }: { userId: string; changes: Array<{ permissionId: string; action: 'add' | 'remove' }> }) => {
      // Process all permission changes as batch operations
      const results = await Promise.all(
        changes.map(async ({ permissionId, action }) => {
          if (action === 'add') {
            return await apiRequest(`/api/unified/users/${userId}/permission-overrides`, 'POST', { permissionId });
          } else {
            return await apiRequest(`/api/unified/users/${userId}/permission-overrides/${permissionId}`, 'DELETE');
          }
        })
      );
      return results;
    },
    onSuccess: async (data, { userId }) => {
      // Invalidate both user permissions and users list queries to refresh the data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/unified/users/${userId}/permissions-with-sources`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] })
      ]);
      
      // DO NOT clear local state here - keep the toggles in their updated state
      // Local state will be cleared when the dialog is closed
      setShowConfirmDialog(false);
      
      // Show success message
      toast({
        title: "Permissions Updated",
        description: "Permission changes applied successfully",
      });
      
      // Auto-close the permissions dialog after showing notification
      setTimeout(() => {
        setShowPermissionsDialog(false);
        // Clear local state only when dialog actually closes
        setLocalPermissionChanges(new Map());
        setHasUnsavedChanges(false);
      }, 1500); // Close after 1.5 seconds to let user see the notification
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply permission changes",
        variant: "destructive",
      });
      setShowConfirmDialog(false);
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserData.name || !createUserData.roleId) {
      toast({
        title: "Validation Error",
        description: "Name and role are required",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(createUserData);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    updateUserMutation.mutate({
      id: selectedUser.id,
      userData: createUserData,
    });
  };

  const getRoleNames = (roles: UnifiedUser['roles']) => {
    return roles.map(role => role.name).join(", ") || "No Role";
  };

  const getStatusBadge = (isActive: boolean, status: string) => {
    if (!isActive || status === 'inactive') {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const openEditDialog = (user: UnifiedUser) => {
    setSelectedUser(user);
    setCreateUserData({
      name: user.name,
      email: user.email || "",
      username: user.username || "",
      phone: user.phone || "",
      roleId: user.roles[0]?.id || "",
      password: "",
    });
    setShowEditDialog(true);
  };

  const openPermissionsDialog = (user: UnifiedUser) => {
    setSelectedUser(user);
    setShowPermissionsDialog(true);
    // Reset local state when opening dialog
    setLocalPermissionChanges(new Map());
    setHasUnsavedChanges(false);
    // Force refresh user data when opening dialog
    queryClient.invalidateQueries({ queryKey: ["/api/unified/users"] });
    queryClient.invalidateQueries({ queryKey: [`/api/unified/users/${user.id}/permissions-with-sources`] });
  };

  const getCurrentPermissionState = (permissionId: string): boolean => {
    const permission = allPermissions.find(p => p.id === permissionId);
    if (!permission) return false;
    const userPermission = userPermissionsWithSources.find(p => p.code === permission.code);
    return !!userPermission;
  };

  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    const currentState = getCurrentPermissionState(permissionId);
    
    // Update local changes
    const newChanges = new Map(localPermissionChanges);
    if (checked === currentState) {
      newChanges.delete(permissionId);
    } else {
      newChanges.set(permissionId, checked);
    }
    
    setLocalPermissionChanges(newChanges);
    setHasUnsavedChanges(newChanges.size > 0);
  };

  const getChangesSummary = (): { adding: number; removing: number } => {
    let adding = 0;
    let removing = 0;
    
    localPermissionChanges.forEach((newState, permissionId) => {
      const currentState = getCurrentPermissionState(permissionId);
      if (newState && !currentState) adding++;
      if (!newState && currentState) removing++;
    });
    
    return { adding, removing };
  };

  const handleSaveChanges = () => {
    if (!selectedUser || localPermissionChanges.size === 0) return;
    
    const changes: Array<{ permissionId: string; action: 'add' | 'remove' }> = [];
    
    localPermissionChanges.forEach((newState, permissionId) => {
      const currentPermission = userPermissionsWithSources.find(p => p.code === allPermissions.find(ap => ap.id === permissionId)?.code);
      const currentHasPermission = !!currentPermission;
      
      if (newState && !currentHasPermission) {
        changes.push({ permissionId, action: 'add' });
      } else if (!newState && currentHasPermission && currentPermission?.source === 'override') {
        changes.push({ permissionId, action: 'remove' });
      }
    });
    
    if (changes.length > 0) {
      saveBatchPermissionsMutation.mutate({
        userId: selectedUser.id,
        changes
      });
    }
  };

  const handleCloseOrSave = () => {
    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      setShowPermissionsDialog(false);
      setLocalPermissionChanges(new Map());
    }
  };

  // Filter users based on search term, role, and status
  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        (user: any) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user: any) =>
        user.roles.some((role: any) => role.id === roleFilter)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((user: any) => {
        if (statusFilter === "active") {
          return user.isActive && user.status !== "inactive";
        } else if (statusFilter === "inactive") {
          return !user.isActive || user.status === "inactive";
        }
        return true;
      });
    }

    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">
              Manage all users with unified role-based access control
            </p>
          </div>
        </div>

        <PermissionGuard permission="user.create">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user with assigned role and permissions.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={createUserData.name}
                    onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                    placeholder="Full name"
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={createUserData.username}
                    onChange={(e) => setCreateUserData({ ...createUserData, username: e.target.value })}
                    placeholder="Username (auto-generated if empty)"
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={createUserData.phone}
                    onChange={(e) => setCreateUserData({ ...createUserData, phone: e.target.value })}
                    placeholder="Phone number"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={createUserData.roleId} onValueChange={(value) => setCreateUserData({ ...createUserData, roleId: value })}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id} data-testid={`option-role-${role.name.toLowerCase()}`}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={createUserData.password}
                    onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                    placeholder="Password (auto-generated if empty)"
                    data-testid="input-password"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    data-testid="button-create-user"
                  >
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGuard>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {(usersData as any)?.total || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active-users">
              {users.filter((user: any) => user.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-inactive-users">
              {users.filter((user: any) => !user.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-roles">
              {roles.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter users by name, email, role, or status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-testid="select-role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all-roles">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id} data-testid={`option-filter-role-${role.name.toLowerCase()}`}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all-status">All Status</SelectItem>
                  <SelectItem value="active" data-testid="option-active-status">Active</SelectItem>
                  <SelectItem value="inactive" data-testid="option-inactive-status">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Comprehensive list of all users with their roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: any) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium" data-testid={`user-name-${user.id}`}>
                              {user.name}
                            </div>
                            {user.username && (
                              <div className="text-sm text-muted-foreground" data-testid={`user-username-${user.id}`}>
                                @{user.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.email && (
                            <div className="text-sm" data-testid={`user-email-${user.id}`}>{user.email}</div>
                          )}
                          {user.phone && (
                            <div className="text-sm text-muted-foreground" data-testid={`user-phone-${user.id}`}>{user.phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.roles.map((role: any) => (
                            <Badge key={role.id} variant="secondary" data-testid={`user-role-${user.id}-${role.name.toLowerCase()}`}>
                              {role.name}
                            </Badge>
                          ))}
                          {user.roles.length === 0 && (
                            <Badge variant="outline">No Role</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div data-testid={`user-status-${user.id}`}>
                          {getStatusBadge(user.isActive, user.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm" data-testid={`user-created-${user.id}`}>
                          {formatDateToDDMMYYYY(user.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`user-actions-${user.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermissionGuard permission="user.edit.all">
                              <DropdownMenuItem onClick={() => openEditDialog(user)} data-testid={`action-edit-${user.id}`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                            </PermissionGuard>
                            
                            <PermissionGuard permission="user.manage">
                              <DropdownMenuItem onClick={() => openPermissionsDialog(user)} data-testid={`action-permissions-${user.id}`}>
                                <Settings className="h-4 w-4 mr-2" />
                                Manage Permissions
                              </DropdownMenuItem>
                            </PermissionGuard>

                            <PermissionGuard permission="user.edit.all">
                              <DropdownMenuItem
                                onClick={() => resetPasswordMutation.mutate(user.id)}
                                disabled={resetPasswordMutation.isPending}
                                data-testid={`action-reset-password-${user.id}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                            </PermissionGuard>

                            <PermissionGuard permission="user.edit.all">
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleStatusMutation.mutate({
                                    id: user.id,
                                    isActive: !user.isActive,
                                  })
                                }
                                disabled={toggleStatusMutation.isPending}
                                data-testid={`action-toggle-status-${user.id}`}
                              >
                                {user.isActive ? (
                                  <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                            </PermissionGuard>

                            <PermissionGuard permission="user.delete.all">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    data-testid={`action-delete-${user.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {user.name}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUserMutation.mutate(user.id)}
                                      disabled={deleteUserMutation.isPending}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </PermissionGuard>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role assignments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={createUserData.name}
                onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                placeholder="Full name"
                required
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={createUserData.email}
                onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                placeholder="email@example.com"
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={createUserData.username}
                onChange={(e) => setCreateUserData({ ...createUserData, username: e.target.value })}
                placeholder="Username"
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={createUserData.phone}
                onChange={(e) => setCreateUserData({ ...createUserData, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={createUserData.roleId} onValueChange={(value) => setCreateUserData({ ...createUserData, roleId: value })}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id} data-testid={`option-edit-role-${role.name.toLowerCase()}`}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Result Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Password Generated</DialogTitle>
            <DialogDescription>
              The new password has been generated. Please share it securely with the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <Label className="text-sm font-medium">New Password:</Label>
              <div className="mt-1 font-mono text-lg" data-testid="generated-password">
                {passwordResult}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Make sure to copy this password before closing this dialog. It will not be shown again.
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(passwordResult);
                toast({
                  title: "Copied",
                  description: "Password copied to clipboard",
                });
              }}
              variant="outline"
              data-testid="button-copy-password"
            >
              Copy Password
            </Button>
            <Button onClick={() => setShowPasswordDialog(false)} data-testid="button-close-password-dialog">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Management Dialog - Production Version */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage Permissions for {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Manage individual permissions for this user. These permissions will be added to or removed from their role-based permissions.
            </DialogDescription>
          </DialogHeader>
          
          {/* Current Role & Permissions Summary */}
          {selectedUser && selectedUser.roles.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="font-medium text-sm">Current Role & Permissions</div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedUser.roles[0]?.name}</Badge>
                  <span className="text-muted-foreground">
                    Base Role: {userPermissionsWithSources.filter(p => p.source === 'role').length} permissions
                  </span>
                </div>
                <div className="text-muted-foreground">
                  <span className="text-blue-600">+{userPermissionsWithSources.filter(p => p.source === 'override').length} added</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Available Permissions */}
          <div className="space-y-4 overflow-y-auto max-h-96">
            <div className="font-medium">Available Permissions</div>
            
            {(() => {
              // Group permissions by category
              const grouped = allPermissions.reduce((acc, permission) => {
                const category = permission.code.split('.')[0].toUpperCase();
                const userPermission = userPermissionsWithSources.find(up => up.code === permission.code);
                const hasPermission = !!userPermission;
                const isFromRole = userPermission?.source === 'role';
                const isOverride = userPermission?.source === 'override';
                
                if (!acc[category]) {
                  acc[category] = [];
                }
                acc[category].push({
                  ...permission,
                  userPermission,
                  hasPermission,
                  isFromRole,
                  isOverride
                });
                return acc;
              }, {} as Record<string, any[]>);
              
              return Object.entries(grouped).map(([category, permissions]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-muted-foreground">{category}</div>
                    <div className="text-xs text-muted-foreground">{permissions.filter(p => p.hasPermission).length}/{permissions.length}</div>
                  </div>
                  
                  <div className="space-y-2">
                    {permissions.map((permission) => {
                      const permissionId = permission.code.replace(/\./g, '-');
                      
                      return (
                        <div 
                          key={permission.id} 
                          className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md"
                          data-testid={`permission-item-${permissionId}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm truncate">{permission.description.replace(' permission', '')}</div>
                              {permission.isFromRole && (
                                <Badge variant="secondary" className="text-xs">Role</Badge>
                              )}
                              {(() => {
                                const hasLocalChange = localPermissionChanges.has(permission.id);
                                const localState = localPermissionChanges.get(permission.id);
                                const currentState = permission.hasPermission;
                                
                                if (hasLocalChange && localState !== currentState) {
                                  return (
                                    <Badge variant="outline" className="text-xs text-amber-600">
                                      {localState ? 'Adding' : 'Removing'}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{permission.description}</div>
                          </div>
                          
                          <div className="flex items-center ml-4">
                            <Switch
                              checked={localPermissionChanges.has(permission.id) 
                                ? localPermissionChanges.get(permission.id)! 
                                : permission.hasPermission}
                              onCheckedChange={(checked) => {
                                if (permission.isFromRole) return;
                                handlePermissionToggle(permission.id, checked);
                              }}
                              disabled={permission.isFromRole}
                              data-testid={`switch-permission-${permissionId}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
          
          <div className="flex justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600">
                  {localPermissionChanges.size} unsaved changes
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowPermissionsDialog(false);
                  setLocalPermissionChanges(new Map());
                  setHasUnsavedChanges(false);
                }}
                disabled={saveBatchPermissionsMutation.isPending}
                data-testid="button-cancel-permissions"
              >
                Cancel
              </Button>
              <Button 
                variant={hasUnsavedChanges ? "default" : "outline"}
                onClick={handleCloseOrSave}
                disabled={saveBatchPermissionsMutation.isPending}
                data-testid="button-dynamic-save-close"
              >
                {saveBatchPermissionsMutation.isPending 
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

      {/* Confirmation Dialog - Production Version */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permission Changes</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const { adding, removing } = getChangesSummary();
                return (
                  <div className="space-y-2">
                    <div>You are about to change permissions for <strong>{selectedUser?.name}</strong>:</div>
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
              onClick={handleSaveChanges}
              disabled={saveBatchPermissionsMutation.isPending}
            >
              {saveBatchPermissionsMutation.isPending ? 'Applying...' : 'Apply Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}