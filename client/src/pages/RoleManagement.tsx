import AdminLayout from "@/components/AdminLayout";
import { UnifiedUserManagement } from "@/components/UnifiedUserManagement";

export default function RoleManagement() {
  return (
    <AdminLayout title="User Management" subtitle="Manage users, roles, and permissions">
      <UnifiedUserManagement />
    </AdminLayout>
  );
}