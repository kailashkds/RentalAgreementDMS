import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PermissionGuard } from "./PermissionGuard";
import { 
  Shield, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy,
  ChevronDown,
  ChevronRight,
  Settings,
  Users,
  FileText,
  Download,
  Share,
  Eye,
  UserCheck,
  Briefcase
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface Permission {
  id: string;
  code: string;
  description: string;
}

interface PermissionCategory {
  title: string;
  icon: any;
  basePermissions: string[];
  ownPermissions: string[];
  allPermissions: string[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    title: "Agreements",
    icon: FileText,
    basePermissions: ["agreement.create", "agreement.notarize"],
    ownPermissions: ["agreement.view.own", "agreement.edit.own", "agreement.delete.own"],
    allPermissions: ["agreement.view.all", "agreement.edit.all", "agreement.delete.all"],
  },
  {
    title: "Notarized Agreements",
    icon: Shield,
    basePermissions: [],
    ownPermissions: ["agreement.view.notarized.own", "agreement.edit.notarized.own"],
    allPermissions: ["agreement.view.notarized.all", "agreement.edit.notarized.all"],
  },
  {
    title: "Sensitive Information",
    icon: Eye,
    basePermissions: ["view.sensitive.info"],
    ownPermissions: [],
    allPermissions: [],
  },
  {
    title: "Downloads & Sharing",
    icon: Download,
    basePermissions: [],
    ownPermissions: ["download.agreement.own", "share.agreement.own"],
    allPermissions: ["download.agreement.all", "share.agreement.all"],
  },
  {
    title: "Users",
    icon: Users,
    basePermissions: ["user.create"],
    ownPermissions: ["user.view.own", "user.edit.own", "user.delete.own"],
    allPermissions: ["user.view.all", "user.edit.all", "user.delete.all", "user.manage"],
  },
  {
    title: "Customers",
    icon: UserCheck,
    basePermissions: ["customer.create"],
    ownPermissions: [],
    allPermissions: ["customer.view.all", "customer.edit.all", "customer.delete.all", "customer.manage"],
  },
  {
    title: "Roles",
    icon: Shield,
    basePermissions: [],
    ownPermissions: [],
    allPermissions: ["role.manage", "role.assign"],
  },
  {
    title: "Templates",
    icon: Briefcase,
    basePermissions: ["template.create", "template.edit"],
    ownPermissions: [],
    allPermissions: ["template.manage", "template.delete"],
  },
  {
    title: "System",
    icon: Settings,
    basePermissions: ["dashboard.view"],
    ownPermissions: [],
    allPermissions: ["system.admin"],
  },
];

export function EnhancedRoleManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    PERMISSION_CATEGORIES.map(cat => cat.title)
  );
  
  const [roleData, setRoleData] = useState({
    name: "",
    description: "",
    permissions: new Set<string>(),
  });
  
  // Local state for permission toggles (immediate updates)
  const [localPermissionState, setLocalPermissionState] = useState<Map<string, Set<string>>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch roles and permissions
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/rbac/roles'],
  }) as { data: Role[]; isLoading: boolean };

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['/api/rbac/permissions'],
  }) as { data: Permission[]; isLoading: boolean };

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: typeof roleData) => {
      const response = await apiRequest('/api/rbac/roles', 'POST', {
        name: data.name,
        description: data.description,
      });
      const role = await response.json();
      
      // Assign permissions
      const permissionArray = Array.from(data.permissions);
      for (const permissionId of permissionArray) {
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
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: string; data: typeof roleData }) => {
      await apiRequest(`/api/rbac/roles/${roleId}`, 'PUT', {
        name: data.name,
        description: data.description,
      });
      
      // Get current permissions
      const currentPermissions = selectedRole?.permissions || [];
      
      // Remove all current permissions
      for (const permission of currentPermissions) {
        await apiRequest('/api/rbac/remove-role-permission', 'DELETE', {
          roleId,
          permissionId: permission.id,
        });
      }
      
      // Assign new permissions
      const permissionArray = Array.from(data.permissions);
      for (const permissionId of permissionArray) {
        await apiRequest('/api/rbac/assign-role-permission', 'POST', {
          roleId,
          permissionId,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      resetForm();
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return await apiRequest(`/api/rbac/roles/${roleId}`, 'DELETE');
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRoleData({
      name: "",
      description: "",
      permissions: new Set(),
    });
    setSelectedRole(null);
  };

  // Save all permission changes to database
  const saveAllPermissionChanges = useMutation({
    mutationFn: async () => {
      const changes = Array.from(localPermissionState.entries());
      
      for (const [roleId, newPermissions] of changes) {
        const originalRole = roles.find(r => r.id === roleId);
        const originalPermissions = new Set(originalRole?.permissions.map(p => p.id) || []);
        
        // Determine changes
        const toAdd = Array.from(newPermissions).filter(p => !originalPermissions.has(p));
        const toRemove = Array.from(originalPermissions).filter(p => !newPermissions.has(p));
        
        // Remove permissions
        for (const permissionId of toRemove) {
          await apiRequest('/api/rbac/remove-role-permission', 'DELETE', {
            roleId,
            permissionId,
          });
        }
        
        // Add permissions
        for (const permissionId of toAdd) {
          await apiRequest('/api/rbac/assign-role-permission', 'POST', {
            roleId,
            permissionId,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "All permission changes saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      setLocalPermissionState(new Map());
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save permission changes",
        variant: "destructive",
      });
    },
  });

  // Discard unsaved changes
  const discardChanges = () => {
    setLocalPermissionState(new Map());
    setHasUnsavedChanges(false);
  };

  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setRoleData({
      name: role.name,
      description: role.description,
      permissions: new Set(role.permissions.map(p => p.id)),
    });
    setShowEditDialog(true);
  };

  const openCloneDialog = (role: Role) => {
    setSelectedRole(role);
    setRoleData({
      name: `${role.name} (Copy)`,
      description: role.description,
      permissions: new Set(role.permissions.map(p => p.id)),
    });
    setShowCloneDialog(true);
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getCategoryPermissions = (category: PermissionCategory) => {
    const basePermissions = permissions.filter(p => 
      category.basePermissions.includes(p.code)
    );
    const ownPermissions = permissions.filter(p => 
      category.ownPermissions.includes(p.code)
    );
    const allPermissions = permissions.filter(p => 
      category.allPermissions.includes(p.code)
    );
    
    return { basePermissions, ownPermissions, allPermissions };
  };

  const handleCategoryToggle = (category: PermissionCategory, useAllPermissions: boolean) => {
    const { ownPermissions, allPermissions } = getCategoryPermissions(category);
    const newPermissions = new Set(roleData.permissions);
    
    if (useAllPermissions) {
      // Add all permissions, remove own permissions
      ownPermissions.forEach(p => newPermissions.delete(p.id));
      allPermissions.forEach(p => newPermissions.add(p.id));
    } else {
      // Add own permissions, remove all permissions
      allPermissions.forEach(p => newPermissions.delete(p.id));
      ownPermissions.forEach(p => newPermissions.add(p.id));
    }
    
    setRoleData({ ...roleData, permissions: newPermissions });
  };

  const getCategoryStatus = (category: PermissionCategory) => {
    const { ownPermissions, allPermissions } = getCategoryPermissions(category);
    const hasOwnPermissions = ownPermissions.some(p => roleData.permissions.has(p.id));
    const hasAllPermissions = allPermissions.some(p => roleData.permissions.has(p.id));
    
    if (hasAllPermissions) return "all";
    if (hasOwnPermissions) return "own";
    return "none";
  };

  const handlePermissionToggle = (permissionId: string) => {
    const newPermissions = new Set(roleData.permissions);
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId);
    } else {
      newPermissions.add(permissionId);
    }
    setRoleData({ ...roleData, permissions: newPermissions });
  };

  // Handle immediate permission toggle for existing roles
  const handleRolePermissionToggle = (roleId: string, permissionId: string) => {
    const currentRolePermissions = localPermissionState.get(roleId) || new Set(
      roles.find(r => r.id === roleId)?.permissions.map(p => p.id) || []
    );
    
    const newPermissions = new Set(currentRolePermissions);
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId);
    } else {
      newPermissions.add(permissionId);
    }
    
    setLocalPermissionState(prev => new Map(prev.set(roleId, newPermissions)));
    setHasUnsavedChanges(true);
  };

  // Get effective permissions for a role (local state or original)
  const getEffectivePermissions = (roleId: string) => {
    const localPerms = localPermissionState.get(roleId);
    if (localPerms) return localPerms;
    
    const role = roles.find(r => r.id === roleId);
    return new Set(role?.permissions.map(p => p.id) || []);
  };

  const renderPermissionForm = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Role Name *</Label>
          <Input
            id="name"
            value={roleData.name}
            onChange={(e) => setRoleData({ ...roleData, name: e.target.value })}
            placeholder="Enter role name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={roleData.description}
            onChange={(e) => setRoleData({ ...roleData, description: e.target.value })}
            placeholder="Enter role description"
            rows={3}
          />
        </div>
      </div>

      <Separator />
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Permissions</h4>
          <div className="text-xs text-muted-foreground">
            Unchecked = Own permissions only • Checked = All permissions
          </div>
        </div>
        
        {PERMISSION_CATEGORIES.map((category) => {
          const { basePermissions, ownPermissions, allPermissions } = getCategoryPermissions(category);
          const categoryStatus = getCategoryStatus(category);
          const Icon = category.icon;
          const isExpanded = expandedCategories.includes(category.title);
          
          return (
            <Card key={category.title} className="border-l-4 border-l-primary/20">
              <CardHeader className="pb-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleCategoryExpansion(category.title)}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-medium">{category.title}</span>
                        <div className="flex items-center space-x-2">
                          {categoryStatus !== "none" && (
                            <Badge variant={categoryStatus === "all" ? "default" : "secondary"}>
                              {categoryStatus === "all" ? "All" : "Own"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(ownPermissions.length > 0 || allPermissions.length > 0) && (
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs">Scope:</Label>
                            <Checkbox
                              checked={categoryStatus === "all"}
                              onCheckedChange={(checked) => 
                                handleCategoryToggle(category, checked as boolean)
                              }
                              disabled={ownPermissions.length === 0 && allPermissions.length === 0}
                            />
                            <span className="text-xs">All</span>
                          </div>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3">
                      {/* Base Permissions */}
                      {basePermissions.length > 0 && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">
                            Basic Actions
                          </Label>
                          <div className="grid grid-cols-1 gap-2 mt-1">
                            {basePermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={permission.id}
                                  checked={roleData.permissions.has(permission.id)}
                                  onCheckedChange={() => handlePermissionToggle(permission.id)}
                                />
                                <Label htmlFor={permission.id} className="text-sm">
                                  {permission.description}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Own vs All Permissions */}
                      {(ownPermissions.length > 0 || allPermissions.length > 0) && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">
                            Access Scope
                          </Label>
                          <div className="space-y-2 mt-1">
                            {ownPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2 pl-4">
                                <Checkbox
                                  id={permission.id}
                                  checked={roleData.permissions.has(permission.id)}
                                  onCheckedChange={() => handlePermissionToggle(permission.id)}
                                />
                                <Label htmlFor={permission.id} className="text-sm">
                                  {permission.description}
                                </Label>
                                <Badge variant="outline" className="text-xs">Own</Badge>
                              </div>
                            ))}
                            {allPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2 pl-4">
                                <Checkbox
                                  id={permission.id}
                                  checked={roleData.permissions.has(permission.id)}
                                  onCheckedChange={() => handlePermissionToggle(permission.id)}
                                />
                                <Label htmlFor={permission.id} className="text-sm">
                                  {permission.description}
                                </Label>
                                <Badge variant="default" className="text-xs">All</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Selected Permissions Preview */}
      {roleData.permissions.size > 0 && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">Selected Permissions ({roleData.permissions.size})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Array.from(roleData.permissions).map((permissionId) => {
                const permission = permissions.find(p => p.id === permissionId);
                return permission ? (
                  <Badge key={permissionId} variant="secondary" className="text-xs">
                    {permission.code}
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
            <p className="text-muted-foreground">
              Create and manage roles with smart permission defaults
            </p>
          </div>
        </div>

        <PermissionGuard permission="role.manage">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Create a new role with customized permissions. Use smart defaults for quick setup.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createRoleMutation.mutate(roleData); }}>
                {renderPermissionForm()}
                <div className="flex justify-end space-x-2 mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRoleMutation.isPending}>
                    {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGuard>
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  You have unsaved permission changes
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={discardChanges}
                  data-testid="button-discard-changes"
                >
                  Discard Changes
                </Button>
                <Button 
                  size="sm"
                  onClick={() => saveAllPermissionChanges.mutate()}
                  disabled={saveAllPermissionChanges.isPending}
                  data-testid="button-save-changes"
                >
                  {saveAllPermissionChanges.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles ({roles.length})</CardTitle>
          <CardDescription>
            Manage roles and their permissions. Toggle permissions instantly and save when ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="text-center py-8">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles found
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <Card key={role.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-lg">{role.name}</div>
                        {role.description && (
                          <div className="text-sm text-muted-foreground">{role.description}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {getEffectivePermissions(role.id).size} permissions
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermissionGuard permission="role.manage">
                              <DropdownMenuItem onClick={() => openEditDialog(role)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Role Details
                              </DropdownMenuItem>
                            </PermissionGuard>
                            <PermissionGuard permission="role.manage">
                              <DropdownMenuItem onClick={() => openCloneDialog(role)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Clone
                              </DropdownMenuItem>
                            </PermissionGuard>
                            <PermissionGuard permission="role.manage">
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
                                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the role "{role.name}"? This action cannot be undone.
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
                            </PermissionGuard>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {PERMISSION_CATEGORIES.map((category) => {
                        const { basePermissions, ownPermissions, allPermissions } = getCategoryPermissions(category);
                        const effectivePermissions = getEffectivePermissions(role.id);
                        const Icon = category.icon;
                        
                        // Check if this category has any permissions for this role
                        const categoryPermissions = [...basePermissions, ...ownPermissions, ...allPermissions];
                        const hasAnyPermissions = categoryPermissions.some(p => effectivePermissions.has(p.id));
                        
                        if (categoryPermissions.length === 0) return null;
                        
                        return (
                          <div key={category.title} className="border rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-3">
                              <Icon className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{category.title}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {basePermissions.map((permission) => (
                                <div key={permission.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${role.id}-${permission.id}`}
                                    checked={effectivePermissions.has(permission.id)}
                                    onCheckedChange={() => handleRolePermissionToggle(role.id, permission.id)}
                                    data-testid={`toggle-${role.name}-${permission.code}`}
                                  />
                                  <Label htmlFor={`${role.id}-${permission.id}`} className="text-xs cursor-pointer">
                                    {permission.description}
                                  </Label>
                                </div>
                              ))}
                              {ownPermissions.map((permission) => (
                                <div key={permission.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${role.id}-${permission.id}`}
                                    checked={effectivePermissions.has(permission.id)}
                                    onCheckedChange={() => handleRolePermissionToggle(role.id, permission.id)}
                                    data-testid={`toggle-${role.name}-${permission.code}`}
                                  />
                                  <Label htmlFor={`${role.id}-${permission.id}`} className="text-xs cursor-pointer">
                                    {permission.description}
                                  </Label>
                                  <Badge variant="outline" className="text-xs">Own</Badge>
                                </div>
                              ))}
                              {allPermissions.map((permission) => (
                                <div key={permission.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${role.id}-${permission.id}`}
                                    checked={effectivePermissions.has(permission.id)}
                                    onCheckedChange={() => handleRolePermissionToggle(role.id, permission.id)}
                                    data-testid={`toggle-${role.name}-${permission.code}`}
                                  />
                                  <Label htmlFor={`${role.id}-${permission.id}`} className="text-xs cursor-pointer">
                                    {permission.description}
                                  </Label>
                                  <Badge variant="default" className="text-xs">All</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role permissions and settings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            selectedRole && updateRoleMutation.mutate({ roleId: selectedRole.id, data: roleData }); 
          }}>
            {renderPermissionForm()}
            <div className="flex justify-end space-x-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clone Role Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clone Role</DialogTitle>
            <DialogDescription>
              Create a new role based on an existing one.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createRoleMutation.mutate(roleData); }}>
            {renderPermissionForm()}
            <div className="flex justify-end space-x-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowCloneDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? "Cloning..." : "Clone Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}