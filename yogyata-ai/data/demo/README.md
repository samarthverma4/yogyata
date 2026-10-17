# Demonstration data

**All files here are synthetic demonstration data.** Resumes and job descriptions were written by the
project author; names are invented; labels in `labels.json` were assigned by hand by the same author.

- `resumes/` – 8 short resumes spanning strong / average / weak quality.
- `labels.json` – expected skills, quality band (2 strong, 1 average, 0 weak), and graded
  job-relevance labels (2 strong fit, 1 partial, 0 none; omitted = 0).

Because the set is tiny and author-labelled, any metric computed on it is a **sanity check, not an
estimate of real-world accuracy**. Replace it with consented, anonymised real data before drawing conclusions.
