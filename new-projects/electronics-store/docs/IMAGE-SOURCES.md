# Image, video and 3D sources

Checked on 27 September 2026. The catalogue has 60 models in 10 categories, including 25 smartphones, with 261 published variants and 23 retired ones. All files are stored in the repository. Validation data: `docs/catalog-validation.json`.

## Terms of use

This is a portfolio project, not the catalogue of a real retailer. Prices in RUB, old prices, SKUs, stock and variant availability are sample data, not market research or a public offer. Every product in `data/catalog.json` has `rating: 0` and `reviewCount: 0`; ratings and review counts are calculated only from published reviews with `isDemo: false`. Older device generations are part of the sample range and are not presented as new.

- DummyJSON: the public demo API and its repository are MIT licensed; the full notice is at the end of this file. The project licence does not grant rights in the product photos and trademarks contained in the dataset. Portfolio use only; commercial use needs separate clearance.
- Apple Support: official Apple product images. No open licence was found; copyright Apple Inc. Portfolio use only; commercial use needs separate clearance. Terms: https://www.apple.com/legal/internet-services/terms/site.html
- Samsung: two Galaxy Tab S8+ Graphite images from the official Samsung product page and CDN. Copyright Samsung Electronics; no open licence is stated. Source URLs are in `docs/catalog-asset-sources.json`.
- Wikimedia Commons: the author, source page and licence of each file are listed below. Cut-out derivatives of CC BY-SA files are distributed under the same licence. Changes are downscaling and WebP encoding; `*-clean.webp` files also have the background removed, and the original photo is kept as a separate file.
- 3D: `iphone-15-pro-max.glb` embeds a CC BY 4.0 declaration and the author MpPower / MG990. The Pane mirror credits MajdyModels and also states CC BY 4.0. Both credits and links are kept because it could not be confirmed how they relate. The GPL of the Pane app does not apply to the model.
- Banner: a composition of the product photos listed under `/media/hero-electronics.webp`. The rights in the source photos still apply.
- Video: a silent slideshow, "Angle overview", made with FFmpeg from three iPhone 13 Pro photos. 12 seconds, 1280x720, VP9 in WebM. It is not a device test or a manufacturer video.

## Image checks and data limits

All images were reviewed on contact sheets, and doubtful models were checked one by one. Ambiguous labels in the source dataset were corrected: the AirPods photo shows AirPods 3, the OPPO A57 is the 2016 generation, the Apple charger is the 5 W USB-A model rather than 20 W USB-C, and the Samsung with a dual front camera is the Galaxy S10+. The Canon is shown with the RF 85mm F2 Macro IS STM lens. The Sony product is body only; no lens is included.

Each of the 59 colours of the 13 iPhone models has two official images of its own, linked through `Variant.images`. MacBook Pro 14 M1, iPad mini 6, AirPods Max Lightning, HomePod mini and Beats Flex have official photos of both offered colours, and the Galaxy Tab S8+ has a Graphite gallery from Samsung. Colour options without a matching photo were retired with `Variant.active=false`, keeping their history. Every published colour matches its photos. Regional configurations and part numbers would need confirmation from a supplier before real sales.

Key specifications were checked against the manufacturer pages below. Laptop configurations and regional accessories can differ.

## Specification sources

- [iPhone 15 Pro Max](https://support.apple.com/en-us/111828)
- [iPhone 15 Pro](https://support.apple.com/en-us/111829)
- [iPhone 15](https://support.apple.com/en-us/111831)
- [iPhone 16](https://support.apple.com/en-us/121029)
- [iPhone 13 Pro](https://support.apple.com/en-us/111871)
- [AirPods 3](https://support.apple.com/en-us/111863)
- [Apple USB Power Adapter, 5 V / 1 A](https://cdsassets.apple.com/live/6GJYWVAV/user/ma1203_usb_power_adapter_zm.pdf)
- [realme C35](https://www.realme.com/in/realme-c35/specs)
- [realme X](https://www.realme.com/in/realme-x/specs)
- [realme XT](https://www.realme.com/in/realme-xt/specs)
- [OPPO F19 Pro series](https://www.oppo.com/in/newsroom/press/oppof19proseries-and-oppobandstyle/)
- [Samsung Galaxy S10](https://www.samsungmobilepress.com/media-assets/galaxy_s10?tab=specs)
- [Samsung Galaxy Tab S8 series](https://image-us.samsung.com/SamsungUS/samsungbusiness/pdfs/spec-sheet/Galaxy_Tab_S8_Series_Spec_Sheet_2.pdf)
- [vivo S1](https://www.vivo.com/sg/about-vivo/news/Vivo-New-S1-Smartphone)
- [vivo V9](https://www.vivo.com/in/product/productSpecification?id=4)
- [vivo X21](https://www.vivo.com/in/product/productSpecification?id=1)
- [ASUS Zenbook Pro Duo UX581](https://www.asus.com/us/news/aicdkmkdrrlutvtl/)
- [Huawei MateBook X Pro 2020](https://consumer.huawei.com/za/laptops/matebook-x-pro-2020/specs/)
- [Lenovo Yoga 920](https://psref.lenovo.com/syspool/Sys/PDF/Lenovo_Laptops/Yoga_920_13IKB/Yoga_920_13IKB_Spec.PDF)
- [Nintendo Switch](https://www.nintendo.com/us/gaming-systems/switch/tech-specs/)
- [Sony Alpha 7 III](https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m3/specifications)
- [Canon EOS R6](https://downloads.canon.com/nw/camera/products/eos/product-2/pdfs/EOS_R6_specifications_FINAL_4.5.21.pdf)
- [Dyson V8](https://www.dyson.com/content/dam/dyson/for-business/business-refresh/docs/us/vacuums/Dyson_US_V8_tech_spec.pdf)

## File registry

The original machine-readable registry is `public/media/asset-manifest.json`. The 146 Apple Store and Samsung photos added later for colour galleries and new models are listed in `docs/catalog-asset-sources.json`. "Original" links the source file, "Page" links its metadata or publication page. Changes are stated for every file. Older files are kept for history and order snapshots even when they are no longer used in a gallery.

### `/products/iphone-13-pro-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/123
- Original: https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-13-pro-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/123
- Original: https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-13-pro-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/123
- Original: https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-x-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/124
- Original: https://cdn.dummyjson.com/product-images/smartphones/iphone-x/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-x-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/124
- Original: https://cdn.dummyjson.com/product-images/smartphones/iphone-x/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-x-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/124
- Original: https://cdn.dummyjson.com/product-images/smartphones/iphone-x/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-a57-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/125
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-a57/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-a57-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/125
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-a57/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-a57-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/125
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-a57/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-f19-pro-plus-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/126
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-f19-pro-plus/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-f19-pro-plus-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/126
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-f19-pro-plus/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-f19-pro-plus-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/126
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-f19-pro-plus/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-k1-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/127
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-k1/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-k1-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/127
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-k1/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/oppo-k1-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/127
- Original: https://cdn.dummyjson.com/product-images/smartphones/oppo-k1/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-c35-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/128
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-c35/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-c35-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/128
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-c35/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-c35-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/128
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-c35/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-x-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/129
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-x/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-x-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/129
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-x/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-x-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/129
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-x/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-xt-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/130
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-xt/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-xt-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/130
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-xt/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/realme-xt-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/130
- Original: https://cdn.dummyjson.com/product-images/smartphones/realme-xt/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s7-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/131
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s7/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s7-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/131
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s7/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s7-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/131
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s7/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s8-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/132
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s8/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s8-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/132
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s8/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s8-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/132
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s8/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s10-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/133
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s10/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s10-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/133
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s10/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-s10-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/133
- Original: https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s10/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-s1-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/134
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-s1/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-s1-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/134
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-s1/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-s1-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/134
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-s1/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-v9-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/135
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-v9/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-v9-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/135
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-v9/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-v9-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/135
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-v9/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-x21-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/136
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-x21/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-x21-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/136
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-x21/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/vivo-x21-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/136
- Original: https://cdn.dummyjson.com/product-images/smartphones/vivo-x21/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-macbook-pro-14-inch-space-grey-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/78
- Original: https://cdn.dummyjson.com/product-images/laptops/apple-macbook-pro-14-inch-space-grey/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-macbook-pro-14-inch-space-grey-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/78
- Original: https://cdn.dummyjson.com/product-images/laptops/apple-macbook-pro-14-inch-space-grey/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-macbook-pro-14-inch-space-grey-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/78
- Original: https://cdn.dummyjson.com/product-images/laptops/apple-macbook-pro-14-inch-space-grey/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/asus-zenbook-pro-dual-screen-laptop-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/79
- Original: https://cdn.dummyjson.com/product-images/laptops/asus-zenbook-pro-dual-screen-laptop/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/asus-zenbook-pro-dual-screen-laptop-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/79
- Original: https://cdn.dummyjson.com/product-images/laptops/asus-zenbook-pro-dual-screen-laptop/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/asus-zenbook-pro-dual-screen-laptop-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/79
- Original: https://cdn.dummyjson.com/product-images/laptops/asus-zenbook-pro-dual-screen-laptop/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/huawei-matebook-x-pro-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/80
- Original: https://cdn.dummyjson.com/product-images/laptops/huawei-matebook-x-pro/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/huawei-matebook-x-pro-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/80
- Original: https://cdn.dummyjson.com/product-images/laptops/huawei-matebook-x-pro/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/huawei-matebook-x-pro-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/80
- Original: https://cdn.dummyjson.com/product-images/laptops/huawei-matebook-x-pro/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/lenovo-yoga-920-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/81
- Original: https://cdn.dummyjson.com/product-images/laptops/lenovo-yoga-920/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/lenovo-yoga-920-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/81
- Original: https://cdn.dummyjson.com/product-images/laptops/lenovo-yoga-920/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/lenovo-yoga-920-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/81
- Original: https://cdn.dummyjson.com/product-images/laptops/lenovo-yoga-920/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/new-dell-xps-13-9300-laptop-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/82
- Original: https://cdn.dummyjson.com/product-images/laptops/new-dell-xps-13-9300-laptop/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/new-dell-xps-13-9300-laptop-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/82
- Original: https://cdn.dummyjson.com/product-images/laptops/new-dell-xps-13-9300-laptop/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/new-dell-xps-13-9300-laptop-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/82
- Original: https://cdn.dummyjson.com/product-images/laptops/new-dell-xps-13-9300-laptop/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/ipad-mini-2021-starlight-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/159
- Original: https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/ipad-mini-2021-starlight-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/159
- Original: https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/ipad-mini-2021-starlight-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/159
- Original: https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-tab-s8-plus-grey-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/160
- Original: https://cdn.dummyjson.com/product-images/tablets/samsung-galaxy-tab-s8-plus-grey/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-tab-s8-plus-grey-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/160
- Original: https://cdn.dummyjson.com/product-images/tablets/samsung-galaxy-tab-s8-plus-grey/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/samsung-galaxy-tab-s8-plus-grey-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/160
- Original: https://cdn.dummyjson.com/product-images/tablets/samsung-galaxy-tab-s8-plus-grey/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-airpods-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/100
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-airpods-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/100
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-airpods-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/100
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-airpods-max-silver-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/101
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods-max-silver/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/beats-flex-wireless-earphones-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/107
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/beats-flex-wireless-earphones/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-watch-series-4-gold-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/106
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-series-4-gold/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-watch-series-4-gold-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/106
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-series-4-gold/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-watch-series-4-gold-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/106
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-watch-series-4-gold/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/amazon-echo-plus-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/99
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/amazon-echo-plus-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/99
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-homepod-mini-cosmic-grey-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/103
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-homepod-mini-cosmic-grey/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-iphone-charger-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/104
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-iphone-charger/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-iphone-charger-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/104
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-iphone-charger/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-magsafe-battery-pack-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/105
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-magsafe-battery-pack/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/apple-magsafe-battery-pack-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/105
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/apple-magsafe-battery-pack/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-12-silicone-case-with-magsafe-plum-1.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/108
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-12-silicone-case-with-magsafe-plum/1.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-12-silicone-case-with-magsafe-plum-2.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/108
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-12-silicone-case-with-magsafe-plum/2.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/iphone-12-silicone-case-with-magsafe-plum-3.webp`

- Author / supplier: DummyJSON, Muhammad Ovi (Owais); manufacturer imagery embedded in demo dataset
- Licence / status: DummyJSON project MIT; separate rights in product photography and trademarks not independently established
- Page: https://dummyjson.com/products/108
- Original: https://cdn.dummyjson.com/product-images/mobile-accessories/iphone-12-silicone-case-with-magsafe-plum/3.webp
- Licence text: https://github.com/Ovi/DummyJSON/blob/master/LICENSE

### `/products/nintendo-switch-1.webp`

- Author / supplier: Evan-Amos, modified by Gunnar.offel
- Licence / status: Public domain
- Page: https://commons.wikimedia.org/wiki/File:Nintendo-Switch-wJoyCons-BlRd-Standing-FL.png
- Original: https://upload.wikimedia.org/wikipedia/commons/b/bc/Nintendo-Switch-wJoyCons-BlRd-Standing-FL.png
- Licence text: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/playstation-5-1.webp`

- Author / supplier: Osh33m
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:PlayStation_5_and_DualSense.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/0/00/PlayStation_5_and_DualSense.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/xbox-series-s-1.webp`

- Author / supplier: AsmodeanUnderscore
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Xbox_Series_S_with_controller.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/5/54/Xbox_Series_S_with_controller.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/sony-alpha-7-iii-1.webp`

- Author / supplier: 昼落ち
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Sony_Alpha7_III_20_apr_2018f.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/2/2c/Sony_Alpha7_III_20_apr_2018f.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/canon-eos-r6-1.webp`

- Author / supplier: FBenjr123
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Canon_EOS_R6_16.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/e/ea/Canon_EOS_R6_16.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/dyson-v8-1.webp`

- Author / supplier: "Your Best Digs"
- Licence / status: CC BY 2.0
- Page: https://commons.wikimedia.org/wiki/File:Dyson_V8_handstick_vacuum.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/4/45/Dyson_V8_handstick_vacuum.jpg
- Licence text: https://creativecommons.org/licenses/by/2.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/irobot-roomba-980-1.webp`

- Author / supplier: TAKA@P.P.R.S
- Licence / status: CC BY-SA 2.0
- Page: https://commons.wikimedia.org/wiki/File:IRobot_Roomba_980_22_(21460963853).jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/1/1e/IRobot_Roomba_980_22_%2821460963853%29.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/2.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/apple-magic-keyboard-1.webp`

- Author / supplier: File:Apple_Magic_Keyboard_-_US.jpg by Fletcher
Derivative work: AGreuet (talk · contribs)
- Licence / status: CC BY 4.0
- Page: https://commons.wikimedia.org/wiki/File:Apple_Magic_Keyboard_-_US_remix_transparent.png
- Original: https://upload.wikimedia.org/wikipedia/commons/c/c0/Apple_Magic_Keyboard_-_US_remix_transparent.png
- Licence text: https://creativecommons.org/licenses/by/4.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/iphone-15-pro-max-1.webp`

- Author / supplier: Apple Inc.
- Licence / status: Copyright Apple Inc. Not an open license. Portfolio study only; pending commercial clearance.
- Page: https://support.apple.com/en-us/111828
- Original: https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-15-pro-max.png
- Licence text: https://www.apple.com/legal/internet-services/terms/site.html

### `/products/iphone-15-pro-max-2.webp`

- Author / supplier: Apple Inc.
- Licence / status: Copyright Apple Inc. Not an open license. Portfolio study only; pending commercial clearance.
- Page: https://support.apple.com/en-us/111828
- Original: https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/111828-iphone-15-pro-max-portimage-1.png
- Licence text: https://www.apple.com/legal/internet-services/terms/site.html

### `/products/iphone-15-pro-max-3.webp`

- Author / supplier: Apple Inc.
- Licence / status: Copyright Apple Inc. Not an open license. Portfolio study only; pending commercial clearance.
- Page: https://support.apple.com/en-us/111828
- Original: https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/111828-iphone-15-pro-max-portimage-2.png
- Licence text: https://www.apple.com/legal/internet-services/terms/site.html

### `/media/iphone-15-pro-max.glb`

- Author / supplier: MpPower / MG990 (embedded GLB metadata); MajdyModels (Pane README credit)
- Licence / status: CC BY 4.0, declared both in embedded model metadata and mirror README
- Page: https://github.com/ibuhs/Pane#credits
- Original: https://raw.githubusercontent.com/ibuhs/Pane/main/Pane/Models/iphone-15-pro-max.glb
- Licence text: https://creativecommons.org/licenses/by/4.0/
- Embedded original source: https://sketchfab.com/3d-models/iphone-15-pro-max-5b7b35513a154ac69619dc2b2fe15686
- Changes: Unmodified model copied from Pane; the model has its own CC BY licence, separate from the GPL of the Pane app
- Note: The original Sketchfab page returned HTTP 403 when checked, so both the embedded and the mirror attribution are kept.

### `/products/steam-deck-1.webp`

- Author / supplier: Liam Dawe/GamingOnLinux, PNG version by VulcanSphere
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Steam_Deck_(front).png
- Original: https://upload.wikimedia.org/wikipedia/commons/5/5d/Steam_Deck_%28front%29.png
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Changes: Resized to maximum 1000 px and encoded WebP; no generative alteration

### `/products/iphone-15-1.webp`

- Author / supplier: Apple Inc.
- Licence / status: Copyright Apple Inc. Portfolio study only; pending commercial clearance. Not open licensed.
- Page: https://support.apple.com/en-us/111831
- Original: https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone_15_hero.png
- Licence text: https://www.apple.com/legal/internet-services/terms/site.html

### `/products/iphone-15-pro-1.webp`

- Author / supplier: Apple Inc.
- Licence / status: Copyright Apple Inc. Portfolio study only; pending commercial clearance. Not open licensed.
- Page: https://support.apple.com/en-us/111829
- Original: https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone_15_pro.png
- Licence text: https://www.apple.com/legal/internet-services/terms/site.html

### `/products/iphone-16-1.webp`

- Author / supplier: Apple Inc.
- Licence / status: Copyright Apple Inc. Portfolio study only; pending commercial clearance. Not open licensed.
- Page: https://support.apple.com/en-us/121029
- Original: https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/iphone-16.png
- Licence text: https://www.apple.com/legal/internet-services/terms/site.html

### `/products/sony-alpha-7-iii-clean.webp`

- Author / supplier: 昼落ち
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Sony_Alpha7_III_20_apr_2018f.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/2/2c/Sony_Alpha7_III_20_apr_2018f.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Local source: `/products/sony-alpha-7-iii-1.webp`
- Changes: Background removed; product silhouette retained, resampled WebP. Derivative remains under the source license.

### `/products/playstation-5-clean.webp`

- Author / supplier: Osh33m
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:PlayStation_5_and_DualSense.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/0/00/PlayStation_5_and_DualSense.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Local source: `/products/playstation-5-1.webp`
- Changes: Background removed; product silhouette retained, resampled WebP. Derivative remains under the source license.

### `/products/xbox-series-s-clean.webp`

- Author / supplier: AsmodeanUnderscore
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Xbox_Series_S_with_controller.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/5/54/Xbox_Series_S_with_controller.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Local source: `/products/xbox-series-s-1.webp`
- Changes: Background removed; product silhouette retained, resampled WebP. Derivative remains under the source license.

### `/products/dyson-v8-clean.webp`

- Author / supplier: "Your Best Digs"
- Licence / status: CC BY 2.0
- Page: https://commons.wikimedia.org/wiki/File:Dyson_V8_handstick_vacuum.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/4/45/Dyson_V8_handstick_vacuum.jpg
- Licence text: https://creativecommons.org/licenses/by/2.0
- Local source: `/products/dyson-v8-1.webp`
- Changes: Background removed; product silhouette retained, resampled WebP. Derivative remains under the source license.

### `/products/irobot-roomba-980-clean.webp`

- Author / supplier: TAKA@P.P.R.S
- Licence / status: CC BY-SA 2.0
- Page: https://commons.wikimedia.org/wiki/File:IRobot_Roomba_980_22_(21460963853).jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/1/1e/IRobot_Roomba_980_22_%2821460963853%29.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/2.0
- Local source: `/products/irobot-roomba-980-1.webp`
- Changes: Background removed; product silhouette retained, resampled WebP. Derivative remains under the source license.

### `/products/canon-eos-r6-reference.webp`

- Author / supplier: GodeNehler
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Canon_R6_und_RF_85_2,0-8065.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/c/c9/Canon_R6_und_RF_85_2%2C0-8065.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0

### `/products/canon-eos-r6-clean.webp`

- Author / supplier: GodeNehler
- Licence / status: CC BY-SA 4.0
- Page: https://commons.wikimedia.org/wiki/File:Canon_R6_und_RF_85_2,0-8065.jpg
- Original: https://upload.wikimedia.org/wikipedia/commons/c/c9/Canon_R6_und_RF_85_2%2C0-8065.jpg
- Licence text: https://creativecommons.org/licenses/by-sa/4.0
- Local source: `/products/canon-eos-r6-reference.webp`
- Changes: Background removed; product silhouette retained, resampled WebP. Derivative remains under the source license.

### `/media/hero-electronics.webp`

- Author / supplier: Portfolio project, composited from cited DummyJSON product images
- Licence / status: Original arrangement; underlying product-photography and trademark limitations remain. Portfolio study only; pending commercial clearance.
- Page: https://dummyjson.com/docs/products
- Original: Local project composition
- Input files: `/products/apple-macbook-pro-14-inch-space-grey-1.webp`, `/products/iphone-13-pro-2.webp`, `/products/apple-airpods-1.webp`
- Changes: Original light-blue studio composition; no reference webpage pixels reused.

### `/media/iphone-13-pro-angles.webm`

- Author / supplier: Portfolio project; source photography from DummyJSON
- Licence / status: Underlying source-image limitations remain; portfolio study only, pending commercial clearance.
- Page: https://dummyjson.com/products/123
- Original: Locally authored slideshow
- Input files: `/products/iphone-13-pro-2.webp`, `/products/iphone-13-pro-1.webp`, `/products/iphone-13-pro-3.webp`
- Changes: 12-second silent 1280×720 VP9 slideshow, three real source views, simple crossfades, original Russian captions; not a manufacturer video or a hands-on review.

## Other project images

- `/media/hero-phone-v2.png`: home page banner artwork derived from `/media/hero-phone.webp`. It is advertising artwork, not gallery photography; the gallery photos are unchanged.
- `src/app/icon.svg`: the project's V monogram, with PNG and ICO versions.

## MIT notice: DummyJSON

```text
The MIT License (MIT)

DummyJSON - Muhammad Ovi (Owais)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
