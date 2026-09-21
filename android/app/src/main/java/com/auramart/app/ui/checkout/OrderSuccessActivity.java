package com.auramart.app.ui.checkout;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.data.model.Models.Order;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityOrderSuccessBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.ui.main.MainActivity;
import com.auramart.app.ui.orders.OrderDetailActivity;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Ui;

public class OrderSuccessActivity extends AppCompatActivity {

    private static final String EXTRA_ORDER_NUMBER = "orderNumber";

    public static Intent intent(Context context, String orderNumber) {
        Intent intent = new Intent(context, OrderSuccessActivity.class);
        intent.putExtra(EXTRA_ORDER_NUMBER, orderNumber);
        return intent;
    }

    private ActivityOrderSuccessBinding b;
    private String orderNumber;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityOrderSuccessBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        orderNumber = getIntent().getStringExtra(EXTRA_ORDER_NUMBER);

        Adapters.OrderItemAdapter adapter = new Adapters.OrderItemAdapter();
        b.itemList.setAdapter(adapter);

        b.orderNumberText.setText("Order #" + orderNumber);
        b.viewOrderButton.setOnClickListener(v ->
                startActivity(OrderDetailActivity.intent(this, orderNumber)));
        b.continueButton.setOnClickListener(v -> goHome());

        Repo.call(Repo.api().order(orderNumber), new Repo.OnResult<Order>() {
            @Override
            public void onSuccess(Order order, String message) {
                adapter.submit(order.items);
                b.totalText.setText(Formats.money(order.pricing.total));
                b.trackingText.setText(order.carrier + " · " + order.trackingNumber
                        + "\nEstimated delivery " + Formats.date(order.estimatedDelivery));
            }

            @Override
            public void onError(String message) {
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    /** Back from this screen goes home, never back into checkout. */
    @Override
    public void onBackPressed() {
        goHome();
    }

    private void goHome() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
