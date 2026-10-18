import copy
import json

import pytest

from yogyata_ai.common.audit import (
    GENESIS, AuditLog, AuditTamperError, append_event, audit_evidence_additions, extends, merge_logs, verify_log,
)
from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile

T = "2026-10-18T10:00:00+00:00"


def ev(log=None, **kw):
    base = dict(subject_type="skill_evidence", subject_id="SQL", previous={"state": "not_assessed"}, new={"state": "demonstrated", "score": 0.8},
                source="interview_auto", reason="new automated evidence", actor="automatic", timestamp=T)
    base.update(kw)
    return append_event(log, **base)


def test_append_creates_chained_events_and_does_not_mutate_input():
    a = ev()
    b = ev(a, subject_id="Python")
    assert len(a.events) == 1 and len(b.events) == 2
    assert a.events[0].prev_hash == GENESIS and b.events[1].prev_hash == a.events[0].hash
    assert [e.seq for e in b.events] == [1, 2] and b.events[1].event_id == "evt-000002"
    assert verify_log(b) == []


def test_event_records_all_required_fields():
    e = ev(actor="reviewer", actor_id="rev-7", source="task_review").events[0]
    assert (e.subject_id, e.previous.state, e.new.score, e.source, e.actor, e.actor_id, e.timestamp) == \
           ("SQL", "not_assessed", 0.8, "task_review", "reviewer", "rev-7", T)
    assert e.reason == "new automated evidence" and len(e.hash) == 64


@pytest.mark.parametrize("mutate", [
    lambda d: d["events"][0].__setitem__("reason", "edited"),
    lambda d: d["events"][0]["new"].__setitem__("score", 0.1),
    lambda d: d["events"].pop(0),
    lambda d: d["events"].reverse(),
    lambda d: d["events"][1].__setitem__("prev_hash", GENESIS),
])
def test_tampering_is_detected_and_refused(mutate):
    log = ev(ev(), subject_id="Python")
    d = copy.deepcopy(log.model_dump())
    mutate(d)
    bad = AuditLog(**d)
    assert verify_log(bad)
    with pytest.raises(AuditTamperError):
        ev(bad, subject_id="X")  # ordinary updates refuse to build on a broken log


def test_merge_accepts_extension_and_refuses_overwrite():
    stored = ev()
    longer = ev(stored, subject_id="Python")
    assert merge_logs(stored, longer) is longer and extends(stored, longer)
    assert merge_logs(stored, stored) is stored
    other = ev(subject_id="Different")  # same length-1 history but different content
    with pytest.raises(AuditTamperError):
        merge_logs(stored, other)
    with pytest.raises(AuditTamperError):
        merge_logs(longer, stored)  # shorter (history removed)


def test_reason_is_pii_scrubbed_trimmed_and_required():
    e = ev(reason="Reviewer note: contact priya@example.com or +91 98765 43210 " + "x" * 400).events[0]
    assert "@" not in e.reason and "98765" not in e.reason and len(e.reason) <= 300
    with pytest.raises(ValueError):
        ev(reason="   ")


def test_validation_of_ids_actor_and_scores():
    with pytest.raises(ValueError):
        ev(subject_id="bad\nid")
    with pytest.raises(ValueError):
        ev(actor="reviewer")  # reviewer needs an id
    with pytest.raises(ValueError):
        ev(actor="automatic", actor_id="x")
    with pytest.raises(Exception):
        ev(new={"score": float("nan")})
    with pytest.raises(Exception):
        ev(subject_type="free_text")
    with pytest.raises(ValueError):
        ev(timestamp="not a time")


def test_log_is_json_roundtrippable_and_still_verifies():
    log = ev(ev(), subject_id="Python")
    again = AuditLog(**json.loads(json.dumps(log.model_dump(mode="json"))))
    assert verify_log(again) == [] and again == log


def test_skill_names_with_spaces_and_symbols_are_valid_subjects():
    assert ev(subject_id="Data Visualization").events[0].subject_id == "Data Visualization"
    assert ev(subject_id="C++").events[0].subject_id == "C++"


def test_audit_evidence_additions_logs_only_changes():
    p = StudentProfile()
    rec = EvidenceRecord(skill="sql", source="interview_auto", strength=0.9)
    log, p2 = audit_evidence_additions(None, p, [rec], reason="mock interview evaluated", timestamp=T)
    assert len(log.events) == 1 and len(p.evidence) == 0 and len(p2.evidence) == 1
    e = log.events[0]
    assert e.subject_id == "SQL" and e.previous.state == "not_assessed" and e.new.state == "demonstrated" and e.actor == "automatic"
    # an identical record changes neither state nor mean score -> no event
    log2, _ = audit_evidence_additions(log, p2, [rec], reason="duplicate", timestamp=T)
    assert len(log2.events) == 1
    # a reviewed record that lowers the score is logged with its source
    rev = EvidenceRecord(skill="SQL", source="task_review", strength=0.3)
    log3, _ = audit_evidence_additions(log2, p2, [rev], reason="task reviewed", timestamp=T, actor="reviewer", actor_id="rev-1")
    last = log3.events[-1]
    assert last.source == "task_review" and last.previous.state == "demonstrated" and last.new.state == "partially_demonstrated" and last.actor == "reviewer"
    assert verify_log(log3) == []


def test_no_sensitive_fields_exist_on_events():
    fields = set(ev().events[0].model_dump())
    assert fields == {"seq", "event_id", "timestamp", "subject_type", "subject_id", "previous", "new", "source", "reason", "actor",
                      "actor_id", "prev_hash", "hash"}
