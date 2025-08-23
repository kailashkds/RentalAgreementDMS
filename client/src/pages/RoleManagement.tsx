import AdminLayout from "@/components/AdminLayout";
import { UserManagement } from "@/components/UserManagement";

export default function RoleManagement() {
  return (
    <AdminLayout title="User Management" subtitle="Manage users, roles, and permissions">
      <UserManagement />
    </AdminLayout>
  );
}