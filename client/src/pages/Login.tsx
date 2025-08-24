import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Login() {
  const [, navigate] = useLocation();
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Determine if input is a phone number or username
      const isPhoneNumber = /^\d+$/.test(loginData.username);
      const requestData = isPhoneNumber 
        ? { mobile: loginData.username, password: loginData.password }
        : { username: loginData.username, password: loginData.password };

      const response = await apiRequest("/api/auth/login", "POST", requestData);
      
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData(prev => ({
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
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username or Phone Number</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={loginData.username}
                  onChange={handleChange}
                  placeholder="Enter your username or phone number"
                  data-testid="input-username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={loginData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  data-testid="input-password"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}