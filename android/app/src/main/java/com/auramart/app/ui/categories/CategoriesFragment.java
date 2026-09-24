package com.auramart.app.ui.categories;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.auramart.app.R;
import com.auramart.app.data.model.Models.Category;
import com.auramart.app.data.repository.Repo;
import com.auramart.app.databinding.FragmentCategoriesBinding;
import com.auramart.app.ui.adapter.Adapters;
import com.auramart.app.ui.products.ProductListActivity;
import com.auramart.app.util.Ui;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CategoriesFragment extends Fragment {

    private FragmentCategoriesBinding b;
    private Adapters.CategoryRowAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        b = FragmentCategoriesBinding.inflate(inflater, container, false);
        return b.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new Adapters.CategoryRowAdapter(category ->
                startActivity(ProductListActivity.intent(
                        requireContext(), category.slug, category.name, false, false)));
        b.categoryList.setAdapter(adapter);

        b.searchBar.setOnClickListener(v -> startActivity(
                ProductListActivity.intent(requireContext(), null, null, true, false)));

        b.swipeRefresh.setOnRefreshListener(this::load);
        load();
    }

    private void load() {
        Map<String, String> query = new HashMap<>();
        query.put("withCounts", "true");

        Repo.call(Repo.api().categories(query), new Repo.OnResult<List<Category>>() {
            @Override
            public void onSuccess(List<Category> data, String message) {
                if (b == null) return;
                adapter.submit(data);
                b.swipeRefresh.setRefreshing(false);
                b.empty.getRoot().setVisibility(data.isEmpty() ? View.VISIBLE : View.GONE);
                b.empty.emptyTitle.setText(R.string.no_categories_yet);
            }

            @Override
            public void onError(String message) {
                if (b == null) return;
                b.swipeRefresh.setRefreshing(false);
                Ui.snack(b.getRoot(), message);
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        b = null;
    }
}
