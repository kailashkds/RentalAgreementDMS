import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Building2, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Login() {
  const [, navigate] = useLocation();
  const [adminData, setAdminData] = useState({
    username: "",
    password: "",
  });
  const [customerData, setCustomerData] = useState({
    mobile: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/auth/login", "POST", adminData);
      
      if (response.ok) {
        queryClient.clear();
        window.location.href = "/";
      } else {
        const data = await response.json();
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/auth/customer-login", "POST", customerData);
      
      if (response.ok) {
        queryClient.clear();
        window.location.href = "/";
      } else {
        const data = await response.json();
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="https://quickkaraar.com/images/logo.png" 
              alt="QuickKaraar" 
              className="h-16 w-auto"
            />
          </div>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Choose your account type and enter credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Admin
              </TabsTrigger>
              <TabsTrigger value="customer" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Customer
              </TabsTrigger>
            </TabsList>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <TabsContent value="admin">
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-username">Username</Label>
                  <Input
                    id="admin-username"
                    name="username"
                    type="text"
                    required
                    value={adminData.username}
                    onChange={handleAdminChange}
                    placeholder="Enter your username"
                    data-testid="input-admin-username"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    name="password"
                    type="password"
                    required
                    value={adminData.password}
                    onChange={handleAdminChange}
                    placeholder="Enter your password"
                    data-testid="input-admin-password"
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-admin-login">
                  {isLoading ? "Signing in..." : "Sign In as Admin"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="customer">
              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-mobile">Phone Number</Label>
                  <Input
                    id="customer-mobile"
                    name="mobile"
                    type="tel"
                    required
                    value={customerData.mobile}
                    onChange={handleCustomerChange}
                    placeholder="Enter your phone number"
                    data-testid="input-customer-mobile"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customer-password">Password</Label>
                  <Input
                    id="customer-password"
                    name="password"
                    type="password"
                    required
                    value={customerData.password}
                    onChange={handleCustomerChange}
                    placeholder="Enter your password"
                    data-testid="input-customer-password"
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-customer-login">
                  {isLoading ? "Signing in..." : "Sign In as Customer"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}