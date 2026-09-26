Plus Properties fixtures, captured 2026-09-25 with scripts/plus-capture-fixtures.mjs.

`plus-<key>.xml` is the developer's workbook exactly as downloaded from Drive.
`plus-<key>.pdf.txt` is `pdftotext -layout` of their own PDF printout of it —
the ground truth scripts/qa/plus-pdf-check.mjs compares the parser against.
`plus-33-page.html` is their project page, for the Project Details reader.

Do not edit these files to make a test pass. If the developer's format
changes, capture new fixtures and keep the old ones beside them.
