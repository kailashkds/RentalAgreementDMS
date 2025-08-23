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
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Shield, Settings, Trash2, Edit, Plus } from "lucide-react";

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
  const [newUserData, setNewUserData] = useState({
    type: "customer",
    username: "",
    email: "",
    name: "",
    phone: "",
    password: "",
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

  // Create new user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      if (userData.type === "admin") {
        return apiRequest('/api/admin/users', 'POST', {
          username: userData.username,
          email: userData.email,
          name: userData.name,
          password: userData.password,
          role: "staff",
          isActive: true,
        });
      } else {
        return apiRequest('/api/customers', 'POST', {
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          password: userData.password,
          isActive: true,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setShowCreateDialog(false);
      setNewUserData({
        type: "customer",
        username: "",
        email: "",
        name: "",
        phone: "",
        password: "",
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

    createUserMutation.mutate(newUserData);
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
                    Create a new admin user or customer
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>User Type</Label>
                    <Select value={newUserData.type} onValueChange={(value) => 
                      setNewUserData(prev => ({ ...prev, type: value }))
                    }>
                      <SelectTrigger data-testid="select-new-user-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="admin">Admin User</SelectItem>
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
                    {role.isSystemRole && (
                      <Badge variant="secondary" data-testid={`badge-system-role-${role.id}`}>
                        System
                      </Badge>
                    )}
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