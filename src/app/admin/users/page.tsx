import { db } from "@/lib/db";
import { requirePagePermission, ROLE_LABELS } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/admin/page-header";
import { CreateUserForm } from "./create-user-form";
import { UserRowActions } from "./user-row-actions";

export const metadata = { title: "Users" };

const ROLE_ORDER = { SUPERUSER: 0, ADMIN: 1, STAFF: 2 } as const;

export default async function UsersPage() {
  const currentUser = await requirePagePermission("users.manage");

  const users = (
    await db.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
      orderBy: { name: "asc" },
    })
  ).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return (
    <>
      <PageHeader title="Users" description="Create staff accounts, change roles and manage access." />

      <section aria-labelledby="add-user" className="mb-8 rounded-lg border border-forest/10 bg-white p-6">
        <h2 id="add-user" className="mb-4 font-serif text-lg text-forest">
          Add a user
        </h2>
        <CreateUserForm />
      </section>

      <section aria-labelledby="all-users" className="rounded-lg border border-forest/10 bg-white">
        <h2 id="all-users" className="px-6 pt-6 font-serif text-lg text-forest">
          All users
        </h2>
        <div className="overflow-x-auto p-6 pt-4">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-forest/10 text-xs uppercase tracking-wide text-charcoal-light">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">User</th>
                <th scope="col" className="py-2 pr-4 font-medium">Role</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Last sign-in</th>
                <th scope="col" className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                return (
                  <tr key={user.id} className="align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-charcoal">
                        {user.name}
                        {isSelf && <span className="ml-1 text-xs font-normal text-charcoal-light">(you)</span>}
                      </p>
                      <p className="text-charcoal-light">{user.email}</p>
                    </td>
                    <td className="py-3 pr-4">{ROLE_LABELS[user.role]}</td>
                    <td className="py-3 pr-4">
                      <span className={user.isActive ? "text-success" : "text-charcoal-light"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-charcoal-light">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                    </td>
                    <td className="py-3">
                      <UserRowActions
                        user={{ id: user.id, name: user.name, role: user.role, isActive: user.isActive }}
                        isSelf={isSelf}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
