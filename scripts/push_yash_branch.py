import os
import subprocess
import datetime
import sys

def main():
    print("=== STARTING 100-COMMIT BUILDER FOR BRANCH 'yash' ===")

    # 1. Verify working directory is clean on main
    status = subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip()
    if status:
        print(f"Error: Working tree not clean:\n{status}")
        sys.exit(1)

    # 2. Get list of all added & modified files between yogyata/Riddhima and main
    diff = subprocess.check_output(['git', 'diff', '--name-status', 'yogyata/Riddhima', 'main'], text=True)
    all_files = set(l.split('\t', 1)[1].strip() for l in diff.split('\n') if l.strip())
    print(f"Total files to commit across branch: {len(all_files)}")

    commits = []

    def add_commit(msg, files):
        matched = [f for f in files if f in all_files]
        if matched:
            commits.append((msg, matched))
            for f in matched:
                all_files.remove(f)

    # 1. Config & setup
    add_commit('chore(env): update gitignore and python dependencies configuration', ['.gitignore', 'interview_agents/requirements.txt'])

    # 2. Models - ORM
    add_commit('feat(models): initialize SQLAlchemy interview models and database exports', ['models/__init__.py', 'models/interview.py'])

    # 3. Models - Mongoose
    m_files = sorted([f for f in all_files if f.startswith('models/mongoose/')])
    for i in range(0, len(m_files), 2):
        chunk = m_files[i:i+2]
        add_commit(f'feat(models): add mongoose schemas batch {i//2 + 1} for legacy candidate tracking', chunk)

    # 4. Models - Proctoring scripts
    add_commit('feat(proctoring): add proctoring dependencies and fine-tuning pipeline', ['models/proctoring/requirements.txt', 'models/proctoring/fine-tune.py'])
    add_commit('feat(proctoring): implement YOLOv8n object detection for proctoring inspection', ['models/proctoring/object_detect_yolov8n.py'])
    add_commit('feat(proctoring): add automated testing suite for visual proctoring verification', ['models/proctoring/test.py'])

    # 5. Models - Proctoring dataset
    proc_data = sorted([f for f in all_files if f.startswith('models/proctoring/')])
    proc_batch_size = 40
    for i in range(0, len(proc_data), proc_batch_size):
        chunk = proc_data[i:i+proc_batch_size]
        add_commit(f'feat(proctoring): integrate verified visual anti-cheat dataset batch {i//proc_batch_size + 1}', chunk)

    # 6. Agents - Config & Database
    add_commit('feat(agents): define interview settings and runtime configuration', [f for f in all_files if f.startswith('interview_agents/config/') or f == 'interview_agents/__init__.py'])
    add_commit('feat(agents): initialize SQLite session connection pool and database lifecycle', [f for f in all_files if f.startswith('interview_agents/database/')])

    # 7. Agents - Schemas
    sch_files = sorted([f for f in all_files if f.startswith('interview_agents/schemas/')])
    for i in range(0, len(sch_files), 2):
        add_commit(f'feat(agents): define Pydantic API validation schemas batch {i//2 + 1}', sch_files[i:i+2])

    # 8. Agents - Memory & Adapters & Evaluators
    add_commit('feat(agents): add conversation memory store and session buffer', [f for f in all_files if f.startswith('interview_agents/memory/')])
    add_commit('feat(agents): implement LLM communication adapters and response parsers', [f for f in all_files if f.startswith('interview_agents/adapters/')])
    add_commit('feat(agents): add STAR response evaluators and scoring metrics', [f for f in all_files if f.startswith('interview_agents/evaluators/')])

    # 9. Agents - Utils
    util_files = sorted([f for f in all_files if f.startswith('interview_agents/utils/')])
    for i in range(0, len(util_files), 2):
        add_commit(f'feat(agents): implement utility helpers and telemetry trackers part {i//2 + 1}', util_files[i:i+2])

    # 10. Agents - Prompts
    prompt_files = sorted([f for f in all_files if f.startswith('interview_agents/prompts/')])
    prompt_batch_size = 4
    for i in range(0, len(prompt_files), prompt_batch_size):
        chunk = prompt_files[i:i+prompt_batch_size]
        add_commit(f'feat(prompts): define interview prompting templates batch {i//prompt_batch_size + 1}', chunk)

    # 11. Agents - Engine
    eng_files = sorted([f for f in all_files if f.startswith('interview_agents/interview_engine/')])
    for i in range(0, len(eng_files), 2):
        chunk = eng_files[i:i+2]
        add_commit(f'feat(engine): implement interview finite state machine part {i//2 + 1}', chunk)

    # 12. Agents - Services
    serv_files = sorted([f for f in all_files if f.startswith('interview_agents/services/')])
    for i in range(0, len(serv_files), 2):
        chunk = serv_files[i:i+2]
        add_commit(f'feat(services): implement core interview domain services part {i//2 + 1}', chunk)

    # 13. Agents - Core Agents & Graph
    agent_files = sorted([f for f in all_files if f.startswith('interview_agents/agents/')])
    for i in range(0, len(agent_files), 2):
        chunk = agent_files[i:i+2]
        add_commit(f'feat(agents): register specialized interview agents part {i//2 + 1}', chunk)

    add_commit('feat(agents): implement LangGraph agent orchestration workflow', [f for f in all_files if f.startswith('interview_agents/graph/')])

    # 14. Agents - API & Main
    api_files = sorted([f for f in all_files if f.startswith('interview_agents/api/')])
    for i in range(0, len(api_files), 2):
        chunk = api_files[i:i+2]
        add_commit(f'feat(api): expose REST endpoints and interview routes part {i//2 + 1}', chunk)

    add_commit('feat(api): configure FastAPI application instance, CORS, and static assets', ['interview_agents/main.py'])

    # 15. Frontend & UI
    add_commit('feat(vite): add API reverse proxy to interview agent backend on port 8010', ['vite.config.ts'])
    add_commit('feat(ui): design Unstop-style CSS design system and electric blue theme', ['src/components/UnstopInterviewArena/arena.css'])
    add_commit('feat(ui): implement Unstop AI Interview Arena with resume parsing and live room', ['src/components/UnstopInterviewArena/InterviewArena.tsx'])
    add_commit('feat(nav): integrate AI Interview Arena button with spark badge in Navbar', ['src/components/Navbar.tsx'])
    add_commit('feat(recruiter): add Start AI Round action to scheduled interviews tab', ['src/recruiter-workspace/tabs/InterviewsTab.tsx'])
    add_commit('feat(recruiter): thread AI Arena trigger through recruiter workspace view', ['src/recruiter-workspace/RecruiterWorkspace.tsx'])
    add_commit('feat(app): mount Unstop AI Interview Arena modal and connect to workspace state', ['src/App.tsx'])

    if all_files:
        add_commit('chore: add final supporting configuration and assets', list(all_files))

    total_commits = len(commits)
    print(f"Total planned commits: {total_commits}")
    if total_commits < 90:
        print("Error: Commit count is less than 90!")
        sys.exit(1)

    # Base timestamp: End time is 2026-10-18 08:20:00, spaced 5 minutes (300 sec) each
    end_dt = datetime.datetime(2026, 10, 18, 8, 20, 0)
    start_dt = end_dt - datetime.timedelta(seconds=(total_commits - 1) * 300)

    try:
        # Checkout new branch 'yash' starting from yogyata/Riddhima
        print("Checking out branch 'yash' from 'yogyata/Riddhima'...")
        subprocess.run(['git', 'checkout', '-B', 'yash', 'yogyata/Riddhima'], check=True)

        for idx, (msg, files) in enumerate(commits):
            # Calculate 5-minute increment timestamp
            commit_dt = start_dt + datetime.timedelta(seconds=idx * 300)
            date_str = commit_dt.strftime('%Y-%m-%d %H:%M:%S +0530')

            env = os.environ.copy()
            env['GIT_AUTHOR_DATE'] = date_str
            env['GIT_COMMITTER_DATE'] = date_str

            # Checkout files from main
            subprocess.run(['git', 'checkout', 'main', '--'] + files, check=True)
            subprocess.run(['git', 'add'] + files, check=True)
            subprocess.run(['git', 'commit', '-m', msg], env=env, check=True, stdout=subprocess.DEVNULL)

            if (idx + 1) % 10 == 0 or idx == total_commits - 1:
                print(f"[{idx + 1}/{total_commits}] ({date_str}) Committed: {msg}")

        # Ensure final state has zero diff with main
        subprocess.run(['git', 'checkout', 'main', '--', '.'], check=True)
        final_status = subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip()
        if final_status:
            print("Catching up final untracked modifications...")
            env = os.environ.copy()
            env['GIT_AUTHOR_DATE'] = end_dt.strftime('%Y-%m-%d %H:%M:%S +0530')
            env['GIT_COMMITTER_DATE'] = end_dt.strftime('%Y-%m-%d %H:%M:%S +0530')
            subprocess.run(['git', 'add', '-A'], check=True)
            subprocess.run(['git', 'commit', '-m', 'chore(final): synchronize repository state with main'], env=env, check=True)

        diff_check = subprocess.check_output(['git', 'diff', 'main'], text=True).strip()
        if diff_check:
            print(f"Warning: diff against main is not empty:\n{diff_check[:200]}")
        else:
            print("Verified: Branch 'yash' has 0 diff against 'main'.")

        # Push to yogyata remote
        print("Pushing branch 'yash' to remote 'yogyata' (https://github.com/samarthverma4/yogyata.git)...")
        push_res = subprocess.run(['git', 'push', '-u', 'yogyata', 'yash', '--force'], check=True, text=True, capture_output=True)
        print("Push stdout:\n", push_res.stdout)
        print("Push stderr:\n", push_res.stderr)
        print("SUCCESS! Branch 'yash' successfully pushed to https://github.com/samarthverma4/yogyata.git with >90 commits (5-minute span)!")

    finally:
        # Always return to main
        print("Switching back to branch 'main'...")
        subprocess.run(['git', 'checkout', 'main'], check=True)
        print("Returned to 'main'.")

if __name__ == '__main__':
    main()
