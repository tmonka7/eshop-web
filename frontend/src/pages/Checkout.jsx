import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orderApi, userApi } from '../api';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Spinner, EmptyState } from '../components/ui';
import { Check, CreditCard, MapPin, Package } from '../components/Icons';
import { currency, imageUrl } from '../utils/format';
import { PAYMENT_METHODS } from '../utils/constants';
import { useI18n } from '../i18n';

const emptyAddress = {
  fullName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Finland',
};

export default function Checkout() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const cart = useCartStore();
  const toast = useToastStore();

  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState({});

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [address, setAddress] = useState(emptyAddress);

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvc: '' });

  useEffect(() => {
    let alive = true;

    Promise.all([orderApi.preview(), userApi.addresses()])
      .then(([p, a]) => {
        if (!alive) return;
        setPreview(p.data);
        setAddresses(a.data);
        const def = a.data.find((x) => x.isDefault) || a.data[0];
        if (def) {
          setSelectedAddressId(def._id);
        } else {
          setUseNewAddress(true);
          setAddress((prev) => ({ ...prev, fullName: user?.name || '', phone: user?.phone || '' }));
        }
      })
      .catch((err) => {
        if (alive) toast.error(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // Refetch on a language change so the preview's product names follow it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function validateAddress() {
    const next = {};
    ['fullName', 'street', 'city', 'zipCode', 'country'].forEach((f) => {
      if (!String(address[f] || '').trim()) next[f] = t('common.required');
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validatePayment() {
    if (paymentMethod !== 'card') return true;
    const next = {};
    if (String(card.number).replace(/\D/g, '').length < 12) next.number = t('checkout.invalidCard');
    if (!card.name.trim()) next.name = t('common.required');
    if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(card.expiry)) next.expiry = t('checkout.useMMYY');
    if (!/^\d{3,4}$/.test(card.cvc)) next.cvc = t('checkout.cvcDigits');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (step === 1) {
      if (useNewAddress && !validateAddress()) return;
      if (!useNewAddress && !selectedAddressId) {
        toast.error(t('checkout.chooseAddress'));
        return;
      }
      setErrors({});
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validatePayment()) return;
      setErrors({});
      setStep(3);
    }
  }

  async function saveNewAddress() {
    const res = await userApi.addAddress(address);
    setAddresses(res.data);
    const created = res.data[res.data.length - 1];
    setSelectedAddressId(created._id);
    setUseNewAddress(false);
    setUser({ ...user, addresses: res.data });
    toast.success(t('toast.addressSaved'));
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const payload = {
        paymentMethod,
        ...(useNewAddress ? { shippingAddress: address } : { addressId: selectedAddressId }),
        ...(paymentMethod === 'card' ? { card: { number: card.number, name: card.name } } : {}),
      };
      const res = await orderApi.create(payload);
      await cart.load(true);
      navigate(`/order-success/${res.data.orderNumber}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
      setStep(2);
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return <Spinner label={t('checkout.preparing')} />;

  if (!preview || !preview.items.length) {
    return (
      <div className="container">
        <EmptyState
          icon={<Package size={30} />}
          title={t('checkout.emptyTitle')}
          message={t('checkout.emptyMessage')}
          action={<Link to="/products" className="btn btn-primary">{t('common.browseProducts')}</Link>}
        />
      </div>
    );
  }

  const totals = preview.totals;
  const selected = addresses.find((a) => a._id === selectedAddressId);

  return (
    <div className="container">
      <div className="steps">
        {[
          { n: 1, label: t('checkout.stepShipping') },
          { n: 2, label: t('checkout.stepPayment') },
          { n: 3, label: t('checkout.stepComplete') },
        ].map((s, i) => (
          <div key={s.n} className="row gap-8">
            <div className={`step ${step === s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}>
              <span className="num">{step > s.n ? <Check size={14} /> : s.n}</span>
              <span>{s.label}</span>
            </div>
            {i < 2 ? <span className="step-line" /> : null}
          </div>
        ))}
      </div>

      <div className="checkout-layout">
        <div>
          {step === 1 ? (
            <div className="card card-pad">
              <div className="row between mb-16">
                <h3 style={{ fontSize: '1.05rem' }}>
                  <span className="row gap-8"><MapPin size={17} /> {t('checkout.shippingAddress')}</span>
                </h3>
                {addresses.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setUseNewAddress((v) => !v)}
                  >
                    {useNewAddress ? t('checkout.useSavedAddress') : t('checkout.addNewAddress')}
                  </button>
                ) : null}
              </div>

              {!useNewAddress ? (
                <>
                  {addresses.map((a) => (
                    <label
                      key={a._id}
                      className={`address-option ${selectedAddressId === a._id ? 'active' : ''}`}
                    >
                      <div className="row gap-12">
                        <input
                          type="radio"
                          name="address"
                          checked={selectedAddressId === a._id}
                          onChange={() => setSelectedAddressId(a._id)}
                        />
                        <div>
                          <div className="bold small">
                            {a.fullName}
                            {a.isDefault ? <span className="badge badge-ok" style={{ marginLeft: 8 }}>{t('common.default')}</span> : null}
                          </div>
                          <div className="small muted">
                            {a.street}, {a.city} {a.zipCode}, {a.country}
                          </div>
                          {a.phone ? <div className="tiny muted">{a.phone}</div> : null}
                        </div>
                      </div>
                    </label>
                  ))}
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="field">
                      <label className="field-label" htmlFor="fullName">{t('checkout.fullName')}</label>
                      <input
                        id="fullName"
                        className={`input ${errors.fullName ? 'has-error' : ''}`}
                        value={address.fullName}
                        onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                      />
                      {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="phone">{t('checkout.phone')}</label>
                      <input
                        id="phone"
                        className="input"
                        value={address.phone}
                        onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="street">{t('checkout.addressField')}</label>
                    <input
                      id="street"
                      className={`input ${errors.street ? 'has-error' : ''}`}
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      placeholder={t('checkout.addressPlaceholder')}
                    />
                    {errors.street ? <span className="field-error">{errors.street}</span> : null}
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label className="field-label" htmlFor="city">{t('checkout.city')}</label>
                      <input
                        id="city"
                        className={`input ${errors.city ? 'has-error' : ''}`}
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      />
                      {errors.city ? <span className="field-error">{errors.city}</span> : null}
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="state">{t('checkout.state')}</label>
                      <input
                        id="state"
                        className="input"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="field">
                      <label className="field-label" htmlFor="zip">{t('checkout.zipCode')}</label>
                      <input
                        id="zip"
                        className={`input ${errors.zipCode ? 'has-error' : ''}`}
                        value={address.zipCode}
                        onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                      />
                      {errors.zipCode ? <span className="field-error">{errors.zipCode}</span> : null}
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="country">{t('checkout.country')}</label>
                      <input
                        id="country"
                        className={`input ${errors.country ? 'has-error' : ''}`}
                        value={address.country}
                        onChange={(e) => setAddress({ ...address, country: e.target.value })}
                      />
                      {errors.country ? <span className="field-error">{errors.country}</span> : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => validateAddress() && saveNewAddress().catch((e) => toast.error(e.message))}
                  >
                    {t('checkout.saveToMyAddresses')}
                  </button>
                </>
              )}

              <button type="button" className="btn btn-primary btn-lg btn-block mt-24" onClick={nextStep}>
                {t('checkout.continueToPayment')}
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="card card-pad">
              <h3 style={{ fontSize: '1.05rem', marginBottom: 16 }}>
                <span className="row gap-8"><CreditCard size={17} /> {t('checkout.paymentMethod')}</span>
              </h3>

              {PAYMENT_METHODS.map((m) => (
                <label key={m.value} className={`pay-option ${paymentMethod === m.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === m.value}
                    onChange={() => setPaymentMethod(m.value)}
                  />
                  <div className="grow">
                    <div className="bold small">{t(m.labelKey)}</div>
                    <div className="tiny muted">{t(m.hintKey)}</div>
                  </div>
                </label>
              ))}

              {paymentMethod === 'card' ? (
                <div className="mt-16">
                  <div className="alert alert-info">
                    {t('checkout.demoGateway', { digits: '0000' })}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="cardnum">{t('checkout.cardNumber')}</label>
                    <input
                      id="cardnum"
                      className={`input ${errors.number ? 'has-error' : ''}`}
                      value={card.number}
                      onChange={(e) => setCard({ ...card, number: e.target.value })}
                      placeholder="4242 4242 4242 4242"
                      inputMode="numeric"
                    />
                    {errors.number ? <span className="field-error">{errors.number}</span> : null}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="cardname">{t('checkout.nameOnCard')}</label>
                    <input
                      id="cardname"
                      className={`input ${errors.name ? 'has-error' : ''}`}
                      value={card.name}
                      onChange={(e) => setCard({ ...card, name: e.target.value })}
                    />
                    {errors.name ? <span className="field-error">{errors.name}</span> : null}
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label className="field-label" htmlFor="expiry">{t('checkout.expiry')}</label>
                      <input
                        id="expiry"
                        className={`input ${errors.expiry ? 'has-error' : ''}`}
                        value={card.expiry}
                        onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                        placeholder="MM/YY"
                      />
                      {errors.expiry ? <span className="field-error">{errors.expiry}</span> : null}
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="cvc">{t('checkout.cvc')}</label>
                      <input
                        id="cvc"
                        className={`input ${errors.cvc ? 'has-error' : ''}`}
                        value={card.cvc}
                        onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                        placeholder="123"
                        inputMode="numeric"
                      />
                      {errors.cvc ? <span className="field-error">{errors.cvc}</span> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="row gap-12 mt-16">
                <button type="button" className="btn btn-outline btn-lg grow" onClick={() => setStep(1)}>
                  {t('checkout.back')}
                </button>
                <button type="button" className="btn btn-primary btn-lg grow" onClick={nextStep}>
                  {t('checkout.reviewOrder')}
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="card card-pad">
              <h3 style={{ fontSize: '1.05rem', marginBottom: 16 }}>{t('checkout.stepReview')}</h3>

              <div className="card card-pad mb-16" style={{ background: 'var(--ink-50)' }}>
                <div className="row between">
                  <span className="bold small">{t('checkout.shippingTo')}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>{t('common.edit')}</button>
                </div>
                <div className="small muted mt-8">
                  {useNewAddress ? (
                    <>
                      {address.fullName}<br />
                      {address.street}, {address.city} {address.zipCode}<br />
                      {address.country}
                    </>
                  ) : selected ? (
                    <>
                      {selected.fullName}<br />
                      {selected.street}, {selected.city} {selected.zipCode}<br />
                      {selected.country}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="card card-pad mb-16" style={{ background: 'var(--ink-50)' }}>
                <div className="row between">
                  <span className="bold small">{t('checkout.stepPayment')}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>{t('common.edit')}</button>
                </div>
                <div className="small muted mt-8">
                  {t(PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.labelKey || 'payment.card')}
                  {paymentMethod === 'card' && card.number
                    ? ` ${t('checkout.cardEnding', { last4: card.number.replace(/\D/g, '').slice(-4) })}`
                    : ''}
                </div>
              </div>

              <div className="stack">
                {preview.items.map((item) => (
                  <div key={item._id} className="order-item-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <img src={imageUrl(item.product.image)} alt="" />
                    <div className="grow">
                      <div className="small bold">{item.product.name}</div>
                      <div className="tiny muted">
                        {t('orderSuccess.qty', { count: item.quantity })}
                        {item.variant?.value ? ` · ${item.variant.value}` : ''}
                      </div>
                    </div>
                    <span className="bold small">{currency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="row gap-12 mt-24">
                <button type="button" className="btn btn-outline btn-lg grow" onClick={() => setStep(2)}>
                  {t('checkout.back')}
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-lg grow"
                  onClick={placeOrder}
                  disabled={placing}
                >
                  {placing
                    ? t('checkout.placingOrder')
                    : t('checkout.placeOrderWithTotal', { total: currency(totals.total) })}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="summary">
          <div className="card card-pad">
            <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>{t('checkout.orderSummary')}</h3>
            <div className="small muted mb-16">{t('checkout.itemCount', { count: preview.itemCount })}</div>

            <div className="summary-row">
              <span className="muted">{t('checkout.subtotal')}</span>
              <span className="bold">{currency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 ? (
              <div className="summary-row">
                <span className="muted">{t('checkout.discount')}</span>
                <span className="bold" style={{ color: 'var(--green-600)' }}>−{currency(totals.discount)}</span>
              </div>
            ) : null}
            <div className="summary-row">
              <span className="muted">{t('checkout.shipping')}</span>
              <span className="bold">{totals.shipping === 0 ? t('common.free') : currency(totals.shipping)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">{t('checkout.tax')}</span>
              <span className="bold">{currency(totals.tax)}</span>
            </div>
            <div className="summary-row total">
              <span>{t('checkout.total')}</span>
              <span>{currency(totals.total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
