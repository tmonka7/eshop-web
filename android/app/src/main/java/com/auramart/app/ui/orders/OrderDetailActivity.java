package com.auramart.app.ui.orders;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.model.Models.CancelOrderRequest;
import com.auramart.app.data.model.Models.Order;
import com.auramart.app.data.model.Models.Tracking;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityOrderDetailBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Ui;

import java.util.Arrays;

public class OrderDetailActivity extends AppCompatActivity {

    private static final String EXTRA_ID = "orderId";

    public static Intent intent(Context context, String orderIdOrNumber) {
        Intent intent = new Intent(context, OrderDetailActivity.class);
        intent.putExtra(EXTRA_ID, orderIdOrNumber);
        return intent;
    }

    private ActivityOrderDetailBinding b;
    private Adapters.OrderItemAdapter itemAdapter;
    private Adapters.TrackingAdapter trackingAdapter;

    private String orderId;
    private Order order;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityOrderDetailBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        orderId = getIntent().getStringExtra(EXTRA_ID);
        b.toolbar.setNavigationOnClickListener(v -> finish());

        itemAdapter = new Adapters.OrderItemAdapter();
        trackingAdapter = new Adapters.TrackingAdapter();
        b.itemList.setAdapter(itemAdapter);
        b.trackingList.setAdapter(trackingAdapter);

        b.cancelOrderButton.setOnClickListener(v -> confirmCancel());

        load();
    }

    private void load() {
        b.progress.setVisibility(View.VISIBLE);

        Repo.call(Repo.api().order(orderId), new Repo.OnResult<Order>() {
            @Override
            public void onSuccess(Order data, String message) {
                b.progress.setVisibility(View.GONE);
                order = data;
                bind();
            }

            @Override
            public void onError(String message) {
                b.progress.setVisibility(View.GONE);
                Ui.toast(OrderDetailActivity.this, message);
                finish();
            }
        });

        Repo.call(Repo.api().trackOrder(orderId), new Repo.OnResult<Tracking>() {
            @Override
            public void onSuccess(Tracking data, String message) {
                trackingAdapter.submit(data.steps);
                if (data.cancelled) {
                    b.cancelledNotice.setVisibility(View.VISIBLE);
                    b.cancelledNotice.setText("This order was cancelled.");
                } else {
                    b.cancelledNotice.setVisibility(View.GONE);
                }
            }

            @Override
            public void onError(String message) {
                // The rest of the screen still renders without the tracking strip.
            }
        });
    }

    private void bind() {
        b.orderNumberText.setText("#" + order.orderNumber);
        b.placedText.setText("Placed " + Formats.dateTime(order.createdAt));

        b.statusBadge.setText(Formats.label(order.status));
        b.statusBadge.setBackgroundResource(Adapters.StatusStyle.background(order.status));
        b.statusBadge.setTextColor(getColor(Adapters.StatusStyle.textColor(order.status)));

        b.trackingText.setText(order.carrier + " · " + order.trackingNumber);
        b.etaText.setText("Estimated delivery " + Formats.date(order.estimatedDelivery));

        itemAdapter.submit(order.items);
        b.itemsTitle.setText("Items (" + order.items.size() + ")");

        b.subtotalText.setText(Formats.money(order.pricing.subtotal));
        b.taxText.setText(Formats.money(order.pricing.tax));
        b.totalText.setText(Formats.money(order.pricing.total));
        b.shippingText.setText(order.pricing.shipping == 0
                ? getString(R.string.free)
                : Formats.money(order.pricing.shipping));

        if (order.pricing.discount > 0) {
            b.discountRow.setVisibility(View.VISIBLE);
            b.discountText.setText("-" + Formats.money(order.pricing.discount));
        } else {
            b.discountRow.setVisibility(View.GONE);
        }

        String payment = Formats.label(order.payment.method) + " · " + Formats.label(order.payment.status);
        if (order.payment.cardLast4 != null && !order.payment.cardLast4.isEmpty()) {
            payment += " (ending " + order.payment.cardLast4 + ")";
        }
        b.paymentText.setText(payment);

        b.addressText.setText(order.shippingAddress.fullName + "\n"
                + order.shippingAddress.street + "\n"
                + order.shippingAddress.city + " " + order.shippingAddress.zipCode + "\n"
                + order.shippingAddress.country);

        boolean cancellable = Arrays.asList("pending", "processing").contains(order.status);
        b.cancelOrderButton.setVisibility(cancellable ? View.VISIBLE : View.GONE);
    }

    private void confirmCancel() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.cancel_order)
                .setMessage("Cancel this order? Stock is returned and any payment is refunded.")
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.cancel_order, (dialog, which) -> cancelOrder())
                .show();
    }

    private void cancelOrder() {
        b.cancelOrderButton.setEnabled(false);
        Repo.call(
                Repo.api().cancelOrder(orderId, new CancelOrderRequest("Cancelled by customer")),
                new Repo.OnResult<Order>() {
                    @Override
                    public void onSuccess(Order data, String message) {
                        Ui.snack(b.getRoot(), message);
                        load();
                    }

                    @Override
                    public void onError(String message) {
                        b.cancelOrderButton.setEnabled(true);
                        Ui.snack(b.getRoot(), message);
                    }
                });
    }
}
