import { useCallback, useEffect, useState } from 'react';
import { reviewApi } from '../api';
import { Badge, ConfirmModal, Empty, Pagination, Spinner } from '../components/ui';
import { Star2, StarFilled, Star, Trash, Check, X } from '../components/Icons';
import { useToastStore } from '../store';
import { formatDate } from '../utils/format';

function Stars({ value }) {
  return (
    <span className="row gap-4" style={{ color: 'var(--amber-500)' }}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= value ? <StarFilled key={i} size={13} /> : <Star key={i} size={13} style={{ color: 'var(--ink-300)' }} />,
      )}
    </span>
  );
}

export default function ReviewsPage() {
  const toast = useToastStore();

  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    reviewApi
      .list({ approved, rating, page, limit: 20 })
      .then((res) => {
        setReviews(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, rating, page]);

  useEffect(load, [load]);

  async function moderate(review, isApproved) {
    setReviews((list) => list.map((r) => (r._id === review._id ? { ...r, isApproved } : r)));
    try {
      const res = await reviewApi.moderate(review._id, isApproved);
      toast.success(res.message);
    } catch (err) {
      setReviews((list) => list.map((r) => (r._id === review._id ? { ...r, isApproved: !isApproved } : r)));
      toast.error(err.message);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await reviewApi.remove(deleteTarget._id);
      toast.success('Review deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reviews</h1>
          <p>{pagination.total} review(s)</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="tabs">
            {[
              { value: '', label: 'All' },
              { value: 'true', label: 'Published' },
              { value: 'false', label: 'Hidden' },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                className={`tab-chip ${approved === t.value ? 'active' : ''}`}
                onClick={() => {
                  setApproved(t.value);
                  setPage(1);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            className="select"
            value={rating}
            onChange={(e) => {
              setRating(e.target.value);
              setPage(1);
            }}
            style={{ width: 150 }}
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>{r} stars</option>
            ))}
          </select>
        </div>

        {loading ? (
          <Spinner />
        ) : reviews.length === 0 ? (
          <Empty icon={<Star2 size={26} />} title="No reviews found" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Review</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <div className="row gap-8">
                          <img className="thumb" src={r.product?.images?.[0]} alt="" />
                          <span className="truncate" style={{ maxWidth: 160 }}>{r.product?.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="bold">{r.user?.name}</div>
                        {r.isVerifiedPurchase ? (
                          <span className="badge badge-ok"><Check size={10} /> Verified</span>
                        ) : null}
                      </td>
                      <td><Stars value={r.rating} /></td>
                      <td style={{ maxWidth: 280 }}>
                        {r.title ? <div className="bold small">{r.title}</div> : null}
                        <div className="tiny muted truncate">{r.comment}</div>
                      </td>
                      <td className="muted">{formatDate(r.createdAt)}</td>
                      <td>
                        <Badge tone={r.isApproved ? 'ok' : 'muted'}>
                          {r.isApproved ? 'Published' : 'Hidden'}
                        </Badge>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => moderate(r, !r.isApproved)}
                            aria-label={r.isApproved ? 'Hide review' : 'Publish review'}
                            title={r.isApproved ? 'Hide review' : 'Publish review'}
                          >
                            {r.isApproved ? <X size={15} /> : <Check size={15} />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-icon"
                            onClick={() => setDeleteTarget(r)}
                            aria-label="Delete review"
                          >
                            <Trash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onChange={setPage}
            />
          </>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete review"
        message="Delete this review permanently? The product rating will be recalculated."
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </>
  );
}
