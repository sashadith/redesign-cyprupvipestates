Plus Properties fixtures, captured 2026-09-25 with scripts/plus-capture-fixtures.mjs.

`plus-<key>.xml` is the developer's workbook exactly as downloaded from Drive.
`plus-<key>.pdf.txt` is `pdftotext -layout` of their own PDF printout of it —
the ground truth scripts/qa/plus-pdf-check.mjs compares the parser against.
`plus-33-page.html` is their project page, for the Project Details reader.
`plus-87-page.html` and `plus-60-page.html` (captured 2026-09-26) are the two
other layouts of that block: label then ". " lines, and ". " lines with no label.
`plus-88-page.html`, `plus-56-page.html`, `plus-79-page.html` and
`plus-67-68-69-page.html` (captured 2026-09-26) are three more: an unbolded
label then "•" lines (88), an unlabelled <ul> (56, 79), and a <span> label
then ". " lines with empty <p>s between them (67-68-69).
`plus-77.xml` and `plus-92.xml` (captured 2026-09-26, no PDF) carry sub-area
rows ("Roof Garden", "Mezzanine") that continue the unit above them.

Do not edit these files to make a test pass. If the developer's format
changes, capture new fixtures and keep the old ones beside them.
