import AdminLayout from "@/components/AdminLayout";
import { EnhancedRoleManagement } from "@/components/EnhancedRoleManagement";

export default function EnhancedRoleManagementPage() {
  return (
    <AdminLayout title="Role Management" subtitle="Create and manage roles with smart permission defaults">
      <EnhancedRoleManagement />
    </AdminLayout>
  );
}