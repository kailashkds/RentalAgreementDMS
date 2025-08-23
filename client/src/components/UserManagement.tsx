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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "./PermissionGuard";
import { PERMISSIONS } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Shield, Settings, Trash2, Edit, Plus, Save, ChevronDown, ChevronRight, Search, CheckSquare, Square } from "lucide-react";

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

interface SubPermission {
  code: string;
  name: string;
  isDefault?: boolean;
}

interface PermissionGroup {
  code?: string;
  name: string;
  defaultFor?: string[];
  subPermissions?: SubPermission[];
}

interface PermissionCategory {
  title: string;
  icon: string;
  permissions: PermissionGroup[];
}

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changedBy: string;
  timestamp: string;
  diff: any;
  metadata: any;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[] | "all";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["agreements", "customers", "users", "roles", "templates", "downloads", "system"]);
  
  // Enterprise features state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceRole, setCloneSourceRole] = useState<Role | null>(null);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [selectedRoleForAudit, setSelectedRoleForAudit] = useState<string>("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  
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

  // Enterprise features queries
  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['/api/rbac/audit-logs'],
    enabled: showAuditDialog,
  }) as { data: { logs: AuditLog[]; total: number }; isLoading: boolean };

  const { data: roleTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/rbac/role-templates'],
    enabled: showTemplateDialog,
  }) as { data: RoleTemplate[]; isLoading: boolean };

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

  // Role cloning mutation
  const cloneRoleMutation = useMutation({
    mutationFn: async ({ sourceRoleId, name, description }: { sourceRoleId: string; name: string; description?: string }) => {
      return await apiRequest(`/api/rbac/roles/${sourceRoleId}/clone`, 'POST', {
        name,
        description,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role cloned successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      setShowCloneDialog(false);
      setCloneSourceRole(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to clone role",
        variant: "destructive" 
      });
    },
  });

  // Create role from template mutation
  const createFromTemplateMutation = useMutation({
    mutationFn: async ({ template, name, description }: { template: RoleTemplate; name: string; description?: string }) => {
      let permissionIds: string[] = [];
      
      if (template.permissions === "all") {
        permissionIds = permissions.map(p => p.id);
      } else {
        // Map permission codes to IDs
        permissionIds = permissions
          .filter(p => (template.permissions as string[]).includes(p.code))
          .map(p => p.id);
      }

      return await apiRequest('/api/rbac/roles', 'POST', {
        name,
        description: description || template.description,
        permissions: permissionIds,
        isSystemRole: false,
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role created from template successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      setShowTemplateDialog(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create role from template",
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

  const handleEditRole = async (role: Role) => {
    setEditingRole(role);
    
    try {
      // Load current permissions for this role
      const currentPermissions = await apiRequest(`/api/rbac/roles/${role.id}/permissions`, 'GET') as any[];
      
      setNewRoleData({
        name: role.name,
        description: role.description,
        permissions: currentPermissions.map(p => p.id),
      });
    } catch (error) {
      console.error('Failed to load role permissions:', error);
      setNewRoleData({
        name: role.name,
        description: role.description,
        permissions: [],
      });
    }
    
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

  // Permission categories and organization
  const permissionCategories: Record<string, PermissionCategory> = {
    agreements: {
      title: "Agreements",
      icon: "📄",
      permissions: [
        { code: "agreement.create", name: "Create Agreements" },
        { code: "agreement.notarize", name: "Upload Notarized Agreements" },
        { 
          code: "agreement.view.all", 
          name: "View All Agreements", 
          defaultFor: ["agreement.view.own"]
        },
        { 
          code: "agreement.edit.all", 
          name: "Edit All Agreements", 
          defaultFor: ["agreement.edit.own"]
        },
        { 
          code: "agreement.delete.all", 
          name: "Delete All Agreements", 
          defaultFor: ["agreement.delete.own"]
        }
      ]
    },
    downloads: {
      title: "Downloads & Sharing",
      icon: "⬇️",
      permissions: [
        { 
          code: "download.agreement.all", 
          name: "Download All Agreements", 
          defaultFor: ["download.agreement.own"]
        },
        { 
          code: "share.agreement.all", 
          name: "Share All Agreements", 
          defaultFor: ["share.agreement.own"]
        }
      ]
    },
    customers: {
      title: "Customers",
      icon: "👥",
      permissions: [
        { code: "customer.create", name: "Create Customers" },
        { code: "customer.view.all", name: "View All Customers" },
        { code: "customer.edit.all", name: "Edit All Customers" },
        { code: "customer.delete.all", name: "Delete All Customers" },
        { code: "customer.manage", name: "Manage Customers" }
      ]
    },
    users: {
      title: "Users",
      icon: "👤",
      permissions: [
        { code: "user.create", name: "Create Users" },
        { code: "user.view.all", name: "View All Users" },
        { code: "user.edit.all", name: "Edit All Users" },
        { code: "user.delete.all", name: "Delete All Users" },
        { code: "user.manage", name: "Manage Users (assign/remove roles, reset passwords)" }
      ]
    },
    roles: {
      title: "Roles & Permissions",
      icon: "🛡️",
      permissions: [
        { code: "role.manage", name: "Manage Roles & Permissions" },
        { code: "role.assign", name: "Assign Roles to Users" }
      ]
    },
    templates: {
      title: "Templates",
      icon: "📋",
      permissions: [
        { code: "template.create", name: "Create Templates" },
        { code: "template.edit", name: "Edit Templates" },
        { code: "template.delete", name: "Delete Templates" },
        { code: "template.manage", name: "Manage Templates (import/export/advanced ops)" }
      ]
    },
    system: {
      title: "System",
      icon: "⚙️",
      permissions: [
        { code: "dashboard.view", name: "Dashboard Access" },
        { code: "system.admin", name: "Super Admin (bypass all checks)" }
      ]
    }
  };

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryKey) 
        ? prev.filter(k => k !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const toggleCategoryPermissions = (categoryKey: string, checked: boolean) => {
    const category = permissionCategories[categoryKey as keyof typeof permissionCategories];
    const allPermissionsInCategory: string[] = [];
    
    category.permissions.forEach(permission => {
      const actualPermission = permissions.find(p => p.code === permission.code);
      if (actualPermission) allPermissionsInCategory.push(actualPermission.id);
      
      // If this permission has defaults, also include them when unchecking
      if (!checked && permission.defaultFor) {
        permission.defaultFor.forEach(defaultCode => {
          const defaultPermission = permissions.find(p => p.code === defaultCode);
          if (defaultPermission) allPermissionsInCategory.push(defaultPermission.id);
        });
      }
    });
    
    setNewRoleData(prev => ({
      ...prev,
      permissions: checked 
        ? Array.from(new Set([...prev.permissions, ...allPermissionsInCategory]))
        : prev.permissions.filter(id => !allPermissionsInCategory.includes(id))
    }));
  };

  const getPermissionById = (code: string) => {
    return permissions.find(p => p.code === code);
  };

  const isPermissionSelected = (permissionCode: string) => {
    const permission = getPermissionById(permissionCode);
    return permission ? newRoleData.permissions.includes(permission.id) : false;
  };

  const filteredCategories = Object.entries(permissionCategories).filter(([key, category]) => {
    if (!searchTerm) return true;
    return category.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           category.permissions.some(perm => 
             perm.name.toLowerCase().includes(searchTerm.toLowerCase())
           );
  });

  const handleSmartPermissionToggle = (permissionCode: string, checked: boolean) => {
    const permission = permissions.find(p => p.code === permissionCode);
    if (!permission) return;

    const permissionConfig = Object.values(permissionCategories)
      .flatMap(cat => cat.permissions)
      .find(p => p.code === permissionCode);

    if (checked) {
      // User selected this permission - give them the "all" version
      handlePermissionToggle(permission.id, true);
    } else {
      // User deselected this permission
      // Remove the "all" permission and add the default "own" permissions
      setNewRoleData(prev => {
        let newPermissions = prev.permissions.filter(id => id !== permission.id);
        
        // Add default "own" permissions if they exist
        if (permissionConfig?.defaultFor) {
          permissionConfig.defaultFor.forEach(defaultCode => {
            const defaultPermission = permissions.find(p => p.code === defaultCode);
            if (defaultPermission && !newPermissions.includes(defaultPermission.id)) {
              newPermissions.push(defaultPermission.id);
            }
          });
        }
        
        return { ...prev, permissions: newPermissions };
      });
    }
  };

  const resetRoleForm = () => {
    setNewRoleData({ name: "", description: "", permissions: [] });
    setEditingRole(null);
    setSearchTerm("");
    setExpandedCategories(["agreements", "customers", "users", "roles", "templates", "downloads", "system"]);
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
            <Button 
              variant="outline"
              onClick={() => setShowTemplateDialog(true)}
              data-testid="button-create-from-template"
            >
              <FileText className="h-4 w-4 mr-2" />
              From Template
            </Button>
            
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
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-role">
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
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-base font-medium">Permissions</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search permissions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                            data-testid="input-search-permissions"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
                      {filteredCategories.map(([categoryKey, category]) => {
                        const isExpanded = expandedCategories.includes(categoryKey);
                        const categoryPermissionIds = category.permissions.flatMap(perm => {
                          const mainPerm = getPermissionById(perm.code!)?.id;
                          const defaultPerms = perm.defaultFor?.map(code => getPermissionById(code)?.id).filter(Boolean) || [];
                          return [mainPerm, ...defaultPerms].filter(Boolean);
                        }) as string[];
                        const selectedInCategory = categoryPermissionIds.filter(id => newRoleData.permissions.includes(id)).length;
                        const allInCategory = categoryPermissionIds.length;
                        const isAllSelected = selectedInCategory === allInCategory && allInCategory > 0;
                        const isPartiallySelected = selectedInCategory > 0 && selectedInCategory < allInCategory;
                        
                        return (
                          <Collapsible key={categoryKey} open={isExpanded} onOpenChange={() => toggleCategory(categoryKey)}>
                            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                              <Checkbox
                                checked={isAllSelected}
                                ref={(el) => {
                                  if (el && 'indeterminate' in el) {
                                    (el as any).indeterminate = isPartiallySelected;
                                  }
                                }}
                                onCheckedChange={(checked) => toggleCategoryPermissions(categoryKey, checked as boolean)}
                                data-testid={`checkbox-category-${categoryKey}`}
                              />
                              <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left hover:bg-muted/50 rounded p-1 transition-colors">
                                <span className="text-lg">{category.icon}</span>
                                <span className="font-medium">{category.title}</span>
                                <Badge variant="secondary" className="ml-auto">
                                  {selectedInCategory}/{allInCategory}
                                </Badge>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </CollapsibleTrigger>
                            </div>
                            
                            <CollapsibleContent className="ml-4 mt-2 space-y-2">
                              {category.permissions.map((permission, permIndex) => {
                                const actualPermission = getPermissionById(permission.code!);
                                if (!actualPermission) return null;
                                
                                const isSelected = newRoleData.permissions.includes(actualPermission.id);
                                
                                return (
                                  <div key={permission.code} className="flex items-center space-x-3 p-2 hover:bg-muted/30 rounded" 
                                       title={`Permission Code: ${permission.code}`}
                                       data-testid={`permission-${permission.code}`}>
                                    <Checkbox
                                      id={actualPermission.id}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => handleSmartPermissionToggle(permission.code!, checked as boolean)}
                                      data-testid={`checkbox-permission-${permission.code}`}
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor={actualPermission.id} className="text-sm font-medium cursor-pointer">
                                        {permission.name}
                                      </Label>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">{actualPermission.description}</p>
                                        {permission.defaultFor && (
                                          <Badge variant="outline" className="text-xs">
                                            {isSelected ? "All Access" : `Own Access (${permission.defaultFor.map(code => code.split('.').pop()).join(', ')})`}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                    
                    {searchTerm && filteredCategories.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No permissions found matching "{searchTerm}"
                      </div>
                    )}
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRoleForAudit(role.id);
                            setShowAuditDialog(true);
                          }}
                          title="View Audit History"
                          data-testid={`button-audit-role-${role.id}`}
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCloneSourceRole(role);
                            setShowCloneDialog(true);
                          }}
                          title="Clone Role"
                          data-testid={`button-clone-role-${role.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>

                        {!role.isSystemRole && (
                          <PermissionGuard permission={PERMISSIONS.ROLE_MANAGE}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                              title="Edit Role"
                              data-testid={`button-edit-role-${role.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </PermissionGuard>
                        )}
                      </div>
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

        {/* Enterprise Feature Dialogs */}
        
        {/* Audit Logs Dialog */}
        <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="dialog-audit-logs">
            <DialogHeader>
              <DialogTitle>Audit History</DialogTitle>
              <DialogDescription>
                Track all changes made to roles and permissions
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {auditLogsLoading ? (
                <div className="text-center py-4">Loading audit logs...</div>
              ) : auditLogs?.logs?.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.logs.map((log) => (
                    <div key={log.id} className="p-4 border rounded-lg" data-testid={`audit-log-${log.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.action.includes('created') ? 'default' : log.action.includes('deleted') ? 'destructive' : 'secondary'}>
                            {log.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          by {log.user?.email || 'Unknown User'}
                        </span>
                      </div>
                      
                      {log.diff && (
                        <div className="text-xs bg-muted p-2 rounded font-mono">
                          <pre>{JSON.stringify(log.diff, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No audit logs found
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Role Cloning Dialog */}
        <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
          <DialogContent data-testid="dialog-clone-role">
            <DialogHeader>
              <DialogTitle>Clone Role</DialogTitle>
              <DialogDescription>
                Create a new role based on {cloneSourceRole?.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Role Name</Label>
                <Input
                  placeholder="Enter new role name"
                  value={newRoleData.name}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-clone-role-name"
                />
              </div>
              
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Enter role description"
                  value={newRoleData.description}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="input-clone-role-description"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => {
                    if (cloneSourceRole && newRoleData.name) {
                      cloneRoleMutation.mutate({
                        sourceRoleId: cloneSourceRole.id,
                        name: newRoleData.name,
                        description: newRoleData.description
                      });
                    }
                  }}
                  disabled={!newRoleData.name || cloneRoleMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm-clone"
                >
                  {cloneRoleMutation.isPending ? "Cloning..." : "Clone Role"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCloneDialog(false);
                    setNewRoleData({ name: "", description: "", permissions: [] });
                  }}
                  data-testid="button-cancel-clone"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Role Templates Dialog */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="max-w-4xl" data-testid="dialog-role-templates">
            <DialogHeader>
              <DialogTitle>Create Role from Template</DialogTitle>
              <DialogDescription>
                Choose a pre-configured role template to get started quickly
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {templatesLoading ? (
                <div className="text-center py-4">Loading templates...</div>
              ) : (
                <div className="grid gap-4">
                  {roleTemplates.map((template) => (
                    <div key={template.id} className="p-4 border rounded-lg hover:bg-muted/50" data-testid={`template-${template.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{template.name}</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const roleName = prompt(`Enter name for new role based on "${template.name}":`);
                            if (roleName) {
                              createFromTemplateMutation.mutate({
                                template,
                                name: roleName,
                                description: template.description
                              });
                            }
                          }}
                          disabled={createFromTemplateMutation.isPending}
                          data-testid={`button-use-template-${template.id}`}
                        >
                          Use Template
                        </Button>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      
                      <div className="text-xs">
                        <span className="font-medium">Permissions: </span>
                        {template.permissions === "all" ? (
                          <Badge variant="default">All Permissions</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {Array.isArray(template.permissions) ? template.permissions.length : 0} permissions
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}