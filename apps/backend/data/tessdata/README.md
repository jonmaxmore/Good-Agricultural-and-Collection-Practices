# Tesseract language models (tessdata) — REQUIRED AT DEPLOY TIME

This directory is the `langPath` for every tesseract.js worker in the backend.
It is wired in `services/ocr/tessdata.js` and consumed by:

- `services/ocr/tesseract-service.js` (`Tesseract.createWorker(['tha','eng'], …)`)
- `services/fraud-detection/document-verification-methods.js` (`createWorker('tha+eng', …)`)

## Files that must be present

| file               | language          | typical size |
| ------------------ | ----------------- | ------------ |
| `tha.traineddata`  | Thai              | ~4–8 MB      |
| `eng.traineddata`  | English           | ~4–15 MB     |

**Uncompressed `.traineddata`, not `.traineddata.gz`.** The worker options set
`gzip: false`, so a `.gz` file here will not be found. (If you prefer to ship
the gzipped models, drop the `.gz` files here instead and flip `gzip` back to
`true` in `services/ocr/tessdata.js` — do not mix the two.)

Set `TESSDATA_PATH` to override this directory (e.g. a mounted volume or an
image layer populated from a DTAM-internal artifact store).

## Where they come from

Upstream source: the Tesseract OCR project's model repositories, Apache-2.0
licensed.

- `tessdata_fast` — <https://github.com/tesseract-ocr/tessdata_fast> (smallest,
  what tesseract.js's own CDN build is derived from; recommended)
- `tessdata_best` — <https://github.com/tesseract-ocr/tessdata_best> (slower,
  higher accuracy)

Fetch them **once, on a machine that is allowed outbound**, verify the
checksums, and publish them to the DTAM-internal artifact store / bake them
into the container image. They are static model files — they do not need to be
re-fetched at runtime and must never be fetched at runtime from a production
host.

```sh
# run OUTSIDE the sovereign network, then transfer the two files in
curl -fL -o tha.traineddata \
  https://github.com/tesseract-ocr/tessdata_fast/raw/main/tha.traineddata
curl -fL -o eng.traineddata \
  https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata
```

The binaries are **not committed to this repository** — they are multi-megabyte
blobs and the environment this change was made in has no outbound access to
fetch them. Add them to the image build (or mount them) before the OCR paths
are exercised.

## Why this directory exists

Until 2026-07-25 neither `createWorker` call passed `langPath`. tesseract.js's
documented fallback in that case is a download from a foreign CDN
(`cdn.jsdelivr.net/npm/@tesseract.js-data/...`, see
`node_modules/tesseract.js/src/worker-script/index.js:127-130`), so the first
OCR on a production host fetched the models from outside Thailand. The OCR
itself was always local — the uploaded national-ID image never left the server,
and it still does not — but the model download was an unconditional foreign
runtime dependency on the ID-document verification path, and it meant a
sovereignty egress lockdown would silently break ID-card verification.

## Failure behaviour

If a model file is missing, the worker throws `ENOENT` naming the expected path
and the caller surfaces a failed OCR check (`tesseract-service.js` re-throws
from `initialize()`; `document-verification-methods.js` returns a failed
`OCR Validation` result). That is deliberate: a loud local failure is correct,
a silent foreign fetch is not.
