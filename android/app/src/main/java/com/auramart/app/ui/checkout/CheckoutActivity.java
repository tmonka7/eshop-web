package com.auramart.app.ui.checkout;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.RadioButton;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.local.SessionManager;
import com.auramart.app.data.model.Models.Address;
import com.auramart.app.data.model.Models.CardDetails;
import com.auramart.app.data.model.Models.Cart;
import com.auramart.app.data.model.Models.CreateOrderRequest;
import com.auramart.app.data.model.Models.Order;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityCheckoutBinding;
import com.auramart.app.databinding.DialogAddressBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.util.Formats;
import com.auramart.app.util.Ui;
import com.auramart.app.util.Validators;

import java.util.ArrayList;
import java.util.List;

public class CheckoutActivity extends AppCompatActivity {

    private ActivityCheckoutBinding b;
    private Adapters.CheckoutItemAdapter itemAdapter;

    private final List<Address> addresses = new ArrayList<>();
    private String selectedAddressId;
    private Cart preview;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityCheckoutBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.toolbar.setNavigationOnClickListener(v -> finish());

        itemAdapter = new Adapters.CheckoutItemAdapter();
        b.itemList.setAdapter(itemAdapter);

        b.addAddressButton.setOnClickListener(v -> showAddressDialog());
        b.placeOrderButton.setOnClickListener(v -> placeOrder());

        b.paymentGroup.setOnCheckedChangeListener((group, checkedId) ->
                b.cardBox.setVisibility(checkedId == R.id.payCard ? View.VISIBLE : View.GONE));

        b.cardNameInput.setText(SessionManager.get().getUser() != null
                ? SessionManager.get().getUser().name : "");

        loadPreview();
        loadAddresses();
    }

    private void loadPreview() {
        setLoading(true);
        Repo.call(Repo.api().checkoutPreview(), new Repo.OnResult<Cart>() {
            @Override
            public void onSuccess(Cart data, String message) {
                setLoading(false);
                preview = data;
                itemAdapter.submit(data.items);

                b.subtotalText.setText(Formats.money(data.totals.subtotal));
                b.taxText.setText(Formats.money(data.totals.tax));
                b.totalText.setText(Formats.money(data.totals.total));
                b.shippingText.setText(data.totals.shipping == 0
                        ? getString(R.string.free)
                        : Formats.money(data.totals.shipping));

                if (data.totals.discount > 0) {
                    b.discountRow.setVisibility(View.VISIBLE);
                    b.discountText.setText("-" + Formats.money(data.totals.discount));
                } else {
                    b.discountRow.setVisibility(View.GONE);
                }

                b.placeOrderButton.setText(
                        getString(R.string.place_order) + " · " + Formats.money(data.totals.total));
            }

            @Override
            public void onError(String message) {
                setLoading(false);
                Ui.toast(CheckoutActivity.this, message);
                finish();
            }
        });
    }

    private void loadAddresses() {
        Repo.call(Repo.api().addresses(), new Repo.OnResult<List<Address>>() {
            @Override
            public void onSuccess(List<Address> data, String message) {
                addresses.clear();
                addresses.addAll(data);
                renderAddresses();
            }

            @Override
            public void onError(String message) {
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    private void renderAddresses() {
        b.addressGroup.removeAllViews();

        if (addresses.isEmpty()) {
            b.noAddressText.setVisibility(View.VISIBLE);
            b.noAddressText.setText("Add a shipping address to continue.");
            selectedAddressId = null;
            return;
        }

        b.noAddressText.setVisibility(View.GONE);

        for (Address address : addresses) {
            RadioButton radio = new RadioButton(this);
            radio.setText(address.fullName + "\n" + address.oneLine());
            radio.setTextSize(14f);
            radio.setPadding(16, 16, 0, 16);
            radio.setId(View.generateViewId());
            radio.setTag(address.id);
            radio.setOnClickListener(v -> selectedAddressId = address.id);
            b.addressGroup.addView(radio);

            boolean shouldSelect = selectedAddressId == null
                    ? address.isDefault
                    : address.id.equals(selectedAddressId);
            if (shouldSelect) {
                radio.setChecked(true);
                selectedAddressId = address.id;
            }
        }

        // Nothing marked default: fall back to the first entry.
        if (selectedAddressId == null && b.addressGroup.getChildCount() > 0) {
            RadioButton first = (RadioButton) b.addressGroup.getChildAt(0);
            first.setChecked(true);
            selectedAddressId = (String) first.getTag();
        }
    }

    private void showAddressDialog() {
        DialogAddressBinding d = DialogAddressBinding.inflate(LayoutInflater.from(this));

        new AlertDialog.Builder(this)
                .setTitle(R.string.add_new_address)
                .setView(d.getRoot())
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.save, (dialog, which) -> {
                    Address address = new Address();
                    address.label = "Home";
                    address.fullName = String.valueOf(d.fullNameInput.getText()).trim();
                    address.phone = String.valueOf(d.phoneInput.getText()).trim();
                    address.street = String.valueOf(d.streetInput.getText()).trim();
                    address.city = String.valueOf(d.cityInput.getText()).trim();
                    address.zipCode = String.valueOf(d.zipInput.getText()).trim();
                    address.country = String.valueOf(d.countryInput.getText()).trim();

                    if (!Validators.notBlank(address.fullName) || !Validators.notBlank(address.street)
                            || !Validators.notBlank(address.city) || !Validators.notBlank(address.zipCode)
                            || !Validators.notBlank(address.country)) {
                        Ui.snack(b.getRoot(), "Please fill in every required field");
                        return;
                    }

                    Repo.call(Repo.api().addAddress(address), new Repo.OnResult<List<Address>>() {
                        @Override
                        public void onSuccess(List<Address> data, String message) {
                            addresses.clear();
                            addresses.addAll(data);
                            selectedAddressId = data.get(data.size() - 1).id;
                            renderAddresses();
                            Ui.snack(b.getRoot(), message);
                        }

                        @Override
                        public void onError(String message) {
                            Ui.snack(b.getRoot(), message);
                        }
                    });
                })
                .show();
    }

    private void placeOrder() {
        if (preview == null) return;

        if (selectedAddressId == null) {
            Ui.snack(b.getRoot(), "Choose a shipping address");
            return;
        }

        CreateOrderRequest request = new CreateOrderRequest();
        request.addressId = selectedAddressId;
        request.paymentMethod = paymentMethod();

        if ("card".equals(request.paymentMethod)) {
            String number = String.valueOf(b.cardNumberInput.getText()).replaceAll("\\s", "");
            String name = String.valueOf(b.cardNameInput.getText()).trim();
            if (!Validators.isCardNumber(number)) {
                Ui.snack(b.getRoot(), "Enter a valid card number");
                return;
            }
            request.card = new CardDetails(number, name);
        }

        setLoading(true);
        Repo.call(Repo.api().createOrder(request), new Repo.OnResult<Order>() {
            @Override
            public void onSuccess(Order order, String message) {
                setLoading(false);
                SessionManager.get().setCartCount(0);
                startActivity(OrderSuccessActivity.intent(CheckoutActivity.this, order.orderNumber));
                finish();
            }

            @Override
            public void onError(String message) {
                setLoading(false);
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    private String paymentMethod() {
        int checked = b.paymentGroup.getCheckedRadioButtonId();
        if (checked == R.id.payPaypal) return "paypal";
        if (checked == R.id.payApple) return "applepay";
        if (checked == R.id.payCod) return "cod";
        return "card";
    }

    private void setLoading(boolean loading) {
        b.progress.setVisibility(loading ? View.VISIBLE : View.GONE);
        b.placeOrderButton.setEnabled(!loading);
    }
}
