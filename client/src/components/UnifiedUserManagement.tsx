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
  mobile?: string;
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
  mobile?: string;
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
    mobile: "",
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
      setCreateUserData({ name: "", email: "", username: "", mobile: "", roleId: "", password: "" });
      
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
      mobile: user.mobile || "",
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={createUserData.username}
                    onChange={(e) => setCreateUserData({ ...createUserData, username: e.target.value })}
                    placeholder="Username (auto-generated if empty)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={createUserData.mobile}
                    onChange={(e) => setCreateUserData({ ...createUserData, mobile: e.target.value })}
                    placeholder="Mobile number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={createUserData.roleId} onValueChange={(value) => setCreateUserData({ ...createUserData, roleId: value })}>
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={createUserData.password}
                    onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGuard>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.name}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({usersData?.total || 0})</CardTitle>
          <CardDescription>
            All users in the system with their assigned roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{user.name}</div>
                          {user.username && (
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {user.email && (
                          <div className="text-sm">{user.email}</div>
                        )}
                        {user.mobile && (
                          <div className="text-sm text-muted-foreground">{user.mobile}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role.id} variant="secondary">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.isActive, user.status)}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermissionGuard permission="user.edit.all">
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </PermissionGuard>
                          <PermissionGuard permission="user.edit.all">
                            <DropdownMenuItem onClick={() => openPermissionsDialog(user)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Manage Permissions
                            </DropdownMenuItem>
                          </PermissionGuard>
                          <PermissionGuard permission="user.edit.all">
                            <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(user.id)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                          </PermissionGuard>
                          <PermissionGuard permission="user.edit.all">
                            <DropdownMenuItem 
                              onClick={() => toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive })}
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
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
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
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </PermissionGuard>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={createUserData.name}
                onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                placeholder="Full name"
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={createUserData.username}
                onChange={(e) => setCreateUserData({ ...createUserData, username: e.target.value })}
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mobile">Mobile</Label>
              <Input
                id="edit-mobile"
                value={createUserData.mobile}
                onChange={(e) => setCreateUserData({ ...createUserData, mobile: e.target.value })}
                placeholder="Mobile number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={createUserData.roleId} onValueChange={(value) => setCreateUserData({ ...createUserData, roleId: value })}>
                <SelectTrigger>
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
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
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
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>
              The password has been reset. Please save this information securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label>New Password</Label>
              <div className="text-lg font-mono mt-1">{passwordResult}</div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowPasswordDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Management Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions - {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              View and manage user permissions. Role permissions are inherited automatically, 
              while manual overrides can be added or removed by Super Admins.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Current Permissions */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Current Permissions
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userPermissionsWithSources.map((permission, index) => (
                  <div 
                    key={`${permission.code}-${index}`}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{permission.code}</span>
                      {permission.source === 'role' ? (
                        <Badge variant="default" className="text-xs">
                          Role: {permission.roleName}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Manual Override
                        </Badge>
                      )}
                    </div>
                    {permission.source === 'override' && (
                      <PermissionGuard permission="user.edit.all">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            const permissionObj = allPermissions.find(p => p.code === permission.code);
                            if (permissionObj && selectedUser) {
                              removePermissionOverrideMutation.mutate({
                                userId: selectedUser.id,
                                permissionId: permissionObj.id
                              });
                            }
                          }}
                          disabled={removePermissionOverrideMutation.isPending}
                        >
                          Remove
                        </Button>
                      </PermissionGuard>
                    )}
                  </div>
                ))}
                {userPermissionsWithSources.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No permissions found for this user.
                  </p>
                )}
              </div>
            </div>

            {/* Add Manual Permission Override */}
            <PermissionGuard permission="user.edit.all">
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Manual Permission Override
                </h4>
                <div className="space-y-3">
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {allPermissions
                      .filter(permission => 
                        !userPermissionsWithSources.some(up => up.code === permission.code)
                      )
                      .map((permission) => (
                        <div 
                          key={permission.id}
                          className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <div>
                            <span className="text-sm font-mono">{permission.code}</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (selectedUser) {
                                addPermissionOverrideMutation.mutate({
                                  userId: selectedUser.id,
                                  permissionId: permission.id
                                });
                              }
                            }}
                            disabled={addPermissionOverrideMutation.isPending}
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    {allPermissions.filter(permission => 
                      !userPermissionsWithSources.some(up => up.code === permission.code)
                    ).length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No additional permissions available to add.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </PermissionGuard>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowPermissionsDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}