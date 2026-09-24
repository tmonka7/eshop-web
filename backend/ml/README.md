# DINOv3 model for image search

The API finds products by photo with [DINOv3](https://github.com/facebookresearch/dinov3)
(ViT-S/16, 384-dimensional features). The model runs inside the API process on the CPU through
`onnxruntime-node`. Nothing is downloaded at runtime, so it works on a host with no internet access.

```
ml/dinov3-vits16/
├── model.onnx               graph (138 KB)
├── model.onnx_data          fp32 weights (86 MB), must sit next to model.onnx
├── preprocessor_config.json resize / normalisation, read at load time
├── config.json
└── LICENSE.md               DINOv3 License. Keep it with the weights when you redistribute them.
```

Source: [`onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX`](https://huggingface.co/onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX).

## Getting the files onto an offline host

1. On a machine with internet access, run:

   ```bash
   npm run model:fetch                         # from the repo root or backend/
   ```

   This downloads the files into this folder and checks each weight file against its published
   SHA-256.
2. Copy `backend/ml/` to the offline host, or commit it or store it in Git LFS. The Docker image
   copies it in automatically.
3. Install npm dependencies from your offline mirror or cache. `onnxruntime-node` and `sharp`
   include their native binaries. The `.npmrc` at the repo root sets
   `onnxruntime-node-install=skip`, so the install step never reaches out to NuGet.

When the model is missing, the rest of the shop still works. Image search reports itself as
unavailable, the storefront hides the camera button, and products are marked `unavailable`. Once the
files are in place, restart the API and it indexes those products in the background.

## Other variants

| Command                                          | Size   | Notes                                    |
| ------------------------------------------------ | ------ | ---------------------------------------- |
| `npm run model:fetch`                            | 86 MB  | default, fp32                            |
| `npm run model:fetch -- --variant quantized`     | 22 MB  | int8. Set `VISUAL_SEARCH_MODEL_FILE=model_quantized.onnx` |
| `npm run model:fetch -- --model vitb16`          | 343 MB | 768-d, more accurate and slower. Set `VISUAL_SEARCH_MODEL_DIR=ml/dinov3-vitb16` |

Vectors record which model produced them. After switching models, run `npm run visual:reindex`
or restart the API. Search only compares vectors from the model that is currently loaded.

## How it works

- **Registration**: when a product is created, or its images change, the API embeds each image and
  stores one L2-normalised Float32 vector per image in the `productembeddings` collection. The
  outcome is recorded in `product.visualIndex`, which the admin panel shows.
- **Search**: `POST /api/v1/products/visual-search` (multipart field `image`) embeds the photo and
  ranks active products by cosine similarity. Each product is scored by its best-matching image.
  MongoDB 6 Community has no vector index, so the API keeps the vectors in an in-memory matrix
  that it rebuilds lazily after changes. A full scan takes milliseconds at catalogue scale.
- **Preprocessing** matches `DINOv3ViTImageProcessor`: a plain resize to 224×224 (bilinear),
  scaling to [0, 1], then ImageNet mean and std. Transparent images are flattened onto white. The
  descriptor is `pooler_output`, the normalised CLS token.

Typical cosine scores: the same product in a different photo or crop scores 0.85 or more, the same
kind of object about 0.3, and unrelated images under 0.1. `VISUAL_SEARCH_MIN_SCORE` (default 0.25)
drops the unrelated tail.
