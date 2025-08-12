import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import Agreements from "@/pages/Agreements";
import NotarizedDocuments from "@/pages/NotarizedDocuments";
import Customers from "@/pages/Customers";
import AdminUsers from "@/pages/AdminUsers";
import SystemSettings from "@/pages/SystemSettings";
import Profile from "@/pages/Profile";
import PdfTemplates from "@/pages/PdfTemplates";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

function AuthenticatedRouter() {
  const { isAuthenticated, isLoading, error } = useAuth();

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

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agreements" component={Agreements} />
      <Route path="/notarized-documents" component={NotarizedDocuments} />
      <Route path="/customers" component={Customers} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/settings" component={SystemSettings} />
      <Route path="/profile" component={Profile} />
      <Route path="/pdf-templates" component={PdfTemplates} />
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
