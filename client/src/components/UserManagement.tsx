import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Shield, Settings, Trash2, Edit, Plus, Save } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role?: string;
  isActive: boolean;
  roles?: string[];
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  roles?: string[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
}

export function UserManagement() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [userType, setUserType] = useState<"admin" | "customer">("admin");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newUserData, setNewUserData] = useState({
    type: "admin",
    username: "",
    email: "",
    name: "",
    phone: "",
    password: "",
    roleId: "",
  });
  const [newRoleData, setNewRoleData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/rbac/roles'],
  }) as { data: Role[]; isLoading: boolean };

  const { data: adminUsers = [], isLoading: adminUsersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  }) as { data: AdminUser[]; isLoading: boolean };

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
  }) as { data: { customers: Customer[] } | undefined; isLoading: boolean };

  const customers = customersData?.customers || [];

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['/api/rbac/permissions'],
  }) as { data: Permission[]; isLoading: boolean };

  // Create new role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: typeof newRoleData) => {
      const role = await apiRequest('/api/rbac/roles', 'POST', {
        name: roleData.name,
        description: roleData.description,
        isSystemRole: false,
      }) as any;
      
      // Assign permissions to the role
      for (const permissionId of roleData.permissions) {
        await apiRequest('/api/rbac/assign-role-permission', 'POST', {
          roleId: role.id,
          permissionId,
        });
      }
      
      return role;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      setShowCreateRoleDialog(false);
      setNewRoleData({ name: "", description: "", permissions: [] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create role",
        variant: "destructive" 
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, roleData }: { roleId: string; roleData: typeof newRoleData }) => {
      await apiRequest(`/api/rbac/roles/${roleId}`, 'PUT', {
        name: roleData.name,
        description: roleData.description,
      });
      
      // Get current permissions for this role
      const currentPermissions = await apiRequest(`/api/rbac/roles/${roleId}/permissions`, 'GET') as unknown as any[];
      
      // Remove all current permissions
      for (const permission of currentPermissions) {
        await apiRequest('/api/rbac/remove-role-permission', 'DELETE', {
          roleId,
          permissionId: permission.id,
        });
      }
      
      // Add new permissions
      for (const permissionId of roleData.permissions) {
        await apiRequest('/api/rbac/assign-role-permission', 'POST', {
          roleId,
          permissionId,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      setEditingRole(null);
      setNewRoleData({ name: "", description: "", permissions: [] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update role",
        variant: "destructive" 
      });
    },
  });

  // Create new user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      let user;
      if (userData.type === "admin") {
        user = await apiRequest('/api/admin/users', 'POST', {
          username: userData.username,
          email: userData.email,
          name: userData.name,
          password: userData.password,
          role: "staff",
          isActive: true,
        }) as any;
        
        // Assign role if selected
        if (userData.roleId) {
          await apiRequest('/api/rbac/assign-user-role', 'POST', {
            userId: user.id,
            roleId: userData.roleId,
          });
        }
      } else {
        user = await apiRequest('/api/customers', 'POST', {
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          password: userData.password,
          isActive: true,
        }) as any;
        
        // Assign role if selected
        if (userData.roleId) {
          await apiRequest('/api/rbac/assign-customer-role', 'POST', {
            userId: user.id,
            roleId: userData.roleId,
          });
        }
      }
      
      return user;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setShowCreateDialog(false);
      setNewUserData({
        type: "admin",
        username: "",
        email: "",
        name: "",
        phone: "",
        password: "",
        roleId: "",
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create user",
        variant: "destructive" 
      });
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId, userType }: { userId: string; roleId: string; userType: 'admin' | 'customer' }) => {
      const endpoint = userType === 'admin' ? '/api/rbac/assign-user-role' : '/api/rbac/assign-customer-role';
      return apiRequest(endpoint, 'POST', { userId, roleId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role assigned successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setSelectedUser("");
      setSelectedRole("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to assign role",
        variant: "destructive" 
      });
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId, userType }: { userId: string; roleId: string; userType: 'admin' | 'customer' }) => {
      const endpoint = userType === 'admin' ? '/api/rbac/remove-user-role' : '/api/rbac/remove-customer-role';
      return apiRequest(endpoint, 'DELETE', { userId, roleId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role removed successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to remove role",
        variant: "destructive" 
      });
    },
  });

  const handleAssignRole = () => {
    if (!selectedUser || !selectedRole) {
      toast({ 
        title: "Error", 
        description: "Please select both a user and a role",
        variant: "destructive" 
      });
      return;
    }

    assignRoleMutation.mutate({ 
      userId: selectedUser, 
      roleId: selectedRole, 
      userType 
    });
  };

  const handleRemoveRole = (userId: string, roleId: string, userType: 'admin' | 'customer') => {
    removeRoleMutation.mutate({ userId, roleId, userType });
  };

  const handleCreateUser = () => {
    if (!newUserData.name || !newUserData.email) {
      toast({ 
        title: "Error", 
        description: "Please fill in all required fields",
        variant: "destructive" 
      });
      return;
    }

    if (newUserData.type === "admin" && !newUserData.username) {
      toast({ 
        title: "Error", 
        description: "Username is required for admin users",
        variant: "destructive" 
      });
      return;
    }

    createUserMutation.mutate(newUserData);
  };

  const handleCreateRole = () => {
    if (!newRoleData.name) {
      toast({ 
        title: "Error", 
        description: "Role name is required",
        variant: "destructive" 
      });
      return;
    }

    createRoleMutation.mutate(newRoleData);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setNewRoleData({
      name: role.name,
      description: role.description,
      permissions: [], // Will be loaded from API
    });
    setShowCreateRoleDialog(true);
  };

  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    setNewRoleData(prev => ({
      ...prev,
      permissions: checked 
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(id => id !== permissionId)
    }));
  };

  const resetRoleForm = () => {
    setNewRoleData({ name: "", description: "", permissions: [] });
    setEditingRole(null);
  };

  if (rolesLoading || adminUsersLoading || customersLoading || permissionsLoading) {
    return <div data-testid="loading-user-management">Loading user management...</div>;
  }

  return (
    <PermissionGuard permission={PERMISSIONS.USER_MANAGE}>
      <div className="space-y-6" data-testid="user-management-container">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
            <p className="text-muted-foreground">Manage users, roles, and permissions</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={showCreateRoleDialog} onOpenChange={(open) => {
              setShowCreateRoleDialog(open);
              if (!open) resetRoleForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-role">
                  <Shield className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-create-role">
                <DialogHeader>
                  <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
                  <DialogDescription>
                    {editingRole ? "Update role details and permissions" : "Create a new role and assign permissions"}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>Role Name</Label>
                    <Input
                      value={newRoleData.name}
                      onChange={(e) => setNewRoleData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Editor, Manager"
                      data-testid="input-role-name"
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newRoleData.description}
                      onChange={(e) => setNewRoleData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this role can do"
                      data-testid="input-role-description"
                    />
                  </div>

                  <div>
                    <Label className="text-base font-medium">Permissions</Label>
                    <div className="mt-2 space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center space-x-3" data-testid={`permission-${permission.id}`}>
                          <Checkbox
                            id={permission.id}
                            checked={newRoleData.permissions.includes(permission.id)}
                            onCheckedChange={(checked) => handlePermissionToggle(permission.id, checked as boolean)}
                            data-testid={`checkbox-permission-${permission.id}`}
                          />
                          <div className="flex-1">
                            <Label htmlFor={permission.id} className="text-sm font-medium cursor-pointer">
                              {permission.name}
                            </Label>
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={editingRole ? 
                        () => updateRoleMutation.mutate({ roleId: editingRole.id, roleData: newRoleData }) : 
                        handleCreateRole
                      }
                      disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                      className="flex-1"
                      data-testid="button-save-role"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {createRoleMutation.isPending || updateRoleMutation.isPending ? 
                        "Saving..." : 
                        editingRole ? "Update Role" : "Create Role"
                      }
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowCreateRoleDialog(false);
                        resetRoleForm();
                      }}
                      data-testid="button-cancel-role"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-user">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-user">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Create a new admin user or customer with role assignment
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>User Type</Label>
                    <Select value={newUserData.type} onValueChange={(value) => 
                      setNewUserData(prev => ({ ...prev, type: value, roleId: "" }))
                    }>
                      <SelectTrigger data-testid="select-new-user-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin User</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newUserData.name}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-new-user-name"
                    />
                  </div>

                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-new-user-email"
                    />
                  </div>

                  {newUserData.type === "admin" && (
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={newUserData.username}
                        onChange={(e) => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
                        data-testid="input-new-user-username"
                      />
                    </div>
                  )}

                  {newUserData.type === "customer" && (
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={newUserData.phone}
                        onChange={(e) => setNewUserData(prev => ({ ...prev, phone: e.target.value }))}
                        data-testid="input-new-user-phone"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                      data-testid="input-new-user-password"
                    />
                  </div>

                  <div>
                    <Label>Assign Role (Optional)</Label>
                    <Select 
                      value={newUserData.roleId} 
                      onValueChange={(value) => setNewUserData(prev => ({ ...prev, roleId: value }))}
                    >
                      <SelectTrigger data-testid="select-new-user-role">
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name} - {role.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleCreateUser}
                    disabled={createUserMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-create"
                  >
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-assign-role">
                  <Shield className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-assign-role">
                <DialogHeader>
                  <DialogTitle>Assign Role</DialogTitle>
                  <DialogDescription>
                    Select a user and assign them a role
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>User Type</Label>
                    <Select value={userType} onValueChange={(value: "admin" | "customer") => setUserType(value)}>
                      <SelectTrigger data-testid="select-user-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin User</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {userType === "admin" ? (
                    <div>
                      <Label>Select Admin User</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger data-testid="select-admin-user">
                          <SelectValue placeholder="Choose an admin user" />
                        </SelectTrigger>
                        <SelectContent>
                          {adminUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.username} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>Select Customer</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger data-testid="select-customer-user">
                          <SelectValue placeholder="Choose a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} ({customer.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Select Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger data-testid="select-role">
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name} - {role.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleAssignRole}
                    disabled={assignRoleMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-assign"
                  >
                    {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Roles Overview */}
        <Card data-testid="card-roles-overview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Available Roles ({roles.length})
            </CardTitle>
            <CardDescription>
              System roles and their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div key={role.id} className="p-4 border rounded-lg" data-testid={`role-card-${role.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{role.name}</h4>
                    <div className="flex items-center gap-2">
                      {role.isSystemRole && (
                        <Badge variant="secondary" data-testid={`badge-system-role-${role.id}`}>
                          System
                        </Badge>
                      )}
                      {!role.isSystemRole && (
                        <PermissionGuard permission={PERMISSIONS.ROLE_MANAGE}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRole(role)}
                            data-testid={`button-edit-role-${role.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </PermissionGuard>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Users Management */}
        <Tabs defaultValue="admin-users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="admin-users" data-testid="tab-admin-users">Admin Users ({adminUsers.length})</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Customers ({customers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="admin-users" className="space-y-4">
            <Card data-testid="card-admin-users">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Admin Users
                </CardTitle>
                <CardDescription>
                  Manage admin users and their role assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adminUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`admin-user-${user.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            <div className="text-sm text-muted-foreground">{user.name}</div>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {user.role && (
                              <Badge variant="outline">
                                {user.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.roles?.map((roleName) => {
                          const role = roles.find(r => r.name === roleName);
                          return role ? (
                            <div key={role.id} className="flex items-center gap-1">
                              <Badge variant="outline" data-testid={`badge-admin-role-${user.id}-${role.id}`}>
                                {role.name}
                              </Badge>
                              <PermissionGuard permission={PERMISSIONS.ROLE_ASSIGN}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveRole(user.id, role.id, 'admin')}
                                  disabled={removeRoleMutation.isPending}
                                  data-testid={`button-remove-admin-role-${user.id}-${role.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </PermissionGuard>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <Card data-testid="card-customers-tab">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Customers
                </CardTitle>
                <CardDescription>
                  Manage customer accounts and their role assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customers.slice(0, 20).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`customer-user-${customer.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-muted-foreground">{customer.email}</div>
                            <div className="text-sm text-muted-foreground">{customer.phone}</div>
                          </div>
                          <Badge variant={customer.isActive ? "default" : "secondary"}>
                            {customer.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {customer.roles?.map((roleName) => {
                          const role = roles.find(r => r.name === roleName);
                          return role ? (
                            <div key={role.id} className="flex items-center gap-1">
                              <Badge variant="outline" data-testid={`badge-customer-role-${customer.id}-${role.id}`}>
                                {role.name}
                              </Badge>
                              <PermissionGuard permission={PERMISSIONS.ROLE_ASSIGN}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveRole(customer.id, role.id, 'customer')}
                                  disabled={removeRoleMutation.isPending}
                                  data-testid={`button-remove-customer-role-${customer.id}-${role.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </PermissionGuard>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}