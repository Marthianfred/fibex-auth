import { useState, useEffect, useCallback } from "react";
import { rolesApi, type CustomRole } from "../../lib/admin-api";
import { Shield, Plus, Trash2, Save } from "lucide-react";

const RESOURCE_ACTIONS: Record<string, string[]> = {
  user: [
    "create",
    "read",
    "list",
    "update",
    "delete",
    "ban",
    "unban",
    "impersonate",
    "set-password",
    "set-role",
  ],
};

export function RolesPage() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await rolesApi.list();
    if (res.data) setRoles(res.data.roles);
    else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const togglePermission = (role: CustomRole, resource: string, action: string) => {
    const perms = { ...(role.permissions || {}) };
    const list = [...(perms[resource] || [])];
    const idx = list.indexOf(action);
    if (idx === -1) list.push(action);
    else list.splice(idx, 1);
    perms[resource] = list;
    setRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permissions: perms } : r)));
  };

  const saveRole = async (role: CustomRole) => {
    setSaving(role.id);
    const res = await rolesApi.update(role.id, {
      name: role.name,
      description: role.description || undefined,
      permissions: role.permissions,
    });
    if (res.error) setError(res.error);
    setSaving(null);
  };

  const deleteRole = async (role: CustomRole) => {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    const res = await rolesApi.remove(role.id);
    if (res.error) setError(res.error);
    else fetchRoles();
  };

  const createRole = async () => {
    if (!newName.trim()) return;
    const res = await rolesApi.create({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      permissions: { user: ["read", "list"] },
    });
    if (res.error) setError(res.error);
    else {
      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      fetchRoles();
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define what each role can do
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Create role</h3>
          <div className="space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Role name (e.g. supervisor)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={createRole}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{role.name}</div>
                    <div className="text-xs text-gray-500">
                      {role.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveRole(role)}
                    disabled={saving === role.id || role.name === "super_admin"}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving === role.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => deleteRole(role)}
                    disabled={role.name === "super_admin"}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-md text-xs hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {Object.entries(RESOURCE_ACTIONS).map(([resource, actions]) => (
                <div key={resource} className="border-t border-gray-100 pt-3 mt-2">
                  <div className="text-xs font-semibold uppercase text-gray-500 mb-2">
                    {resource}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => {
                      const checked =
                        role.permissions?.[resource]?.includes(action) ?? false;
                      const locked = role.name === "super_admin";
                      return (
                        <label
                          key={action}
                          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                            checked
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => togglePermission(role, resource, action)}
                            className="rounded"
                          />
                          {action}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
