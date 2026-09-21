package com.auramart.app.ui.account;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.auramart.app.R;
import com.auramart.app.data.model.Models.Address;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.ActivityToolbarListBinding;
import com.auramart.app.databinding.DialogAddressBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.util.Ui;
import com.auramart.app.util.Validators;

import java.util.List;

public class AddressListActivity extends AppCompatActivity
        implements Adapters.AddressAdapter.Listener {

    private ActivityToolbarListBinding b;
    private Adapters.AddressAdapter adapter;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityToolbarListBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        b.toolbar.setTitle(R.string.addresses);
        b.toolbar.setNavigationOnClickListener(v -> finish());
        b.toolbar.inflateMenu(R.menu.menu_add);
        b.toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_add) {
                showDialog(null);
                return true;
            }
            return false;
        });

        adapter = new Adapters.AddressAdapter(this);
        b.list.setAdapter(adapter);

        b.empty.emptyTitle.setText(R.string.no_saved_addresses);
        b.empty.emptyMessage.setText(R.string.no_saved_addresses_hint);
        b.empty.emptyAction.setVisibility(View.VISIBLE);
        b.empty.emptyAction.setText(R.string.add_new_address);
        b.empty.emptyAction.setOnClickListener(v -> showDialog(null));

        b.swipeRefresh.setOnRefreshListener(this::load);
        load();
    }

    private void load() {
        Repo.call(Repo.api().addresses(), callback());
    }

    private Repo.OnResult<List<Address>> callback() {
        return new Repo.OnResult<>() {
            @Override
            public void onSuccess(List<Address> data, String message) {
                b.swipeRefresh.setRefreshing(false);
                adapter.submit(data);
                b.empty.getRoot().setVisibility(data.isEmpty() ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onError(String message) {
                b.swipeRefresh.setRefreshing(false);
                Ui.snack(b.getRoot(), message);
            }
        };
    }

    private void showDialog(@Nullable Address existing) {
        DialogAddressBinding d = DialogAddressBinding.inflate(LayoutInflater.from(this));

        if (existing != null) {
            d.fullNameInput.setText(existing.fullName);
            d.phoneInput.setText(existing.phone);
            d.streetInput.setText(existing.street);
            d.cityInput.setText(existing.city);
            d.zipInput.setText(existing.zipCode);
            d.countryInput.setText(existing.country);
        }

        new AlertDialog.Builder(this)
                .setTitle(existing == null ? R.string.add_new_address : R.string.edit)
                .setView(d.getRoot())
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.save, (dialog, which) -> {
                    Address address = new Address();
                    address.label = existing != null ? existing.label : getString(R.string.default_address_label);
                    address.fullName = String.valueOf(d.fullNameInput.getText()).trim();
                    address.phone = String.valueOf(d.phoneInput.getText()).trim();
                    address.street = String.valueOf(d.streetInput.getText()).trim();
                    address.city = String.valueOf(d.cityInput.getText()).trim();
                    address.zipCode = String.valueOf(d.zipInput.getText()).trim();
                    address.country = String.valueOf(d.countryInput.getText()).trim();

                    if (!Validators.notBlank(address.fullName)
                            || !Validators.notBlank(address.street)
                            || !Validators.notBlank(address.city)
                            || !Validators.notBlank(address.zipCode)
                            || !Validators.notBlank(address.country)) {
                        Ui.snack(b.getRoot(), getString(R.string.error_fill_required));
                        return;
                    }

                    if (existing == null) {
                        Repo.call(Repo.api().addAddress(address), callback());
                    } else {
                        Repo.call(Repo.api().updateAddress(existing.id, address), callback());
                    }
                })
                .show();
    }

    @Override
    public void onMakeDefault(Address address) {
        Repo.call(Repo.api().setDefaultAddress(address.id), callback());
    }

    @Override
    public void onDelete(Address address) {
        new AlertDialog.Builder(this)
                .setTitle(R.string.delete)
                .setMessage(R.string.remove_address_confirm)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.delete, (dialog, which) ->
                        Repo.call(Repo.api().deleteAddress(address.id), callback()))
                .show();
    }
}
