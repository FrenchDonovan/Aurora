# Code and third-party data rights

The root MIT license applies to original Aurora source code, not to third-party paper text or datasets. No ownership of source papers or benchmark annotations is claimed.

## QASPER v0.3

Aurora redistributes a deterministic subset of the **QASPER** dataset by Pradeep Dasigi, Kyle Lo, Iz Beltagy, Arman Cohan, Noah A. Smith and Matt Gardner (2021), *A Dataset of Information-Seeking Questions and Answers Anchored in Research Papers*. Dataset: https://huggingface.co/datasets/allenai/qasper (revision fdc9d8214fbab5dd782958601db4d678e6934a54). Paper: https://aclanthology.org/2021.naacl-main.365/ . Dataset license: **Creative Commons Attribution 4.0**, https://creativecommons.org/licenses/by/4.0/ . Original v0.3 archives: https://qasper-dataset.s3.us-west-2.amazonaws.com/qasper-train-dev-v0.3.tgz and https://qasper-dataset.s3.us-west-2.amazonaws.com/qasper-test-and-evaluator-v0.3.tgz . See `data/qasper/manifest.json` for file hashes and paper selection.

Changes: paper subsampling; paragraph trimming, whitespace-normalized deduplication and length filtering; conversion to Aurora schema; exact-whitespace evidence alignment, union of human-selected references, assumed negatives, partition/eligibility mapping, model features and predictions. Original extraction markers such as BIBREF are retained. Paragraphs are dataset extractions and have not been independently checked against current PDFs. QASPER annotations are original human benchmark work, not new Aurora human adjudication. Dataset redistribution license does not assert that every underlying research paper has the same license. Authors and submission years in paper records may be incomplete; follow each original arXiv record.

## Original eight-excerpt preview

Paper excerpts remain third-party text under their respective rights. Individual records and `docs/DATASET_CARD.md` distinguish verified source licenses from unknown permission. Original Aurora curator commentary is separate. The seed collection is a limited excerpt demonstration, not the QASPER study collection. MIT does not relicense those quotations. No general reuse permission is inferred merely from public access or excerpt length.
