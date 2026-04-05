import { Suspense } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import DashboardStats from "@/components/admin/dashboard-stats";
import { SimpleLoading } from "@/components/ui/loading";

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <div className="w-1 h-5 bg-indigo-600 dark:bg-violet-600 rounded-full" />
          <h1 className="text-xl font-semibold text-foreground">管理概览</h1>
        </div>
        <Suspense fallback={<SimpleLoading />}>
          <DashboardStats />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
