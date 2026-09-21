import { useCallback, useEffect, useState } from 'react';
import { staffApi } from '../api';
import { Badge, ConfirmModal, Empty, Modal, Pagination, Spinner, Switch } from '../components/ui';
import { Plus, Trash, Settings, Search } from '../components/Icons';
import { formatDateTime } from '../utils/format';
import { useToastStore } from '../store';
import { useI18n } from '../i18n';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'manager',
  permissions: [],
  isActive: true,
};

/**
 * Staff administration, visible only to a super admin.
 *
 * The role decides the tier, the permission checkboxes decide which panel
 * sections the account may use. Both are enforced server-side; what this page
 * does is make the current grant legible and editable.
 */
export default function AdministratorsPage() {
  const { t } = useI18n();
  const toast = useToastStore();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [options, setOptions] = useState({ roles: [], permissions: [] });
  const [query, setQuery] = useState({ page: 1, search: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(null); // null | {} (new) | staff row
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffApi.list(query);
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    staffApi.options()
      .then((res) => setOptions(res.data))
      .catch(() => setOptions({ roles: ['manager', 'admin'], permissions: [] }));
  }, []);

  function openNew() {
    setError('');
    setForm(EMPTY_FORM);
    setEditing({});
  }

  function openEdit(row) {
    setError('');
    setForm({
      name: row.name,
      email: row.email,
      // Left blank on purpose: an empty field means "keep the current
      // password", which is what the server does with it.
      password: '',
      phone: row.phone || '',
      role: row.role,
      permissions: row.permissions || [],
      isActive: row.isActive,
    });
    setEditing(row);
  }

  function togglePermission(permission) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(permission)
        ? f.permissions.filter((p) => p !== permission)
        : [...f.permissions, permission],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const isNew = editing && !editing._id;
      if (isNew) {
        const res = await staffApi.create(form);
        toast.success(res.message);
      } else {
        const { email, password, ...rest } = form;
        // Email is the account's identity and is not editable here; password
        // only travels when the admin actually typed a new one.
        const res = await staffApi.update(editing._id, password ? { ...rest, password } : rest);
        toast.success(res.message);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      const res = await staffApi.remove(confirm._id);
      toast.success(res.message);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isNew = editing && !editing._id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('staff.title')}</h1>
          <p>{t('staff.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Plus size={15} /> {t('staff.add')}
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box">
            <Search size={15} />
            <input
              className="input"
              placeholder={t('staff.searchPlaceholder')}
              value={query.search}
              onChange={(e) => setQuery({ page: 1, search: e.target.value })}
            />
          </div>
        </div>

        {loading ? <Spinner label={t('common.loading')} /> : rows.length === 0 ? (
          <Empty
            icon={<Settings size={22} />}
            title={t('staff.emptyTitle')}
            message={t('staff.emptyMessage')}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('staff.colName')}</th>
                    <th>{t('staff.colRole')}</th>
                    <th>{t('staff.colPermissions')}</th>
                    <th>{t('staff.colStatus')}</th>
                    <th>{t('staff.colLastLogin')}</th>
                    <th className="right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSuper = row.role === 'superadmin';
                    return (
                      <tr key={row._id}>
                        <td>
                          <div className="bold">{row.name}</div>
                          <div className="tiny muted">{row.email}</div>
                        </td>
                        <td>
                          <Badge tone={isSuper ? 'purple' : row.role === 'admin' ? 'info' : 'muted'}>
                            {t(`staff.role.${row.role}`)}
                          </Badge>
                        </td>
                        <td>
                          {/* A super admin holds everything implicitly, so
                              listing checkboxes for them would be misleading. */}
                          {isSuper ? (
                            <span className="small muted">{t('staff.allPermissions')}</span>
                          ) : row.permissions?.length ? (
                            <div className="row gap-4 wrap">
                              {row.permissions.map((p) => (
                                <Badge key={p} tone="ok">{t(`staff.permission.${p}`)}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="small muted">{t('staff.noPermissions')}</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={row.isActive ? 'ok' : 'muted'}>
                            {t(row.isActive ? 'common.active' : 'common.inactive')}
                          </Badge>
                        </td>
                        <td className="small muted">
                          {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : t('staff.never')}
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => openEdit(row)}
                              disabled={isSuper}
                              title={isSuper ? t('staff.superAdminLocked') : undefined}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-icon"
                              onClick={() => setConfirm(row)}
                              disabled={isSuper}
                              title={isSuper ? t('staff.superAdminLocked') : t('common.delete')}
                              aria-label={t('common.delete')}
                            >
                              <Trash size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onChange={(page) => setQuery((q) => ({ ...q, page }))}
            />
          </>
        )}
      </div>

      <Modal
        open={Boolean(editing)}
        title={isNew ? t('staff.add') : t('staff.editTitle', { name: editing?.name || '' })}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="staff-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('common.working') : t('common.save')}
            </button>
          </>
        }
      >
        <form id="staff-form" onSubmit={save}>
          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="staff-name">{t('staff.fieldName')}</label>
              <input
                id="staff-name"
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="staff-email">{t('staff.fieldEmail')}</label>
              <input
                id="staff-email"
                type="email"
                className="input"
                required
                disabled={!isNew}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {!isNew ? <p className="field-hint">{t('staff.emailLocked')}</p> : null}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="staff-password">{t('staff.fieldPassword')}</label>
              <input
                id="staff-password"
                type="password"
                className="input"
                required={isNew}
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="field-hint">
                {isNew ? t('staff.passwordHint') : t('staff.passwordEditHint')}
              </p>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="staff-role">{t('staff.fieldRole')}</label>
              <select
                id="staff-role"
                className="select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {options.roles.map((r) => (
                  <option key={r} value={r}>{t(`staff.role.${r}`)}</option>
                ))}
              </select>
              <p className="field-hint">{t('staff.roleHint')}</p>
            </div>
          </div>

          <div className="field">
            <span className="field-label">{t('staff.fieldPermissions')}</span>
            <p className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
              {t('staff.permissionsHint')}
            </p>
            <div className="permission-grid">
              {options.permissions.map((p) => (
                <label key={p} className="permission-option">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(p)}
                    onChange={() => togglePermission(p)}
                  />
                  <span>{t(`staff.permission.${p}`)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="row between gap-12">
            <div>
              <div className="field-label" style={{ marginBottom: 2 }}>{t('staff.fieldActive')}</div>
              <p className="field-hint" style={{ margin: 0 }}>{t('staff.activeHint')}</p>
            </div>
            <Switch
              checked={form.isActive}
              onChange={(v) => setForm({ ...form, isActive: v })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(confirm)}
        title={t('staff.deleteTitle')}
        message={t('staff.deleteMessage', { name: confirm?.name || '' })}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
        onClose={() => setConfirm(null)}
        busy={busy}
      />
    </>
  );
}
