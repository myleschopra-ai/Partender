import json
from pathlib import Path
path=Path(__file__).parent/'video_trial_results.jsonl'
rows={j['scenario']:j for j in map(json.loads,path.read_text().splitlines())}
expected={'straight_clear-h264':True,'push_right-h264':True,'camera_shake-h264':False,'occluded-h264':False,'low_light-h264':False}
assert set(rows)==set(expected),(rows.keys(),expected.keys())
for scenario,should_detect in expected.items():
    r=rows[scenario]
    assert (r.get('impact') is not None)==should_detect,(scenario,r)
    if should_detect:
        # Synthetic model impact t=1.5 seconds. Not a device timing accuracy estimate.
        assert 0<=r.get('impact')-1.5<=0.20,(scenario,r['impact'])
        assert not any(m['label']=='Face angle' and m.get('value') is not None for m in r['metrics'])
print('VIDEO TESTS: 5/5 PASS; clear/push events proposed, shake/occlusion/low light withheld')
for k,r in rows.items():print(f"{k}: {r['impact'] if r.get('impact') is not None else 'withheld'}")
