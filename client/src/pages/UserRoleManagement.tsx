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
  Download,
  Upload,
  RefreshCw,
  UserCheck
} from "lucide-react";

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  isActive: boolean;
  defaultRole: string;
  role: string;
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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);

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

  const openEditUser = (user: User) => {
    setEditingUser(user);
    
    // Find the role ID based on the user's defaultRole name
    const userRole = roles.find(role => 
      role.name === user.defaultRole || 
      role.name?.toLowerCase().replace(' ', '_') === user.defaultRole?.toLowerCase()
    );
    
    setUserFormData({
      username: user.username,
      name: user.name,
      email: user.email || "",
      phone: user.phone || "",
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
    const role = getRoleByName(user.defaultRole);
    const rolePermissions = role?.permissions || [];
    const manualAdded = user.manualPermissions?.added || [];
    const manualRemoved = user.manualPermissions?.removed || [];
    
    return {
      inherited: rolePermissions.filter(p => !manualRemoved.includes(p)),
      manual: manualAdded.filter(p => !rolePermissions.includes(p)),
      total: [...rolePermissions.filter(p => !manualRemoved.includes(p)), ...manualAdded.filter(p => !rolePermissions.includes(p))]
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
                            {user.phone && <div className="text-muted-foreground">{user.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-role-${user.id}`}>
                            {user.defaultRole?.replace('_', ' ') || 'No Role'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowPermissions(showPermissions === user.id ? null : user.id)}
                              data-testid={`button-show-permissions-${user.id}`}
                            >
                              {showPermissions === user.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              <span className="ml-1">{userPermissions.total.length}</span>
                            </Button>
                            {userPermissions.manual.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                +{userPermissions.manual.length} manual
                              </Badge>
                            )}
                          </div>
                          {showPermissions === user.id && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                              <div>
                                <strong>Inherited ({userPermissions.inherited.length}):</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {userPermissions.inherited.map(permission => (
                                    <Badge key={permission} variant="outline" className="text-xs">
                                      {formatPermissionName(permission)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {userPermissions.manual.length > 0 && (
                                <div>
                                  <strong>Manual ({userPermissions.manual.length}):</strong>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {userPermissions.manual.map(permission => (
                                      <Badge key={permission} variant="default" className="text-xs">
                                        {formatPermissionName(permission)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
                              <DropdownMenuItem>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Manage Permissions
                              </DropdownMenuItem>
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
                          {users.filter(u => u.defaultRole === role.name?.toLowerCase().replace(' ', '_')).length} users
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
                            <DropdownMenuItem>
                              <Users className="h-4 w-4 mr-2" />
                              Manage Users
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reset Permissions
                            </DropdownMenuItem>
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
    </AdminLayout>
  );
}