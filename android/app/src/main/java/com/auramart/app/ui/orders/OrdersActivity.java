package com.auramart.app.ui.orders;

import android.os.Bundle;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.model.Models.Order;
import com.auramart.app.data.model.Models.Pagination;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityOrdersBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Ui;

import com.google.android.material.chip.Chip;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class OrdersActivity extends AppCompatActivity {

    private static final String[] STATUSES = {
            "all", "pending", "processing", "shipped", "delivered", "cancelled",
    };

    private ActivityOrdersBinding b;
    private Adapters.OrderAdapter adapter;

    private final List<Order> loaded = new ArrayList<>();
    private String status = "all";
    private int page = 1;
    private int totalPages = 1;
    private boolean loading;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityOrdersBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.toolbar.setNavigationOnClickListener(v -> finish());

        adapter = new Adapters.OrderAdapter(order ->
                startActivity(OrderDetailActivity.intent(this, order.orderNumber)));
        b.orderList.setAdapter(adapter);

        buildChips();

        b.swipeRefresh.setOnRefreshListener(() -> reload(true));
        b.orderList.addOnScrollListener(new androidx.recyclerview.widget.RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@androidx.annotation.NonNull androidx.recyclerview.widget.RecyclerView rv,
                                   int dx, int dy) {
                if (dy <= 0 || loading || page >= totalPages) return;
                androidx.recyclerview.widget.LinearLayoutManager lm =
                        (androidx.recyclerview.widget.LinearLayoutManager) rv.getLayoutManager();
                if (lm != null && lm.findLastVisibleItemPosition() >= adapter.getItemCount() - 3) {
                    page += 1;
                    fetch();
                }
            }
        });

        b.empty.emptyTitle.setText(R.string.no_orders);
        b.empty.emptyMessage.setText("When you place an order it will show up here.");

        reload(false);
    }

    private void buildChips() {
        for (String value : STATUSES) {
            Chip chip = new Chip(this);
            chip.setText(value.equals("all") ? "All" : Formats.label(value));
            chip.setCheckable(true);
            chip.setChecked(value.equals(status));
            chip.setOnClickListener(v -> {
                status = value;
                reload(false);
            });
            b.statusChips.addView(chip);
        }
    }

    private void reload(boolean fromSwipe) {
        page = 1;
        totalPages = 1;
        loaded.clear();
        if (!fromSwipe) b.progress.setVisibility(View.VISIBLE);
        fetch();
    }

    private void fetch() {
        loading = true;

        Map<String, String> query = new HashMap<>();
        query.put("page", String.valueOf(page));
        query.put("limit", "10");
        query.put("status", status);

        Repo.callPaged(Repo.api().orders(query), new Repo.OnPaged<Order>() {
            @Override
            public void onSuccess(List<Order> items, Pagination pagination) {
                loading = false;
                b.progress.setVisibility(View.GONE);
                b.swipeRefresh.setRefreshing(false);

                loaded.addAll(items);
                adapter.submit(new ArrayList<>(loaded));

                if (pagination != null) totalPages = Math.max(1, pagination.totalPages);
                b.empty.getRoot().setVisibility(loaded.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onError(String message) {
                loading = false;
                b.progress.setVisibility(View.GONE);
                b.swipeRefresh.setRefreshing(false);
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        // A cancellation on the detail screen changes this list.
        if (!loaded.isEmpty()) reload(true);
    }
}
