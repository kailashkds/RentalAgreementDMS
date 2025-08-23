import AdminLayout from "@/components/AdminLayout";
import { RoleManagement as RoleManagementComponent } from "@/components/RoleManagement";

export default function RoleManagement() {
  return (
    <AdminLayout title="Role Management" subtitle="Manage user roles and permissions">
      <RoleManagementComponent />
    </AdminLayout>
  );
}