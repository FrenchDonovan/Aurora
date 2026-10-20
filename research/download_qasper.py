from pathlib import Path
import hashlib
import io
import json
import tarfile
import urllib.request

import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path('work/qasper/raw'))
args=parser.parse_args()
root=args.output
root.mkdir(parents=True, exist_ok=True)
urls = [
    'https://qasper-dataset.s3.us-west-2.amazonaws.com/qasper-train-dev-v0.3.tgz',
    'https://qasper-dataset.s3.us-west-2.amazonaws.com/qasper-test-and-evaluator-v0.3.tgz',
]
records = []
for url in urls:
    archive = root / url.rsplit('/', 1)[1]
    if not archive.exists():
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Aurora-research'}), timeout=90) as response:
            data = response.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024:
            raise RuntimeError('Unexpectedly large benchmark archive')
        archive.write_bytes(data)
    data = archive.read_bytes()
    extracted = []
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as contents:
        for member in contents.getmembers():
            if member.isfile() and member.name.endswith('.json'):
                name = Path(member.name).name
                if name.startswith('qasper-') and member.size < 64 * 1024 * 1024:
                    content = contents.extractfile(member).read()
                    destination = root / name
                    destination.write_bytes(content)
                    obj = json.loads(content)
                    extracted.append({'file': name, 'papers': len(obj), 'sha256': hashlib.sha256(content).hexdigest()})
    records.append({'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'extracted': extracted})
manifest = {'source': 'Ai2 QASPER v0.3', 'dataset_card_revision': 'fdc9d8214fbab5dd782958601db4d678e6934a54', 'dataset_license': 'CC-BY-4.0', 'license_source': 'https://huggingface.co/datasets/allenai/qasper/blob/fdc9d8214fbab5dd782958601db4d678e6934a54/README.md', 'archives': records}
(root / 'download-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest))
