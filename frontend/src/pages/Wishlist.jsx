import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from '../api';
import ProductCard from '../components/ProductCard';
import { Breadcrumb, EmptyState, Spinner } from '../components/ui';
import { Heart } from '../components/Icons';
import { useAuthStore } from '../store/authStore';

export default function Wishlist() {
  const user = useAuthStore((s) => s.user);
  const wishlist = user?.wishlist;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    userApi
      .wishlist()
      .then((res) => alive && setProducts(res.data))
      .catch(() => alive && setProducts([]))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // Refetch when the user toggles a heart elsewhere in the app.
  }, [wishlist]);

  return (
    <div className="container">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Wishlist' }]} />
      <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>My Wishlist</h1>

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Heart size={30} />}
          title="Your wishlist is empty"
          message="Tap the heart on any product to save it for later."
          action={<Link to="/products" className="btn btn-primary">Browse products</Link>}
        />
      ) : (
        <div className="product-grid">
          {products.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}
