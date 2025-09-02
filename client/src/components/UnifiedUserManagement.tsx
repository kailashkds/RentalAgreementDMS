import { useState } from "react";
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
  const [passwordResult, setPasswordResult] = useState<string>("");
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
    queryKey: ["/api/rbac/permissions"],
    enabled: showPermissionsDialog && !!selectedUser,
  });

  // Query for user permissions with sources
  const { data: userPermissionsWithSources = [] } = useQuery<PermissionWithSource[]>({
    queryKey: [`/api/unified/users/${selectedUser?.id}/permissions-with-sources`],
    enabled: showPermissionsDialog && !!selectedUser,
  });

  // Fetch users with roles
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/unified/users'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter && roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/unified/users?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  }) as { data: { users: UnifiedUser[]; total: number } | undefined; isLoading: boolean };

  // Fetch roles for dropdown
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/rbac/roles'],
  }) as { data: Role[]; isLoading: boolean };

  const users = usersData?.users || [];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserData) => {
      const response = await apiRequest('/api/unified/users', 'POST', userData);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "User Created",
        description: `User ${createUserData.name} created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
      setShowCreateDialog(false);
      setCreateUserData({ name: "", email: "", username: "", phone: "", roleId: "", password: "" });

      // Show generated credentials if any
      if (data.credentials) {
        toast({
          title: "Generated Credentials",
          description: `Username: ${data.credentials.username}, Password: ${data.credentials.password}`,
          duration: 10000,
        });
      }
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
    mutationFn: async ({ id, userData }: { id: string; userData: Partial<CreateUserData> }) => {
      return await apiRequest(`/api/unified/users/${id}`, 'PUT', userData);
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
      setShowEditDialog(false);
      setSelectedUser(null);
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
      return await apiRequest(`/api/unified/users/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
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
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/unified/users/${id}/reset-password`, 'PATCH', {});
      return response;
    },
    onSuccess: (data: any) => {
      setPasswordResult(data.password);
      setShowPasswordDialog(true);
      toast({
        title: "Password Reset",
        description: "Password reset successfully",
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

  // Toggle status mutation
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

  // Add permission override mutation
  const addPermissionOverrideMutation = useMutation({
    mutationFn: async ({ userId, permissionId }: { userId: string; permissionId: string }) => {
      return await apiRequest(`/api/unified/users/${userId}/permission-overrides`, 'POST', { permissionId });
    },
    onSuccess: () => {
      toast({
        title: "Permission Added",
        description: "Permission override added successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/unified/users/${selectedUser?.id}/permissions-with-sources`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add permission override",
        variant: "destructive",
      });
    },
  });

  // Remove permission override mutation
  const removePermissionOverrideMutation = useMutation({
    mutationFn: async ({ userId, permissionId }: { userId: string; permissionId: string }) => {
      return await apiRequest(`/api/unified/users/${userId}/permission-overrides/${permissionId}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Permission Removed",
        description: "Permission override removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/unified/users/${selectedUser?.id}/permissions-with-sources`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove permission override",
        variant: "destructive",
      });
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
  };

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
              {usersData?.total || 0}
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
              {users.filter(user => user.isActive).length}
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
              {users.filter(user => !user.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
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
          <CardTitle>Filters & Search</CardTitle>
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
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
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
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users List</CardTitle>
          <CardDescription>
            Complete list of all users with their roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2">Loading users...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium" data-testid={`text-user-name-${user.id}`}>
                            {user.name}
                          </div>
                          {user.username && (
                            <div className="text-sm text-muted-foreground">
                              @{user.username}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {user.email && (
                            <div className="text-sm" data-testid={`text-user-email-${user.id}`}>
                              {user.email}
                            </div>
                          )}
                          {user.phone && (
                            <div className="text-sm text-muted-foreground" data-testid={`text-user-phone-${user.id}`}>
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge
                              key={role.id}
                              variant="secondary"
                              data-testid={`badge-role-${role.name.toLowerCase()}-${user.id}`}
                            >
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(user.isActive, user.status)}
                      </TableCell>
                      <TableCell data-testid={`text-user-created-${user.id}`}>
                        {formatDateToDDMMYYYY(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-user-actions-${user.id}`}
                            >
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
                                      data-testid={`button-confirm-delete-${user.id}`}
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
              Update user information and role assignment.
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
                    <SelectItem key={role.id} value={role.id}>
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
                data-testid="button-update-user"
              >
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Result Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Password Reset Successful</DialogTitle>
            <DialogDescription>
              The new password has been generated for the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-sm font-medium">New Password:</Label>
              <div className="font-mono text-lg mt-1 break-all" data-testid="text-new-password">
                {passwordResult}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Please securely share this password with the user. They should change it upon first login.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowPasswordDialog(false)} data-testid="button-close-password-dialog">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Management Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Manage Permissions - {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Manage individual permission overrides for this user. Role-based permissions are inherited automatically,
              and you can add additional permissions or remove role-based permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-96">
            {allPermissions.map((permission) => {
              const userPermission = userPermissionsWithSources.find(up => up.code === permission.code);
              const hasPermission = !!userPermission;
              const isFromRole = userPermission?.source === 'role';
              const isOverride = userPermission?.source === 'override';

              return (
                <div 
                  key={permission.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`permission-item-${permission.code}`}
                >
                  <div className="flex-1">
                    <div className="font-medium" data-testid={`permission-name-${permission.code}`}>
                      {permission.description}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {permission.code}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasPermission && isFromRole && (
                      <Badge variant="secondary" data-testid={`badge-from-role-${permission.code}`}>
                        From Role: {userPermission.roleName}
                      </Badge>
                    )}
                    {hasPermission && isOverride && (
                      <Badge variant="default" data-testid={`badge-override-${permission.code}`}>
                        Override
                      </Badge>
                    )}
                    <Button
                      variant={hasPermission ? "destructive" : "default"}
                      size="sm"
                      onClick={() => {
                        if (hasPermission && isOverride) {
                          // Only allow removing override permissions, not role-based ones
                          removePermissionOverrideMutation.mutate({
                            userId: selectedUser!.id,
                            permissionId: permission.id
                          });
                        } else if (!hasPermission) {
                          // Add permission override
                          addPermissionOverrideMutation.mutate({
                            userId: selectedUser!.id,
                            permissionId: permission.id
                          });
                        }
                      }}
                      disabled={
                        addPermissionOverrideMutation.isPending || 
                        removePermissionOverrideMutation.isPending ||
                        (hasPermission && isFromRole) // Disable for role-based permissions
                      }
                      data-testid={`button-toggle-permission-${permission.code}`}
                    >
                      {addPermissionOverrideMutation.isPending || removePermissionOverrideMutation.isPending
                        ? "Updating..."
                        : hasPermission && isFromRole
                          ? "From Role"
                          : hasPermission 
                            ? "Remove" 
                            : "Add"
                      }
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowPermissionsDialog(false)} data-testid="button-close-permissions-dialog">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}