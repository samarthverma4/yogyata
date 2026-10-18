-- Rolled-back test of the mentor, recruiter, posting, assessment and roadmap rules.
-- Paste into the Supabase SQL editor and run. It always ends with an error starting with
-- "RESULT:" listing ok<n> / FAIL<n> per check; that error rolls everything back.
do $$
declare
  s   uuid := gen_random_uuid();  -- seeker, has React declared
  s2  uuid := gen_random_uuid();  -- seeker, private (not discoverable), has Go and a verified TypeScript
  m   uuid := gen_random_uuid();  -- approved mentor, room for one mentee
  m2  uuid := gen_random_uuid();  -- mentor still pending approval
  rc  uuid := gen_random_uuid();  -- approved recruiter
  rc2 uuid := gen_random_uuid();  -- another approved recruiter
  req uuid; ship uuid; item uuid; sess uuid; fb uuid; fb2 uuid; post uuid; app uuid; app2 uuid; n int; t text; out text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (s,   's@test.local',   '{"role":"seeker","full_name":"Sam Seeker"}',        'authenticated','authenticated'),
    (s2,  's2@test.local',  '{"role":"seeker","full_name":"Pia Private"}',       'authenticated','authenticated'),
    (m,   'm@test.local',   '{"role":"mentor","full_name":"Meera Mentor"}',      'authenticated','authenticated'),
    (m2,  'm2@test.local',  '{"role":"mentor","full_name":"Paul Pending"}',      'authenticated','authenticated'),
    (rc,  'r@test.local',   '{"role":"recruiter","full_name":"Rahul Recruiter"}','authenticated','authenticated'),
    (rc2, 'r2@test.local',  '{"role":"recruiter","full_name":"Rita Other"}',     'authenticated','authenticated');
  update public.profiles set approval = 'approved' where id in (m, rc, rc2);
  insert into public.passport_skills (seeker_id, skill_name, level, evidence) values (s2, 'TypeScript', 'verified', 'founder review');

  set local role authenticated;

  -- ── Mentor profile ──
  perform set_config('request.jwt.claims', json_build_object('sub', m2, 'role','authenticated')::text, true);
  begin insert into public.mentor_profiles (id, headline) values (m2, 'pending'); out := out || 'FAIL1 pending mentor listed; ';
  exception when others then out := out || 'ok1; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role','authenticated')::text, true);
  insert into public.mentor_profiles (id, headline, tracks, max_mentees) values (m, 'Staff engineer', array['Interview prep'], 1);

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  insert into public.passport_skills (seeker_id, skill_name) values (s, 'React');
  select count(*) into n from public.mentor_profiles where id = m;
  out := out || case when n = 1 then 'ok2; ' else 'FAIL2 seeker cannot see listed mentor; ' end;
  select count(*) into n from public.profiles where id = m;
  out := out || case when n = 1 then 'ok3; ' else 'FAIL3 seeker cannot see mentor name; ' end;

  -- ── Mentorship requests ──
  insert into public.mentorship_requests (seeker_id, mentor_id, track, message)
    values (s, m, 'Interview prep', 'I want help preparing for frontend interviews.') returning id into req;
  begin insert into public.mentorship_requests (seeker_id, mentor_id, track, message)
          values (s, m, 'Interview prep', 'Second request while the first is pending.');
        out := out || 'FAIL4 duplicate pending request; ';
  exception when others then out := out || 'ok4; '; end;
  begin insert into public.mentorship_requests (seeker_id, mentor_id, track, message)
          values (s, m2, 'Anything', 'Asking a mentor who is not approved yet.');
        out := out || 'FAIL5 request to unlisted mentor; ';
  exception when others then out := out || 'ok5; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  select count(*) into n from public.mentorship_requests where id = req;
  out := out || case when n = 0 then 'ok6; ' else 'FAIL6 recruiter sees mentorship request; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role','authenticated')::text, true);
  select count(*) into n from public.passport_skills where seeker_id = s;
  out := out || case when n = 1 then 'ok7; ' else 'FAIL7 mentor cannot see requester passport; ' end;
  update public.mentorship_requests set status = 'accepted' where id = req;
  get diagnostics n = row_count;
  out := out || case when n = 0 then 'ok8; ' else 'FAIL8 mentor bypassed the accept function; ' end;
  ship := public.respond_mentorship_request(req, true, 'Happy to help');
  out := out || case when ship is not null then 'ok9; ' else 'FAIL9 no mentorship created; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated')::text, true);
  insert into public.passport_skills (seeker_id, skill_name) values (s2, 'Go');
  insert into public.mentorship_requests (seeker_id, mentor_id, track, message)
    values (s2, m, 'Interview prep', 'Could you mentor me on backend interviews?') returning id into req;
  select count(*) into n from public.mentorships where id = ship;
  out := out || case when n = 0 then 'ok10; ' else 'FAIL10 other seeker sees mentorship; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role','authenticated')::text, true);
  begin perform public.respond_mentorship_request(req, true, ''); out := out || 'FAIL11 mentee limit ignored; ';
  exception when others then out := out || 'ok11; '; end;

  -- ── Inside the mentorship ──
  insert into public.mentorship_action_items (mentorship_id, text) values (ship, 'Build a todo app') returning id into item;
  insert into public.mentorship_notes (mentorship_id, body) values (ship, 'Private: needs confidence');
  begin insert into public.mentorship_sessions (mentorship_id, title, starts_at) values (ship, 'Past', now() - interval '1 day');
        out := out || 'FAIL12 session in the past; ';
  exception when others then out := out || 'ok12; '; end;
  insert into public.mentorship_sessions (mentorship_id, title, starts_at, meeting_link)
    values (ship, 'Kickoff', now() + interval '2 days', 'https://meet.example.com/x') returning id into sess;
  insert into public.mentor_feedback (mentorship_id, strengths, shared) values (ship, 'Clear thinking', true) returning id into fb;
  insert into public.mentor_feedback (mentorship_id, strengths, shared) values (ship, 'Private observation', false) returning id into fb2;
  insert into public.mentor_feedback_reflections (feedback_id, mentorship_id, body) values (fb, ship, 'Only for me');

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  update public.mentorship_action_items set completed = true where id = item;
  get diagnostics n = row_count;
  out := out || case when n = 1 then 'ok13; ' else 'FAIL13 mentee cannot tick action item; ' end;
  begin insert into public.mentorship_action_items (mentorship_id, text) values (ship, 'Self-assigned'); out := out || 'FAIL14 mentee added action item; ';
  exception when others then out := out || 'ok14; '; end;
  select count(*) into n from public.mentorship_notes where mentorship_id = ship;
  out := out || case when n = 0 then 'ok15; ' else 'FAIL15 mentee reads private notes; ' end;
  select count(*) into n from public.mentorship_sessions where id = sess;
  out := out || case when n = 1 then 'ok16; ' else 'FAIL16 mentee cannot see session; ' end;
  select count(*) into n from public.mentor_feedback where mentorship_id = ship;
  out := out || case when n = 1 then 'ok17; ' else format('FAIL17 mentee sees %s feedback rows (want 1 shared); ', n) end;
  select count(*) into n from public.mentor_feedback_reflections where feedback_id = fb;
  out := out || case when n = 0 then 'ok18; ' else 'FAIL18 mentee reads private reflection; ' end;
  update public.mentorships set status = 'completed' where id = ship;
  get diagnostics n = row_count;
  out := out || case when n = 0 then 'ok19; ' else 'FAIL19 mentee changed mentorship status; ' end;

  -- ── Recruiter profile, postings, applications ──
  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  insert into public.recruiter_profiles (id, company_name) values (rc, 'Acme');
  insert into public.job_postings (recruiter_id, title, description, status) values (rc, 'Frontend Engineer', 'Build the product UI.', 'draft') returning id into post;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  select count(*) into n from public.job_postings where id = post;
  out := out || case when n = 0 then 'ok20; ' else 'FAIL20 seeker sees draft posting; ' end;
  begin insert into public.job_applications (posting_id, seeker_id) values (post, s); out := out || 'FAIL21 applied to draft; ';
  exception when others then out := out || 'ok21; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  update public.job_postings set status = 'open' where id = post;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  select count(*) into n from public.recruiter_profiles where id = rc;
  out := out || case when n = 1 then 'ok22; ' else 'FAIL22 seeker cannot see company of open posting; ' end;
  insert into public.job_applications (posting_id, seeker_id, cover_note) values (post, s, 'Hi') returning id into app;
  begin insert into public.job_applications (posting_id, seeker_id) values (post, s); out := out || 'FAIL23 applied twice; ';
  exception when others then out := out || 'ok23; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated')::text, true);
  insert into public.job_applications (posting_id, seeker_id) values (post, s2) returning id into app2;

  perform set_config('request.jwt.claims', json_build_object('sub', rc2, 'role','authenticated')::text, true);
  select count(*) into n from public.job_applications where posting_id = post;
  out := out || case when n = 0 then 'ok24; ' else 'FAIL24 other recruiter sees applications; ' end;
  begin insert into public.pipeline_entries (seeker_id, target_role) values (s2, 'Engineer'); out := out || 'FAIL25 recruiter piped a private non-applicant; ';
  exception when others then out := out || 'ok25; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  select count(*) into n from public.job_applications where posting_id = post;
  out := out || case when n = 2 then 'ok26; ' else format('FAIL26 owner sees %s applications; ', n) end;
  select count(*) into n from public.passport_skills where seeker_id = s2;
  out := out || case when n = 2 then 'ok27; ' else format('FAIL27 owner sees %s of applicant skills; ', n) end;
  insert into public.pipeline_entries (seeker_id, target_role, stage) values (s2, 'Frontend Engineer', 'screening');
  update public.job_applications set status = 'interview' where id = app;
  begin update public.job_applications set status = 'withdrawn' where id = app2; out := out || 'FAIL28 recruiter withdrew for applicant; ';
  exception when others then out := out || 'ok28; '; end;
  insert into public.interviews (seeker_id, target_role, starts_at) values (s, 'Frontend Engineer', now() + interval '3 days');
  insert into public.scorecards (seeker_id, target_role, round, interviewer_name, technical, problem_solving, communication, role_alignment, recommendation)
    values (s, 'Frontend Engineer', 'initial-screening', 'Rahul', 4, 4, 5, 4, 'hire');
  begin insert into public.scorecards (seeker_id, target_role, round, interviewer_name, technical, problem_solving, communication, role_alignment, recommendation)
          values (s, 'Frontend Engineer', 'initial-screening', 'Rahul', 6, 4, 4, 4, 'hire');
        out := out || 'FAIL29 rating above 5; ';
  exception when others then out := out || 'ok29; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc2, 'role','authenticated')::text, true);
  select count(*) into n from public.pipeline_entries where seeker_id = s2;
  out := out || case when n = 0 then 'ok30; ' else 'FAIL30 other recruiter sees pipeline; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  select count(*) into n from public.interviews where seeker_id = s;
  out := out || case when n = 1 then 'ok31; ' else 'FAIL31 candidate cannot see interview; ' end;
  select count(*) into n from public.scorecards where seeker_id = s;
  out := out || case when n = 0 then 'ok32; ' else 'FAIL32 candidate reads scorecard; ' end;
  begin update public.job_applications set status = 'offer' where id = app; out := out || 'FAIL33 applicant gave themself an offer; ';
  exception when others then out := out || 'ok33; '; end;
  update public.job_applications set status = 'withdrawn' where id = app;
  get diagnostics n = row_count;
  out := out || case when n = 1 then 'ok34; ' else 'FAIL34 applicant cannot withdraw; ' end;

  -- ── Assessments ──
  begin select count(*) into n from private.assessment_keys; out := out || 'FAIL35 seeker read answer keys; ';
  exception when others then out := out || 'ok35; '; end;
  select count(*) into n from public.assessments where questions::text ilike '%correct%';
  out := out || case when n = 0 then 'ok36; ' else 'FAIL36 answers exposed in questions; ' end;
  select level::text into t from public.passport_skills where seeker_id = s and skill_name = 'React';
  perform public.submit_assessment('assess-react', '{"q-react-1":1,"q-react-2":1,"q-react-3":0,"q-react-4":1}');
  select level::text into t from public.passport_skills where seeker_id = s and lower(skill_name) = 'react';
  out := out || case when t = 'assessed' then 'ok37; ' else format('FAIL37 React is %s after passing; ', t) end;
  begin perform public.submit_assessment('assess-react', '{}'); out := out || 'FAIL38 retake allowed within the hour; ';
  exception when others then out := out || 'ok38; '; end;
  perform public.submit_assessment('assess-js', '{"q-js-1":0,"q-js-2":0,"q-js-3":0,"q-js-4":0}');
  select count(*) into n from public.passport_skills where seeker_id = s and lower(skill_name) = 'javascript';
  out := out || case when n = 0 then 'ok39; ' else 'FAIL39 failed test added a skill; ' end;

  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated')::text, true);
  perform public.submit_assessment('assess-ts', '{"q-ts-1":1,"q-ts-2":1,"q-ts-3":1,"q-ts-4":0}');
  select level::text into t from public.passport_skills where seeker_id = s2 and lower(skill_name) = 'typescript';
  out := out || case when t = 'verified' then 'ok40; ' else format('FAIL40 verified downgraded to %s; ', t) end;

  perform set_config('request.jwt.claims', json_build_object('sub', rc, 'role','authenticated')::text, true);
  begin perform public.submit_assessment('assess-ts', '{}'); out := out || 'FAIL41 recruiter took assessment; ';
  exception when others then out := out || 'ok41; '; end;

  -- ── Roadmap ──
  begin insert into public.roadmap_milestones (title) values ('Hire three people'); out := out || 'FAIL42 recruiter wrote a roadmap; ';
  exception when others then out := out || 'ok42; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  insert into public.roadmap_milestones (title, personal) values ('Ship a portfolio', true);
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated')::text, true);
  select count(*) into n from public.roadmap_milestones where seeker_id = s;
  out := out || case when n = 0 then 'ok43' else 'FAIL43 other seeker sees roadmap' end;

  raise exception 'RESULT: %', out;
end $$;
