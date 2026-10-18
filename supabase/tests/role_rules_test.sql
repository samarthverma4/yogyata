-- Rolled-back test of the founder endorsement, mentor review, talent search and invitation rules.
-- Paste into the Supabase SQL editor and run. It always ends with an error that starts with
-- "RESULT:" and lists ok<n> or FAIL<n> for each check; that error rolls everything back,
-- so no test users or rows are left behind.
do $$
declare
  f uuid := gen_random_uuid(); s uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
  m uuid := gen_random_uuid(); rc uuid := gen_random_uuid();
  t uuid; sub uuid; sk uuid; rv uuid; inv uuid; n int; lvl text; out text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (f,  'f@test.local',  '{"role":"entrepreneur","full_name":"Fay Founder"}', 'authenticated','authenticated'),
    (s,  's@test.local',  '{"role":"seeker","full_name":"Sam Seeker"}',        'authenticated','authenticated'),
    (s2, 's2@test.local', '{"role":"seeker","full_name":"Pia Private"}',       'authenticated','authenticated'),
    (m,  'm@test.local',  '{"role":"mentor","full_name":"Meera Mentor"}',      'authenticated','authenticated'),
    (rc, 'r@test.local',  '{"role":"recruiter","full_name":"Rahul Recruiter"}','authenticated','authenticated');

  -- mentors and recruiters start as pending; approve the test ones so their rules can be checked
  update public.profiles set approval = 'approved' where id in (m, rc);

  set local role authenticated;

  -- ── Founder endorsement ──
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role','authenticated')::text, true);
  insert into public.tasks (founder_id, client_id, title, required_skills, status)
    values (f, 'task-1', 'Build a landing page', array['React','Figma'], 'published') returning id into t;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  insert into public.seeker_details (id, headline, location, answers)
    values (s, 'Frontend dev', 'Mandi', '{"privacy":{"visibility":"discoverable","recruiterSharingConsent":true}}');
  insert into public.passport_skills (seeker_id, skill_name) values (s, 'react');
  insert into public.passport_skills (seeker_id, skill_name) values (s, 'SQL') returning id into sk;
  insert into public.submissions (task_id, seeker_id, deliverable_url, notes) values (t, s, 'https://example.com/pr', 'done') returning id into sub;
  begin perform public.endorse_submission_skill(sub, 'React'); out := out || 'FAIL1 seeker self-endorsed; ';
  exception when others then out := out || 'ok1; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role','authenticated')::text, true);
  select count(*) into n from public.submissions x join public.tasks y on y.id = x.task_id where y.founder_id = f and y.client_id = 'task-1';
  out := out || case when n = 1 then 'ok2; ' else 'FAIL2 founder list; ' end;
  begin perform public.endorse_submission_skill(sub, 'React'); out := out || 'FAIL3 endorsed before accept; ';
  exception when others then out := out || 'ok3; '; end;
  update public.submissions set status = 'accepted', feedback = 'Great', rating = 5, reviewed_at = now() where id = sub;
  begin perform public.endorse_submission_skill(sub, 'Python'); out := out || 'FAIL4 off-task skill; ';
  exception when others then out := out || 'ok4; '; end;
  perform public.endorse_submission_skill(sub, 'React');
  perform public.endorse_submission_skill(sub, 'figma');

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  select level::text into lvl from public.passport_skills where seeker_id = s and lower(skill_name) = 'react';
  select count(*) into n from public.passport_skills where seeker_id = s and level = 'verified' and source_submission_id = sub;
  out := out || case when lvl = 'verified' and n = 2 then 'ok5; ' else format('FAIL5 lvl=%s n=%s; ', lvl, n) end;
  delete from public.passport_skills where seeker_id = s and lower(skill_name) = 'react';
  get diagnostics n = row_count;
  out := out || case when n = 0 then 'ok6; ' else 'FAIL6 verified deleted; ' end;

  -- ── Mentor review ──
  begin insert into public.skill_reviews (skill_id, seeker_id, skill_name, evidence_url)
          select id, s, skill_name, 'https://x.dev' from public.passport_skills where seeker_id = s and lower(skill_name) = 'react';
        out := out || 'FAIL7 review of verified skill; ';
  exception when others then out := out || 'ok7; '; end;
  begin insert into public.skill_reviews (skill_id, seeker_id, skill_name, evidence_url) values (sk, s, 'Cobol', 'https://x.dev');
        out := out || 'FAIL8 mismatched name; ';
  exception when others then out := out || 'ok8; '; end;
  insert into public.skill_reviews (skill_id, seeker_id, skill_name, evidence_url, note)
    values (sk, s, 'SQL', 'https://github.com/s/sql', 'queries') returning id into rv;
  begin insert into public.skill_reviews (skill_id, seeker_id, skill_name, evidence_url) values (sk, s, 'SQL', 'https://x.dev');
        out := out || 'FAIL9 duplicate open; ';
  exception when others then out := out || 'ok9; '; end;
  begin perform public.mentor_review_skill(rv, 'assessed', ''); out := out || 'FAIL10 seeker decided; ';
  exception when others then out := out || 'ok10; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated')::text, true);
  select count(*) into n from public.skill_reviews where id = rv;
  out := out || case when n = 0 then 'ok11; ' else 'FAIL11 other seeker sees review; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role','authenticated')::text, true);
  begin perform public.mentor_review_skill(rv, 'assessed', ''); out := out || 'FAIL12 founder decided; ';
  exception when others then out := out || 'ok12; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role','authenticated')::text, true);
  select count(*) into n from public.skill_reviews where id = rv;
  out := out || case when n = 1 then 'ok13; ' else 'FAIL13 mentor queue; ' end;
  select count(*) into n from public.profiles where id = s;
  out := out || case when n = 1 then 'ok14; ' else 'FAIL14 mentor cannot see name; ' end;
  select count(*) into n from public.profiles where id = s2;
  out := out || case when n = 0 then 'ok15; ' else 'FAIL15 mentor sees unrelated seeker; ' end;
  begin perform public.mentor_review_skill(rv, 'declined', ''); out := out || 'FAIL16 decline without feedback; ';
  exception when others then out := out || 'ok16; '; end;
  begin update public.skill_reviews set status = 'assessed' where id = rv; out := out || 'FAIL17 direct update; ';
  exception when others then out := out || 'ok17; '; end;
  perform public.mentor_review_skill(rv, 'assessed', 'Solid joins');
  begin perform public.mentor_review_skill(rv, 'declined', 'again'); out := out || 'FAIL18 decided twice; ';
  exception when others then out := out || 'ok18; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  select level::text into lvl from public.passport_skills where id = sk;
  out := out || case when lvl = 'assessed' then 'ok19; ' else format('FAIL19 lvl=%s; ', lvl) end;

  -- ── Talent search ──
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated')::text, true);
  insert into public.seeker_details (id, headline, answers)
    values (s2, 'Hidden', '{"privacy":{"visibility":"private","recruiterSharingConsent":false}}');
  insert into public.passport_skills (seeker_id, skill_name) values (s2, 'Go');
  begin perform * from public.search_talent('', false); out := out || 'FAIL20 seeker searched; ';
  exception when others then out := out || 'ok20; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  select count(*) into n from public.search_talent('', false) x where x.seeker_id = s;
  out := out || case when n = 1 then 'ok21; ' else 'FAIL21 discoverable missing; ' end;
  select count(*) into n from public.search_talent('', false) x where x.seeker_id = s2;
  out := out || case when n = 0 then 'ok22; ' else 'FAIL22 private seeker listed; ' end;
  select count(*) into n from public.search_talent('sql', true) x where x.seeker_id = s;
  out := out || case when n = 1 then 'ok23; ' else 'FAIL23 skill search; ' end;
  select count(*) into n from public.search_talent('', false) x
   where x.seeker_id = s and x.skills::text not ilike '%declared%' and x.verified_count = 2 and x.assessed_count = 1;
  out := out || case when n = 1 then 'ok24; ' else 'FAIL24 skill payload; ' end;
  select count(*) into n from public.passport_skills where seeker_id = s;
  out := out || case when n = 0 then 'ok25; ' else 'FAIL25 recruiter reads passport table; ' end;

  -- ── Invitations ──
  begin insert into public.invitations (recruiter_id, seeker_id, role_title) values (rc, s2, 'Engineer');
        out := out || 'FAIL26 invited private seeker; ';
  exception when others then out := out || 'ok26; '; end;
  insert into public.invitations (recruiter_id, seeker_id, role_title, message)
    values (rc, s, 'Frontend Engineer', 'Hi') returning id into inv;
  begin insert into public.invitations (recruiter_id, seeker_id, role_title) values (rc, s, 'Another');
        out := out || 'FAIL27 duplicate pending; ';
  exception when others then out := out || 'ok27; '; end;
  update public.invitations set status = 'accepted' where id = inv;
  get diagnostics n = row_count;
  out := out || case when n = 0 then 'ok28; ' else 'FAIL28 recruiter self-accepted; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role','authenticated')::text, true);
  begin insert into public.invitations (recruiter_id, seeker_id, role_title) values (f, s, 'Cofounder');
        out := out || 'FAIL29 founder invited; ';
  exception when others then out := out || 'ok29; '; end;
  select count(*) into n from public.invitations where id = inv;
  out := out || case when n = 0 then 'ok30; ' else 'FAIL30 outsider sees invitation; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  select count(*) into n from public.profiles where id = rc;
  out := out || case when n = 1 then 'ok31; ' else 'FAIL31 seeker cannot see recruiter; ' end;
  begin update public.invitations set role_title = 'CEO' where id = inv; out := out || 'FAIL32 seeker edited role; ';
  exception when others then out := out || 'ok32; '; end;
  update public.invitations set status = 'accepted', responded_at = now() where id = inv;
  begin update public.invitations set status = 'declined' where id = inv;
        get diagnostics n = row_count;
        out := out || case when n = 0 then 'ok33; ' else 'FAIL33 answered twice; ' end;
  exception when others then out := out || 'ok33; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  delete from public.invitations where id = inv;
  get diagnostics n = row_count;
  out := out || case when n = 0 then 'ok34' else 'FAIL34 withdrew accepted' end;

  raise exception 'RESULT: %', out;
end $$;
