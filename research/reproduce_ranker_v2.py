"""Retrain in an isolated directory; preserve released model, freeze and outcomes."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from .ranker_v2 import ROOT,read,dump


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--raw',type=Path,required=True);parser.add_argument('--freeze-repository',type=Path,default=ROOT);args=parser.parse_args()
    raw=args.raw.resolve();target=ROOT/'work/ranker-v2/retraining-verification'
    assert ROOT.resolve() in target.resolve().parents
    assert not target.exists(),'Use a new clean verification directory; preserve previous verification output'
    target.mkdir(parents=True)
    for directory in ['research','data','web']:shutil.copytree(ROOT/directory,target/directory,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    def run(*arguments):subprocess.run([sys.executable,'-m','research.ranker_v2',*arguments,'--raw',str(raw)],cwd=target,check=True)
    run('prepare');run('train')
    original=read(ROOT/'data/ranker-v2/freeze.json');retrained=read(target/'data/ranker-v2/freeze.json')
    keys=set(original)-{'training_seconds_descriptive'}
    assert {k:original[k] for k in keys}=={k:retrained[k] for k in keys},'Retraining does not match released stable freeze fields; preserve the difference'
    for file in ['model','statistics']:
        content=(target/f'web/data/study-v2/{file}.json').read_bytes().rstrip(b'\r\n')
        assert hashlib.sha256(content).hexdigest()==original[file+'_sha256']
    # Only the descriptive duration differs. Restore the original metadata in
    # this isolated directory so the pre-test Git-object comparison is exact.
    # The independently refitted model/statistics/selection were checked above.
    shutil.copy2(ROOT/'data/ranker-v2/freeze.json',target/'data/ranker-v2/freeze.json')
    commit=read(ROOT/'web/data/study-v2/report.json')['pretest_commit']
    run('test','--freeze-commit',commit,'--freeze-repository',str(args.freeze_repository.resolve()),'--reproduce')
    result={'kind':'Isolated exact retraining and outcome verification, not a new held-out evaluation','stable_freeze_fields_match':True,'model_sha256':original['model_sha256'],'training_data_sha256':original['training_data_sha256'],'statistics_sha256':original['statistics_sha256'],'fresh_predictions_match':True,'pretest_commit':commit,'retraining_seconds_descriptive':retrained['training_seconds_descriptive'],'original_outputs_modified':False}
    dump(ROOT/'data/ranker-v2/retraining-verification.json',result);print(json.dumps(result))
if __name__=='__main__':main()
