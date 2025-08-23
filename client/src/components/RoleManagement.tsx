import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Shield, Settings } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  permissionCount: number;
}

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

interface Customer {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

export function RoleManagement() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [assignType, setAssignType] = useState<"user" | "customer">("user");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/rbac/roles'],
  }) as { data: Role[]; isLoading: boolean };

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  }) as { data: User[]; isLoading: boolean };

  // Fetch customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
  }) as { data: Customer[]; isLoading: boolean };

  // Fetch permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['/api/rbac/permissions'],
  }) as { data: Permission[]; isLoading: boolean };

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId, userType }: { userId: string; roleId: string; userType: 'user' | 'customer' }) => {
      const endpoint = userType === 'user' ? '/api/rbac/assign-user-role' : '/api/rbac/assign-customer-role';
      return apiRequest(endpoint, 'POST', { userId, roleId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role assigned successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setSelectedUser("");
      setSelectedCustomer("");
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
    mutationFn: async ({ userId, roleId, userType }: { userId: string; roleId: string; userType: 'user' | 'customer' }) => {
      const endpoint = userType === 'user' ? '/api/rbac/remove-user-role' : '/api/rbac/remove-customer-role';
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
    const userId = assignType === "user" ? selectedUser : selectedCustomer;
    if (!userId || !selectedRole) {
      toast({ 
        title: "Error", 
        description: "Please select both a user and a role",
        variant: "destructive" 
      });
      return;
    }

    assignRoleMutation.mutate({ 
      userId, 
      roleId: selectedRole, 
      userType: assignType 
    });
  };

  const handleRemoveRole = (userId: string, roleId: string, userType: 'user' | 'customer') => {
    removeRoleMutation.mutate({ userId, roleId, userType });
  };

  if (rolesLoading || usersLoading || customersLoading || permissionsLoading) {
    return <div data-testid="loading-role-management">Loading role management...</div>;
  }

  return (
    <PermissionGuard permission={PERMISSIONS.ROLE_MANAGE}>
      <div className="space-y-6" data-testid="role-management-container">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Role Management</h2>
            <p className="text-muted-foreground">Manage user roles and permissions</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="button-assign-role">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Role
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-assign-role">
              <DialogHeader>
                <DialogTitle>Assign Role</DialogTitle>
                <DialogDescription>
                  Select a user or customer and assign them a role
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>User Type</Label>
                  <Select value={assignType} onValueChange={(value: "user" | "customer") => setAssignType(value)}>
                    <SelectTrigger data-testid="select-user-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Admin User</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {assignType === "user" ? (
                  <div>
                    <Label>Select User</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger data-testid="select-user">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
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
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                      <SelectTrigger data-testid="select-customer">
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

        {/* Roles Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} data-testid={`card-role-${role.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  {role.isSystemRole && (
                    <Badge variant="secondary" data-testid={`badge-system-role-${role.id}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      System
                    </Badge>
                  )}
                </div>
                <CardDescription>{role.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {role.permissionCount} permissions
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users with Roles */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Admin Users */}
          <Card data-testid="card-admin-users">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Admin Users
              </CardTitle>
              <CardDescription>
                Current role assignments for admin users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`user-${user.id}`}>
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.roles?.map((roleName) => {
                        const role = roles.find(r => r.name === roleName);
                        return role ? (
                          <div key={role.id} className="flex items-center gap-1">
                            <Badge variant="outline" data-testid={`badge-user-role-${user.id}-${role.id}`}>
                              {role.name}
                            </Badge>
                            <PermissionGuard permission={PERMISSIONS.ROLE_ASSIGN}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRole(user.id, role.id, 'user')}
                                disabled={removeRoleMutation.isPending}
                                data-testid={`button-remove-role-${user.id}-${role.id}`}
                              >
                                ×
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

          {/* Customers */}
          <Card data-testid="card-customers">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Customers
              </CardTitle>
              <CardDescription>
                Current role assignments for customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customers.slice(0, 10).map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`customer-${customer.id}`}>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">{customer.email}</div>
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
                                ×
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
        </div>
      </div>
    </PermissionGuard>
  );
}