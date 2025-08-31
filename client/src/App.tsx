import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import Agreements from "@/pages/Agreements";
import NotarizedDocuments from "@/pages/NotarizedDocuments";
import Customers from "@/pages/Customers";
import Properties from "@/pages/Properties";
import CustomerProperties from "@/pages/CustomerProperties";
import PropertyAgreements from "@/pages/PropertyAgreements";
import SystemSettings from "@/pages/SystemSettings";
import Profile from "@/pages/Profile";
import PdfTemplates from "@/pages/PdfTemplates";
import AgreementEditor from "@/pages/AgreementEditor";
import AgreementDetail from "@/pages/AgreementDetail";
import CreateAgreement from "@/pages/CreateAgreement";
import UserRoleManagement from "@/pages/UserRoleManagement";
import CustomerDashboard from "@/pages/CustomerDashboard";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

// Component to show access denied for customers
function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <CardTitle className="text-xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Protected route wrapper for permission-based pages
function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  // Remove role-based protection - use component-level permission guards instead
  return <Component />;
}

function AuthenticatedRouter() {
  const { user, isAuthenticated, isLoading, error } = useAuth();
  
  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || error) {
    return <Login />;
  }

  // Both Admin and Customer use the same routes, but with different navigation visibility
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agreements" component={Agreements} />
      <Route path="/notarized-documents" component={NotarizedDocuments} />
      <Route path="/customers" component={Customers} />
      <Route path="/properties" component={Properties} />
      <Route path="/customers/:customerId/properties" component={CustomerProperties} />
      <Route path="/customers/:customerId/properties/:propertyId/agreements" component={PropertyAgreements} />
      <Route path="/admin/user-role-management" component={UserRoleManagement} />
      <Route path="/settings" component={SystemSettings} />
      <Route path="/profile" component={Profile} />
      <Route path="/pdf-templates" component={() => <ProtectedRoute component={PdfTemplates} />} />
      <Route path="/agreement-editor" component={AgreementEditor} />
      <Route path="/create-agreement" component={CreateAgreement} />
      <Route path="/agreements/:id" component={AgreementDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
