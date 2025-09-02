import { useState, useEffect } from "react";
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
  const [localPermissionChanges, setLocalPermissionChanges] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    name: "",
    email: "",
    username: "",
    mobile: "",
    roleId: "",
    password: "",
  });
  const [editUserData, setEditUserData] = useState<CreateUserData>({
    name: "",
    email: "",
    username: "",
    mobile: "",
    roleId: "",
    password: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update form data when selectedUser changes
  useEffect(() => {
    if (selectedUser && showEditDialog) {
      setEditUserData({
        name: selectedUser.name,
        email: selectedUser.email || "",
        username: selectedUser.username || "",
        mobile: selectedUser.mobile || "",
        roleId: selectedUser.roles[0]?.id || "",
        password: "",
      });
    }
  }, [selectedUser, showEditDialog]);

  // Reset local permission changes when dialog opens or user changes
  useEffect(() => {
    if (showPermissionsDialog && selectedUser) {
      console.log('Resetting permission changes for user:', selectedUser.name);
      setLocalPermissionChanges(new Set());
      setHasUnsavedChanges(false);
    }
  }, [showPermissionsDialog, selectedUser]);

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
      setEditUserData({ name: "", email: "", username: "", mobile: "", roleId: "", password: "" });
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
      userData: editUserData,
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
    setLocalPermissionChanges(new Set());
    setHasUnsavedChanges(false);
    setShowPermissionsDialog(true);
  };

  // Function to check if a permission is currently enabled (considering local changes)
  const isPermissionEnabled = (permissionCode: string) => {
    const hasPermission = userPermissionsWithSources.some(p => p.code === permissionCode);
    const hasLocalChange = localPermissionChanges.has(permissionCode);
    return hasLocalChange ? !hasPermission : hasPermission;
  };

  // Function to handle permission toggle
  const handlePermissionToggle = (permissionCode: string) => {
    console.log('Toggle clicked for permission:', permissionCode);
    console.log('Current localPermissionChanges:', Array.from(localPermissionChanges));
    
    const newChanges = new Set(localPermissionChanges);
    if (newChanges.has(permissionCode)) {
      newChanges.delete(permissionCode);
      console.log('Removed from local changes:', permissionCode);
    } else {
      newChanges.add(permissionCode);
      console.log('Added to local changes:', permissionCode);
    }
    
    console.log('New localPermissionChanges:', Array.from(newChanges));
    setLocalPermissionChanges(newChanges);
    setHasUnsavedChanges(newChanges.size > 0);
    console.log('hasUnsavedChanges set to:', newChanges.size > 0);
  };

  // Function to save all permission changes
  const savePermissionChanges = async () => {
    if (!selectedUser || localPermissionChanges.size === 0) {
      console.log('No changes to save:', { selectedUser: !!selectedUser, changesSize: localPermissionChanges.size });
      return;
    }

    console.log('Saving permission changes:', Array.from(localPermissionChanges));

    try {
      const permissionCodes = Array.from(localPermissionChanges);
      for (const permissionCode of permissionCodes) {
        const permission = allPermissions.find(p => p.code === permissionCode);
        if (!permission) {
          console.log('Permission not found:', permissionCode);
          continue;
        }

        const hasPermission = userPermissionsWithSources.some(p => p.code === permissionCode);
        console.log(`Processing ${permissionCode}: hasPermission=${hasPermission}`);
        
        if (hasPermission) {
          // Remove permission
          console.log('Removing permission:', permissionCode);
          await apiRequest(`/api/unified/users/${selectedUser.id}/permission-overrides/${permission.id}`, 'DELETE');
        } else {
          // Add permission
          console.log('Adding permission:', permissionCode);
          await apiRequest('/api/unified/users/permission-overrides', 'POST', {
            userId: selectedUser.id,
            permissionId: permission.id
          });
        }
      }

      toast({
        title: "Success",
        description: "Permission changes saved successfully",
      });

      setLocalPermissionChanges(new Set());
      setHasUnsavedChanges(false);
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: [`/api/unified/users/${selectedUser.id}/permissions-with-sources`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/unified/users'] });
      
      console.log('Permission changes saved successfully');
    } catch (error) {
      console.error('Error saving permission changes:', error);
      toast({
        title: "Error",
        description: "Failed to save permission changes",
        variant: "destructive",
      });
    }
  };

  // Function to discard changes
  const discardChanges = () => {
    setLocalPermissionChanges(new Set());
    setHasUnsavedChanges(false);
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
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserData.email}
                onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUserData.username}
                onChange={(e) => setEditUserData({ ...editUserData, username: e.target.value })}
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mobile">Mobile</Label>
              <Input
                id="edit-mobile"
                value={editUserData.mobile}
                onChange={(e) => setEditUserData({ ...editUserData, mobile: e.target.value })}
                placeholder="Enter mobile number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editUserData.roleId} onValueChange={(value) => setEditUserData({ ...editUserData, roleId: value })}>
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
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Manage Permissions for {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Manage individual permissions for this user. These permissions will be added to or removed from their role-based permissions.
            </DialogDescription>
          </DialogHeader>
          
          {/* Unsaved Changes Banner */}
          {hasUnsavedChanges && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium">You have unsaved changes</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={discardChanges}
                  data-testid="button-discard-changes"
                >
                  Discard Changes
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Current Role & Permissions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Current Role & Permissions</h4>
              <div className="space-y-2">
                {selectedUser?.roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {role.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Base Role: {userPermissionsWithSources.filter(p => p.source === 'role').length} permissions
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-green-600">+{Array.from(localPermissionChanges).filter(code => !userPermissionsWithSources.some(p => p.code === code)).length} added</span>
                  <span className="text-red-600">-{Array.from(localPermissionChanges).filter(code => userPermissionsWithSources.some(p => p.code === code)).length} removed</span>
                </div>
              </div>
            </div>

            {/* Available Permissions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Available Permissions</h4>
              
              {/* Group permissions by category */}
              {(() => {
                const groupedPermissions = allPermissions.reduce((acc, permission) => {
                  const category = permission.code.split('.')[0].toUpperCase();
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(permission);
                  return acc;
                }, {} as Record<string, Permission[]>);

                return Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {category}
                      </h5>
                      <span className="text-xs text-muted-foreground">
                        {permissions.filter(p => isPermissionEnabled(p.code)).length}/{permissions.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {permissions.map((permission) => {
                        const isEnabled = isPermissionEnabled(permission.code);
                        const hasOriginalPermission = userPermissionsWithSources.some(p => p.code === permission.code);
                        const hasLocalChange = localPermissionChanges.has(permission.code);
                        const originalSource = userPermissionsWithSources.find(p => p.code === permission.code)?.source;
                        
                        return (
                          <div 
                            key={permission.id}
                            className="flex items-center justify-between py-2 px-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {permission.code.split('.').slice(1).map(part => 
                                    part.charAt(0).toUpperCase() + part.slice(1)
                                  ).join(' ')}
                                </span>
                                {hasOriginalPermission && !hasLocalChange && (
                                  <Badge variant="outline" className="text-xs">
                                    {originalSource === 'role' ? 'Role' : 'Manual'}
                                  </Badge>
                                )}
                                {hasLocalChange && (
                                  <Badge variant={isEnabled ? "default" : "destructive"} className="text-xs">
                                    {isEnabled ? 'Pending +' : 'Pending -'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {permission.description}
                              </p>
                            </div>
                            <PermissionGuard permission="user.edit.all">
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handlePermissionToggle(permission.code)}
                                data-testid={`toggle-${permission.code}`}
                              />
                            </PermissionGuard>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setShowPermissionsDialog(false)}
              data-testid="button-close-permissions"
            >
              Close
            </Button>
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <Button 
                  onClick={savePermissionChanges}
                  data-testid="button-save-changes"
                >
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}