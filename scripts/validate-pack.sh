#!/usr/bin/env bash
set -euo pipefail

VERSION="0.16.1"
SPEC="spec/spreadsheet_native_erp_technical_spec_v0_16_1_research_driven_phase0_bootstrap_complete_execution.md"
WAIVER_ID=""
if [[ "${1:-}" == "--waiver" ]]; then
  WAIVER_ID="${2:-}"
  [[ -n "$WAIVER_ID" ]] || { echo "VALIDATION FAILED: --waiver requires an ID" >&2; exit 1; }
fi

PASS=0
CHECKS=0
pass() { CHECKS=$((CHECKS+1)); PASS=$((PASS+1)); }
fail() { echo "VALIDATION FAILED: $1" >&2; exit 1; }
require_file() { [[ -s "$1" ]] && pass || fail "missing or empty file: $1"; }
require_grep() { local needle="$1" file="$2" msg="$3"; grep -Eq "$needle" "$file" && pass || fail "$msg"; }

required_files=(
  "README.md" "CHANGELOG.md" "AGENTS.md" "CLAUDE.md" ".windsurfrules" ".gitignore" ".editorconfig" ".env.example"
  "package.json" "pnpm-workspace.yaml" "tsconfig.base.json" "tsconfig.json" "tsconfig.smoke.json"
  "scripts/validate-pack.sh" "scripts/smoke-typecheck.sh" "scripts/smoke-package-tests.sh" "scripts/package-smoke-tests.mjs" "scripts/smoke.sh"
  ".github/copilot-instructions.md" ".cursor/rules/phase0-boundaries.mdc" ".github/workflows/ci.yml" ".github/workflows/validate-pack.yml"
  "apps/AGENTS.md" "apps/api/AGENTS.md" "apps/web/AGENTS.md" "packages/AGENTS.md" "docs/AGENTS.md" "tests/AGENTS.md"
  "$SPEC" "docs/snapshot-v0.16.1.md" "docs/pack-index.md" "docs/README.md"
  "docs/qa/repository-smoke-test-v0.16.1.md" "docs/qa/bootstrap-completion-evidence-v0.16.1.md" "docs/qa/agent-simulation-run-v0.16.1.md"
  "docs/implementation/project-directory-structure.md" "docs/implementation/code-stub-index.md" "docs/implementation/phase0-work-order-assignments-v0.16.1.md"
  "docs/release/vertical-slice-release-note-template.md" "docs/changelog/CHANGELOG-v0.16.1.md" "docs/review/critical-review-v0.16.1.md"
  "docs/tech-stack-decisions.md" "docs/post-mvp/post-mvp-planes-vnext.md" "docs/process/validation-waiver-policy.md"
  "apps/api/package.json" "apps/web/package.json" "packages/domain/package.json" "packages/db/package.json" "packages/contracts/package.json" "packages/config/package.json" "packages/observability/package.json" "packages/testkit/package.json" "packages/ui/package.json"
  "apps/api/test/smoke.test.mjs" "apps/web/test/smoke.test.mjs" "packages/domain/test/smoke.test.mjs" "packages/db/test/smoke.test.mjs" "packages/contracts/test/smoke.test.mjs" "packages/config/test/smoke.test.mjs" "packages/observability/test/smoke.test.mjs" "packages/testkit/test/smoke.test.mjs" "packages/ui/test/smoke.test.mjs"
  "apps/api/src/commands/CommandHandlerBase.ts" "apps/api/src/outbox/OutboxPoller.ts" "apps/api/src/retrieval/RetrievalRevalidator.middleware.ts" "apps/api/src/routes/commands.ts" "apps/api/src/routes/events.ts" "apps/api/src/server.ts"
  "apps/web/src/app/page.tsx" "apps/web/src/components/GridShell.tsx" "apps/web/src/lib/commandClient.ts"
  "packages/domain/src/ledger/NumericLedgerPort.ts" "packages/domain/src/commands/types.ts" "packages/domain/src/types/ids.ts" "packages/db/src/transaction.ts" "packages/contracts/src/command-api.ts" "packages/contracts/src/events.ts" "packages/config/src/env.ts" "packages/observability/src/tracing.ts" "packages/testkit/src/evidence.ts" "packages/ui/src/index.ts"
  "docs/slo-baseline.yml" "tests/manifest.yml" "invariants/security-invariants.yml" "invariants/sql/aud-001-command-audit-domain-outbox-correlation.sql"
)
for f in "${required_files[@]}"; do require_file "$f"; done

for old in scripts/repo-smoke.mjs scripts/smoke-typecheck.mjs; do
  [[ ! -e "$old" ]] || fail "Deprecated smoke script remains: $old"
done
pass

if find apps packages -type d -name dist | grep -q .; then find apps packages -type d -name dist >&2; fail "Generated dist directories are not allowed in source pack"; fi
if find apps packages -type f \( -name '*.d.ts' -o -name '*.tsbuildinfo' -o -path '*/src/*.js' -o -path '*/src/*.js.map' \) | grep -q .; then find apps packages -type f \( -name '*.d.ts' -o -name '*.tsbuildinfo' -o -path '*/src/*.js' -o -path '*/src/*.js.map' \) >&2; fail "Generated declaration, emitted source JS, source maps, or tsbuildinfo files are not allowed in source pack"; fi
pass

python3 - <<'PYVALID'
from pathlib import Path
import re, sys, yaml, json

VERSION='0.16.1'
SPEC=Path('spec/spreadsheet_native_erp_technical_spec_v0_16_1_research_driven_phase0_bootstrap_complete_execution.md')

class UniqueKeyLoader(yaml.SafeLoader): pass
def construct_mapping(loader,node,deep=False):
    mapping={}
    for key_node,value_node in node.value:
        key=loader.construct_object(key_node,deep=deep)
        if key in mapping:
            raise yaml.constructor.ConstructorError('while constructing mapping',node.start_mark,f'duplicate key {key!r}',key_node.start_mark)
        mapping[key]=loader.construct_object(value_node,deep=deep)
    return mapping
UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping)
def load_yaml(path): return yaml.load(Path(path).read_text(), Loader=UniqueKeyLoader)

for path in ['docs/slo-baseline.yml','tests/manifest.yml','invariants/security-invariants.yml']:
    doc=load_yaml(path)
    if str(doc.get('version')) != VERSION:
        print(f'{path} version mismatch: {doc.get("version")}', file=sys.stderr); sys.exit(1)

active_specs=list(Path('spec').glob('*.md'))
if active_specs != [SPEC]:
    print(f'Expected exactly one active spec {SPEC}, found {active_specs}', file=sys.stderr); sys.exit(1)

manifest=load_yaml('tests/manifest.yml')
req=manifest.get('requiredDocs',[])
if len(req) != len(set(req)):
    print('Duplicate requiredDocs in manifest', file=sys.stderr); sys.exit(1)
for uri in req:
    if uri.startswith('repo://'):
        p=Path(uri[7:])
        if not p.exists() or p.stat().st_size == 0:
            print(f'Missing requiredDoc: {uri}', file=sys.stderr); sys.exit(1)

# Active ADR/gate IDs must be unique.
for sub, pattern, keyfn in [('docs/adr','ADR-*.md',lambda n:'ADR-'+n.split('-')[1]),('docs/gates','P*.md',lambda n:'-'.join(n.split('-')[:3]))]:
    seen={}
    for p in Path(sub).glob(pattern):
        k=keyfn(p.name); seen.setdefault(k,[]).append(str(p))
    dup={k:v for k,v in seen.items() if len(v)>1}
    if dup:
        print('Duplicate active IDs: '+repr(dup), file=sys.stderr); sys.exit(1)

manifest_uris=set(re.findall(r'ci://[A-Za-z0-9_./:-]+', Path('tests/manifest.yml').read_text()))
gate_uris=set()
for p in Path('docs/gates').glob('*.md'):
    gate_uris.update(re.findall(r'ci://[A-Za-z0-9_./:-]+', p.read_text(errors='ignore')))
miss=sorted(gate_uris - manifest_uris)
if miss:
    print('Gate ci:// URIs missing from manifest: '+', '.join(miss), file=sys.stderr); sys.exit(1)

if list(Path('docs/skeletons').glob('*.ts')):
    print('TypeScript skeletons must live in apps/ or packages/, not docs/skeletons/', file=sys.stderr); sys.exit(1)

allowed={Path('docs/data/command-outbox-retention-partitioning.md'),Path('docs/data/numeric-ledger-contract.md'),Path('docs/data/analytics-export-contract.md'),Path('docs/data/semantic-retrieval-contract.md'),Path('docs/data/ledger-id-derivation-reference.md'),Path('docs/data/external-integration-contract.md')}
viol=[]
for p in Path('.').rglob('*.md'):
    s=str(p)
    if p in allowed or 'docs/archive/' in s: continue
    if re.search(r'(?im)^\s*CREATE\s+TABLE\s+', p.read_text(errors='ignore')):
        viol.append(s)
if viol:
    print('CREATE TABLE outside canonical data-contract files: '+', '.join(viol), file=sys.stderr); sys.exit(1)

expected_dirs=['apps/api/src/commands','apps/api/src/outbox','apps/api/src/retrieval','apps/web/src/components','packages/domain/src/ledger','packages/db/migrations','packages/contracts/src','packages/config/src','packages/observability/src','packages/testkit/src','packages/ui/src','docs/archive/changelog','docs/archive/spec','docs/archive/snapshot','docs/archive/qa']
for d in expected_dirs:
    if not Path(d).is_dir():
        print(f'Missing directory {d}', file=sys.stderr); sys.exit(1)

workspace=Path('pnpm-workspace.yaml').read_text()
for line in ['apps/*','packages/*']:
    if line not in workspace:
        print(f'pnpm workspace missing {line}', file=sys.stderr); sys.exit(1)
root_pkg=json.loads(Path('package.json').read_text())
if root_pkg.get('version') != VERSION or root_pkg.get('private') is not True:
    print('root package.json version/private mismatch', file=sys.stderr); sys.exit(1)
for script in ['validate:pack','smoke:typecheck','smoke:package-tests','test','validate:all','ci:bootstrap']:
    if script not in root_pkg.get('scripts',{}):
        print(f'root package missing script {script}', file=sys.stderr); sys.exit(1)

for path, name in [('apps/api/package.json','@erp/api'),('apps/web/package.json','@erp/web'),('packages/domain/package.json','@erp/domain'),('packages/db/package.json','@erp/db'),('packages/contracts/package.json','@erp/contracts'),('packages/config/package.json','@erp/config'),('packages/observability/package.json','@erp/observability'),('packages/testkit/package.json','@erp/testkit'),('packages/ui/package.json','@erp/ui')]:
    pkg=json.loads(Path(path).read_text())
    if pkg.get('name') != name or pkg.get('version') != VERSION:
        print(f'{path} name/version mismatch', file=sys.stderr); sys.exit(1)
    if pkg.get('scripts',{}).get('test') != 'node --test test/smoke.test.mjs':
        print(f'{path} test script must run smoke.test.mjs', file=sys.stderr); sys.exit(1)
    if not Path(path).parent.joinpath('test/smoke.test.mjs').exists():
        print(f'{path} missing package smoke test', file=sys.stderr); sys.exit(1)

checks={
 'README.md':['START HERE','docs/snapshot-v0.16.1.md','Bootstrap achieved','scripts/smoke-package-tests.sh'],
 'AGENTS.md':['docs/snapshot-v0.16.1.md','scripts/smoke-package-tests.sh','Validation waiver mode'],
 'docs/snapshot-v0.16.1.md':['Bootstrap achieved','Repository tree','What agents may NOT do today','AGENT-000 -> AGENT-001 -> AGENT-010'],
 'docs/pack-index.md':['version: "0.16.1"','Bootstrap achieved','docs/qa/bootstrap-completion-evidence-v0.16.1.md'],
 str(SPEC):['Technical Specification v0.16.1','Bootstrap Completion Closure','smoke-package-tests.sh'],
 'docs/qa/repository-smoke-test-v0.16.1.md':['package-smoke-tests','BENCH-REPO-003'],
 'docs/qa/bootstrap-completion-evidence-v0.16.1.md':['P0-EXEC-001 is considered green','AGENT-000 -> AGENT-001 -> AGENT-010'],
 'docs/implementation/phase0-work-order-assignments-v0.16.1.md':['AGENT-010','AGENT-012','No post-MVP runtime dependency'],
 'docs/release/vertical-slice-release-note-template.md':['One safe spreadsheet edit','Known exclusions'],
 'scripts/smoke-typecheck.sh':['local node_modules/.bin/tsc','pnpm exec tsc','global tsc','TypeScript smoke typecheck passed'],
 'scripts/smoke-package-tests.sh':['package-smoke-tests.mjs'],
 'scripts/package-smoke-tests.mjs':['apps/api','packages/domain','Package smoke tests passed'],
 '.github/workflows/ci.yml':['smoke-package-tests.sh'],
 'package.json':['smoke:package-tests','ci:bootstrap'],
}
for f, strings in checks.items():
    txt=Path(f).read_text(errors='ignore')
    for s in strings:
        if s not in txt:
            print(f'Missing {s!r} in {f}', file=sys.stderr); sys.exit(1)

invariants=load_yaml('invariants/security-invariants.yml').get('invariants',[])
ids={i.get('id') for i in invariants}
for needed in ['EXEC-013','EXEC-014','EXEC-015','EXEC-016','SNAP-003','SNAP-004','DOC-002','DOC-003']:
    if needed not in ids:
        print(f'Missing invariant {needed}', file=sys.stderr); sys.exit(1)
manifest_ids={g.get('id') for g in manifest.get('gates',[])}
for needed in ['P0-EXEC-001','P0-CMD-001','P0-LIVE-001','P0-INV-001','P0-BATCH-001','P0-RATE-001']:
    if needed not in manifest_ids:
        print(f'Missing manifest gate {needed}', file=sys.stderr); sys.exit(1)
p0=next(g for g in manifest.get('gates',[]) if g.get('id')=='P0-EXEC-001')
for needed in ['ci://tests/process/repo-smoke-typecheck-passes','ci://tests/process/package-smoke-tests-pass','ci://tests/process/bootstrap-completion-evidence-attached','ci://benchmarks/BENCH-REPO-003','ci://benchmarks/BENCH-BOOTSTRAP-001']:
    if needed not in p0.get('ciJobs',[]):
        print(f'Missing P0-EXEC evidence {needed}', file=sys.stderr); sys.exit(1)
slo=load_yaml('docs/slo-baseline.yml')
for needed in ['BENCH-REPO-002','BENCH-REPO-003','BENCH-BOOTSTRAP-001']:
    if needed not in slo.get('benchmarks',{}):
        print(f'Missing benchmark {needed}', file=sys.stderr); sys.exit(1)
for needed in ['package_smoke_tests_required','bootstrap_completion_declared_required','smoke_typecheck_tsc_resolution_documented_required']:
    if needed not in slo.get('phase0_slos',{}):
        print(f'Missing phase0 SLO {needed}', file=sys.stderr); sys.exit(1)

# Live entrypoints must not point at prior active spec/snapshot. Archives are allowed.
active_files=['README.md','AGENTS.md','docs/pack-index.md','tests/manifest.yml','.github/workflows/validate-pack.yml','.github/workflows/ci.yml','docs/tech-stack-decisions.md','CHANGELOG.md','docs/README.md','package.json']
for f in active_files:
    txt=Path(f).read_text(errors='ignore')
    prior_snapshot = 'docs/snapshot-'+'v0.'+'16.'+'0'+'.md'
    prior_spec = 'spec/spreadsheet_native_erp_technical_spec_'+'v0_16_'+'0_research_driven_phase0_runnable_project_bootstrap_execution.md'
    prior_changelog = 'docs/changelog/CHANGELOG-'+'v0.'+'16.'+'0'+'.md'
    prior_agent_a = 'v0.'+'15.'+'3'
    prior_agent_b = 'v0.'+'15.'+'2'
    for stale in [prior_snapshot, prior_spec, prior_changelog, prior_agent_a, prior_agent_b]:
        if stale in txt:
            print(f'Stale active reference {stale} in {f}', file=sys.stderr); sys.exit(1)

print('python validation checks passed')
PYVALID
pass

require_grep "Bootstrap achieved" docs/snapshot-v0.16.1.md "snapshot missing bootstrap achieved note"
require_grep "smoke-package-tests.sh" README.md "README missing package smoke command"
require_grep "smoke-package-tests.sh" scripts/smoke.sh "smoke.sh does not run package smoke tests"
require_grep "node --test test/smoke.test.mjs" packages/domain/package.json "package smoke test missing"

printf 'Pack validation passed for v0.16.1.\n'
printf 'Checks passed: %s/%s\n' "$PASS" "$CHECKS"
printf 'Pack health score: 100/100\n'
