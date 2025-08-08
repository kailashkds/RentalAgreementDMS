import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Database, Mail, Bell, Shield, Globe } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoBackup: boolean;
  maintenanceMode: boolean;
  defaultLanguage: string;
}

export default function SystemSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: "QuickKaraar",
    companyAddress: "Mumbai, India",
    companyPhone: "+91 9876543210",
    companyEmail: "admin@quickkaraar.com",
    emailNotifications: true,
    smsNotifications: true,
    autoBackup: true,
    maintenanceMode: false,
    defaultLanguage: "en",
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (settingsData: SystemSettings) => 
      apiRequest("PUT", "/api/admin/settings", settingsData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "System settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate(settings);
  };

  const handleChange = (field: keyof SystemSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AdminLayout title="System Settings" subtitle="Configure system-wide settings and preferences">
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground">
              Configure system-wide settings and preferences
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Company Information</span>
              </CardTitle>
              <CardDescription>
                Basic company details used in documents and communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={settings.companyEmail}
                    onChange={(e) => handleChange("companyEmail", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Company Phone</Label>
                  <Input
                    id="companyPhone"
                    value={settings.companyPhone}
                    onChange={(e) => handleChange("companyPhone", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultLanguage">Default Language</Label>
                  <select
                    id="defaultLanguage"
                    value={settings.defaultLanguage}
                    onChange={(e) => handleChange("defaultLanguage", e.target.value)}
                    className="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="gu">Gujarati</option>
                    <option value="ta">Tamil</option>
                    <option value="mr">Marathi</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Company Address</Label>
                <Input
                  id="companyAddress"
                  value={settings.companyAddress}
                  onChange={(e) => handleChange("companyAddress", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Settings</span>
              </CardTitle>
              <CardDescription>
                Configure how the system sends notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Email Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Send notifications via email
                  </div>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleChange("emailNotifications", checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">SMS Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Send notifications via SMS
                  </div>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(checked) => handleChange("smsNotifications", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* System Maintenance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>System Maintenance</span>
              </CardTitle>
              <CardDescription>
                Database backup and maintenance settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Auto Backup</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically backup database daily
                  </div>
                </div>
                <Switch
                  checked={settings.autoBackup}
                  onCheckedChange={(checked) => handleChange("autoBackup", checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Maintenance Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Temporarily disable public access
                  </div>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => handleChange("maintenanceMode", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveSettingsMutation.isPending}>
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}