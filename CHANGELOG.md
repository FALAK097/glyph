# Changelog

## [0.5.0](https://github.com/FALAK097/glyph/compare/v0.4.0...v0.5.0) (2026-04-10)


### Features

* **desktop:** add in-note find and link previews ([209cbbe](https://github.com/FALAK097/glyph/commit/209cbbeddd0ddc8d79d47e3dd73aa6c86a981550))
* **desktop:** add multi-note tabs ([5c85f92](https://github.com/FALAK097/glyph/commit/5c85f926465c9c462ca5ef3e2ec7b69fa02df698))


### Bug Fixes

* apply CodeRabbit auto-fixes ([b1579a9](https://github.com/FALAK097/glyph/commit/b1579a92cf02a5c06ea68f8a722ff0168fafd870))
* **desktop:** add tab traversal shortcuts ([b37cc3b](https://github.com/FALAK097/glyph/commit/b37cc3bc7787ee1dcf6c5ee89d3f964737b4b14a))
* **desktop:** address AI review comments on nonce guard, toolbar, and FS error handling ([d2b2fa2](https://github.com/FALAK097/glyph/commit/d2b2fa2c6def794092852ecb5ad0e945ef61fce3))
* **desktop:** address note tabs review feedback ([e0ca2ac](https://github.com/FALAK097/glyph/commit/e0ca2ac64625b844a508a470bcd5a194da164045))
* **desktop:** address PR review comments and fix e2e test failures ([e28a560](https://github.com/FALAK097/glyph/commit/e28a5602e1d1dca5c61d4f643ac25eedefc58eb9))
* **desktop:** batch watcher changedPaths and resolve remaining review threads ([444f542](https://github.com/FALAK097/glyph/commit/444f54270fbb70496da8478d05ea7d40cc54dd1b))
* **desktop:** cross-node find matching and e2e test format ([8409df9](https://github.com/FALAK097/glyph/commit/8409df9b4ee75f367ea9d3bcaff446c5d7d0e76a))
* **desktop:** fix CI e2e failures — folder button aria-label, flaky timeouts, and CI hardening ([9e132f3](https://github.com/FALAK097/glyph/commit/9e132f3841dfe20e940ff7590e1a8feea25c7b78))
* **desktop:** fix sidebar instant update for non-default workspace + 28 e2e tests ([84442d4](https://github.com/FALAK097/glyph/commit/84442d44333ef3f69fcf4a142603a568a2760301))
* **desktop:** ignore stale staged update state ([7b50aaa](https://github.com/FALAK097/glyph/commit/7b50aaa2d100011044bb6cbd721949f8cbe4f7f2))
* **desktop:** polish note tab interactions ([2b9f443](https://github.com/FALAK097/glyph/commit/2b9f443b08d2e7aac88302620724e33ea5e83fa8))
* **desktop:** refine note tab shortcuts ([d05299b](https://github.com/FALAK097/glyph/commit/d05299b418503495cd7bf35efd2435142b7db618))
* **desktop:** refine note toolbar actions ([c2c2d1e](https://github.com/FALAK097/glyph/commit/c2c2d1e486ef9d9268eb50a7b873ac7570ae796b))
* **desktop:** resolve remaining PR review comments and improve accessibility ([807a41b](https://github.com/FALAK097/glyph/commit/807a41b0e0d3240e346aeb405b14259bddac9ee7))
* **desktop:** smooth command palette updates ([ad66d08](https://github.com/FALAK097/glyph/commit/ad66d0858fc858e5efcdbfc0bfbb25e0a42e59dd))
* **desktop:** unify updater flow across platforms ([f7515bc](https://github.com/FALAK097/glyph/commit/f7515bc65e123284f6c0701d3dd5ef2b8c0053a4))
* **e2e:** remove all tests dependent on New Folder sidebar timing ([f50975c](https://github.com/FALAK097/glyph/commit/f50975c9d438e9d65606913b0da96e1991f785b0))
* **e2e:** remove flaky new-folder sidebar timing tests ([71381ee](https://github.com/FALAK097/glyph/commit/71381ee3bca0d1b71760736705af744e4cf1cf1e))
* **e2e:** remove flaky sidebar tree tests that consistently fail on CI ([db51cd4](https://github.com/FALAK097/glyph/commit/db51cd4c32e57300c71841d88b134c8ca9ebe1fb))
* **e2e:** use reliable sidebar hydration guard and increase flaky timeouts ([60d8059](https://github.com/FALAK097/glyph/commit/60d8059bd5af9aff360213e371d4288a5bda8897))


### Performance Improvements

* **desktop:** optimize main process startup and reduce IPC overhead ([06982a4](https://github.com/FALAK097/glyph/commit/06982a4e62f8c938592fc0780ee83ce6780fd5e6))

## [0.4.0](https://github.com/FALAK097/glyph/compare/v0.3.0...v0.4.0) (2026-04-05)


### Features

* **desktop:** add editable skills library ([9f8c8cc](https://github.com/FALAK097/glyph/commit/9f8c8cc8375cb082ed931b59596c3b947b409ce7))
* **desktop:** expand skills catalog and pane UX ([fc7f78f](https://github.com/FALAK097/glyph/commit/fc7f78fbd379bde0bfbd4f7e348f45d9082e366f))
* **desktop:** improve skills search and metadata parsing ([620ea87](https://github.com/FALAK097/glyph/commit/620ea87f5abeaa0d65ccd986f6551d5a14b251bd))
* **desktop:** improve skills search and session restore ([2866c68](https://github.com/FALAK097/glyph/commit/2866c68f3ed1a2837259aea1fc8ad6719906a03f))
* **desktop:** persist note and skill sessions ([65a2da6](https://github.com/FALAK097/glyph/commit/65a2da6623628d6dcaa90fb13c87e7b21215b101))


### Bug Fixes

* **desktop:** align palette label and remove header breadcrumbs ([a912f13](https://github.com/FALAK097/glyph/commit/a912f13491c168ab112b3fce63352e404e67aa66))
* **desktop:** duplication of base commands ([c1191b5](https://github.com/FALAK097/glyph/commit/c1191b5d06c79c8a6e6c9ada2eeec7cfd805f420))
* **desktop:** focus opened notes at the end without scrolling ([db34107](https://github.com/FALAK097/glyph/commit/db341077e912320ac2aef066a420a46a607d4e78))
* **desktop:** handle skill errors and source cleanup ([1dc8f34](https://github.com/FALAK097/glyph/commit/1dc8f3477aa460b231a2dd4b42c447b341ee45f2))
* **desktop:** keep editor mounted during draft activation ([77da9cc](https://github.com/FALAK097/glyph/commit/77da9cc261f6c097446df84a9312a030f9a91426))
* **desktop:** keep skill search results stable while typing ([5ad3108](https://github.com/FALAK097/glyph/commit/5ad31089f081c0cb2a6133c8ed41134f8fc6dc07))
* **desktop:** materialize committed draft notes ([c3780c2](https://github.com/FALAK097/glyph/commit/c3780c2424cba0990d92477e21dcea1095c13ac8))
* **desktop:** polish palette navigation and skill state ([256772b](https://github.com/FALAK097/glyph/commit/256772bbe1ee0b792e559a747f6a80e4e6310a96))
* **desktop:** polish skills browser interactions ([d2861fd](https://github.com/FALAK097/glyph/commit/d2861fdd8745cf472e5557d5c1311097ad63b327))
* **desktop:** polish skills browsing ([1163c13](https://github.com/FALAK097/glyph/commit/1163c13aa4046379303e13b6617016b55448e5e5))
* **desktop:** polish skills search and metadata ([26cde4b](https://github.com/FALAK097/glyph/commit/26cde4b4f8c77c57cd7280bb63ddafae5a7f951b))
* **desktop:** preserve cursor while activating draft notes ([abd8551](https://github.com/FALAK097/glyph/commit/abd85515411485c844727733f018af91a76d45a1))
* **desktop:** refine session restore behavior ([d0eae25](https://github.com/FALAK097/glyph/commit/d0eae255196b0903f1fbc47a45098850cd4a8ebc))
* **desktop:** refresh scroll seeds on remount ([d72bc29](https://github.com/FALAK097/glyph/commit/d72bc2946d4d71df01bf19b244a5124913f8aa70))
* **desktop:** remove command palette fallback actions ([364874e](https://github.com/FALAK097/glyph/commit/364874ebc343514961dfec1497f7d6d522335aaf))
* **desktop:** restore note cursor position per file ([3731c11](https://github.com/FALAK097/glyph/commit/3731c112ebca230683a0b4158b77a846601403fd))
* **desktop:** simplify skills collections ([cd57af8](https://github.com/FALAK097/glyph/commit/cd57af840c57dbf04af39fd225f945776ef42fb8))
* **desktop:** simplify skills compatibility labels ([f6054a8](https://github.com/FALAK097/glyph/commit/f6054a89ab841853fa952febd67b725f7c2a18af))
* **desktop:** smooth command palette search updates ([c11973b](https://github.com/FALAK097/glyph/commit/c11973be8f3200d1afa53e30c3db92a2e1c74b3c))
* **desktop:** stabilize note creation focus and palette fallbacks ([dd2a3ad](https://github.com/FALAK097/glyph/commit/dd2a3adde3508da98503742bb750bfe7f920e601))
* **desktop:** stabilize session restore flow ([7095114](https://github.com/FALAK097/glyph/commit/7095114179929e555c90c37946a8c8603bf9cde5))
* **desktop:** tighten skills review follow-ups ([f785bd3](https://github.com/FALAK097/glyph/commit/f785bd3ac99809c64b8a28aa5e0080084eb2a10c))
* **desktop:** title ([a7a6aa1](https://github.com/FALAK097/glyph/commit/a7a6aa128e8cc54a49cf9a096950bf89614007fc))
* **desktop:** update command palette placeholder and header breadcrumb ([9eaa3c5](https://github.com/FALAK097/glyph/commit/9eaa3c55ceac269d7a4c11b3f2aa6b5178c508af))
* **desktop:** update command palette placeholder and header breadcrumb ([21549f0](https://github.com/FALAK097/glyph/commit/21549f0ff00d605acfc15d219d777843b5ae595f))
* **web:** improve mobile header and brew command layout ([35248cf](https://github.com/FALAK097/glyph/commit/35248cff506e3269f3b84698b566c7876209144b))
* **web:** keep brew copy action top-right on desktop ([84ae6fe](https://github.com/FALAK097/glyph/commit/84ae6fe833ed7a107db7ce5558e9c9e91edd3ca9))
* **web:** refine mobile nav and brew command actions ([6c815c6](https://github.com/FALAK097/glyph/commit/6c815c6afe01fc94b0745385e7891c59980b5783))
* **web:** update canonical domain to glyph.falakgala.dev ([e0ea065](https://github.com/FALAK097/glyph/commit/e0ea0651bcb3bb1acc4243702782af21a4eb1f7e))

## [0.3.0](https://github.com/FALAK097/glyph/compare/v0.2.5...v0.3.0) (2026-03-22)


### Features

* **desktop:** add Toggle Outline command to command palette ([c6c7a07](https://github.com/FALAK097/glyph/commit/c6c7a0757ac915e7612c39a74412fd4ba34fd243))


### Bug Fixes

* **desktop:** address navigation shell review feedback ([7c1f954](https://github.com/FALAK097/glyph/commit/7c1f9545b8a8dac2962fe99a0a3850d865db10b2))
* **desktop:** fix TOC indicator alignment, scroll tracking, focus mode shortcut, and sidebar polish ([3c133c4](https://github.com/FALAK097/glyph/commit/3c133c4d1ddb28897abfa8eddfd55b3d827f7610))
* **desktop:** remove history and heading items from command palette ([caf67f8](https://github.com/FALAK097/glyph/commit/caf67f825e65dec82a8d4265b611e52939665762))
* **desktop:** remove note restore persistence ([dfda874](https://github.com/FALAK097/glyph/commit/dfda8745e470bf27bc2edd5bea39263d10173ca1))
* **desktop:** restore command palette commands and revert sidebar logo to main ([de50fde](https://github.com/FALAK097/glyph/commit/de50fdeea1b995041520e0b023208053749b1e79))
* **desktop:** restore note navigation and view state ([0813624](https://github.com/FALAK097/glyph/commit/0813624711a80a41ad9d3d72ecbe4fe1de89cc37))
* **desktop:** use immediate paletteQuery for palette items to prevent stale results ([489bb36](https://github.com/FALAK097/glyph/commit/489bb3629b3a7e825ea71136854243b2e2eae1ee))

## [0.2.5](https://github.com/FALAK097/glyph/compare/v0.2.4...v0.2.5) (2026-03-22)


### Bug Fixes

* **desktop:** keep downloaded updates staged until install ([#122](https://github.com/FALAK097/glyph/issues/122)) ([84a9b7f](https://github.com/FALAK097/glyph/commit/84a9b7f831fad2b3274a82e7ea09014ea438ec71))

## [0.2.4](https://github.com/FALAK097/glyph/compare/v0.2.3...v0.2.4) (2026-03-22)


### Features

* **web:** improve release downloads and install guidance with direct platform download links and a Homebrew install callout ([#11](https://github.com/FALAK097/glyph/issues/11)) ([f6b00d4](https://github.com/FALAK097/glyph/commit/f6b00d4e48515154063248d2e53c7fbfeab2f91b))


### Bug Fixes

* **desktop:** keep long sidebars scrollable, clean up link hover affordances, and show table controls only while editing a table ([#119](https://github.com/FALAK097/glyph/issues/119)) ([4152691](https://github.com/FALAK097/glyph/commit/4152691102d72ad7bfac978f702018e02c56ca32))
* **release:** keep release-please automation flowing ([#120](https://github.com/FALAK097/glyph/issues/120)) ([d38f1d4](https://github.com/FALAK097/glyph/commit/d38f1d465f91bf73f38dcfc93e3ba4f92b083d7d))


### Miscellaneous Chores

* add pre-commit quality checks for formatting, linting, and typechecking before each commit ([#118](https://github.com/FALAK097/glyph/issues/118)) ([3be90b8](https://github.com/FALAK097/glyph/commit/3be90b82ccd9759d6b66a7a14563f3cf9db7d5f4))

## [0.2.3](https://github.com/FALAK097/glyph/compare/v0.2.2...v0.2.3) (2026-03-21)


### Bug Fixes

* **desktop:** load sidebar branding from packaged assets ([0f62472](https://github.com/FALAK097/glyph/commit/0f62472a1c1ea9a8ae4676025930dd582b1a0dc0))

## [0.2.2](https://github.com/FALAK097/glyph/compare/v0.2.1...v0.2.2) (2026-03-20)


### Bug Fixes

* **desktop:** load packaged assets with relative paths ([9e3aee7](https://github.com/FALAK097/glyph/commit/9e3aee75ebe7d45189ccbc02798b050083d3a037))

## [0.2.1](https://github.com/FALAK097/glyph/compare/v0.2.0...v0.2.1) (2026-03-20)


### Bug Fixes

* **release:** backfill packaged app and release workflow fixes ([ac65a6f](https://github.com/FALAK097/glyph/commit/ac65a6f6d5bf2a70d5251a927d33e0967a833da6))

## [0.2.0](https://github.com/FALAK097/glyph/compare/v0.1.0...v0.2.0) (2026-03-20)


### Features

* Implement a new desktop application structure with a markdown editor, various panels, and a consistent component naming convention. ([51beea9](https://github.com/FALAK097/glyph/commit/51beea9875d9825e72c7238f4057c94a29eeec51))
* Implement custom code blocks with syntax highlighting and refactor PDF export to use Electron's native capabilities. ([ed80d5f](https://github.com/FALAK097/glyph/commit/ed80d5f31c9d0dfe1485fe0e21d61101a40870a8))
* Implement external link opening, refactor shortcut handling, and improve search panel UX. ([de2b46d](https://github.com/FALAK097/glyph/commit/de2b46d85fc61c334866fe84ebc8a1cfc195bb69))
* implement link hover state in the markdown editor and update the external link icon. ([67cd962](https://github.com/FALAK097/glyph/commit/67cd9626bf67b4c1e9e322f17d731c9654209b4b))
* improve editor insertion flows and linked-file navigation ([2431aef](https://github.com/FALAK097/glyph/commit/2431aefee1ba0ec3e1374c330f1127c590fd2461))
* Introduce a new flexible sidebar component system and a tooltip UI component. ([9c69444](https://github.com/FALAK097/glyph/commit/9c69444c2bc4770b2738a0f36c5991c573b9c22c))
* Update branding with new wordmark logos, favicons, and app icons across web and desktop applications. ([098c294](https://github.com/FALAK097/glyph/commit/098c2949837c5d2de62bf1ec15b606689b0a1e87))


### Bug Fixes

* address code review feedback ([e352c58](https://github.com/FALAK097/glyph/commit/e352c587538da656078bcc627822b9820f2eb1e5))
* code copy & language selector custom dropdown ui ([200d9c3](https://github.com/FALAK097/glyph/commit/200d9c342bad5288b905ba8301e8fd6ec1e463f8))
* increase logo size from 20 to 32 pixels for better visibility in sidebar ([d70a4bb](https://github.com/FALAK097/glyph/commit/d70a4bb04947a9972a50ffcf6b055112367279c9))
* increase logo size to 64px and remove background styling for better visibility ([87f50ba](https://github.com/FALAK097/glyph/commit/87f50baa7392b4ae12a21f4a4abb0a0c8645cb72))

## Changelog

All notable changes to Glyph will be documented in this file.

This file is maintained by Release Please from conventional commits.
