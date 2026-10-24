"""Build a versioned, checked Claude review handoff; never deploys or sends it."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import subprocess
import tarfile
import urllib.request
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
SG = timezone(timedelta(hours=8), 'Asia/Singapore')
ROOTS = {'apps', 'packages', 'content', 'data', 'scripts', 'tests', 'docs', 'ops', '.github'}
TOP = {'AGENTS.md', 'README.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
       'tsconfig.base.json', 'vitest.config.ts', '.gitattributes', '.gitignore'}
FORBIDDEN = {'.git', '.local', '.aws', '.codex', 'node_modules', '.next'}
PATTERNS = [rb'-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----',
            rb'\bsk-[A-Za-z0-9]{24,}\b', rb'wx\.mail\.qq\.com[^\s"<>]*[?&]sid=']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def scan(data, name):
    if any(re.search(pattern, data) for pattern in PATTERNS):
        raise ValueError('Potential credential pattern: ' + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    assert re.fullmatch(r'[A-Za-z0-9-]+', args.tag)
    source_commit = git('rev-parse', '--verify', args.source_commit + '^{commit}').decode().strip()
    receipt_path = ROOT / 'output/deploy/e7c09af-evidence/deployment-e7c09af.json'
    receipt = json.loads(receipt_path.read_text(encoding='utf8'))
    live_commit = receipt['commit']
    # A documentation/packaging snapshot may be newer, but deployed app/data must match.
    app_diff = git('diff', '--name-only', live_commit, source_commit, '--',
                   'apps', 'packages', 'content', 'data', 'package.json', 'pnpm-lock.yaml',
                   'pnpm-workspace.yaml', 'tsconfig.base.json').decode().splitlines()
    assert not app_diff, app_diff
    base = ROOT / 'output/review'
    out = base / ('claude-' + args.tag)
    upload = base / ('Global-Chain-Claude-' + args.tag + '-上传版.zip')
    full = base / ('Global-Chain-Claude-' + args.tag + '-完整包.zip')
    assert not any(p.exists() for p in [out, upload, full]), 'Choose a new tag; never overwrite a handoff'
    out.mkdir(parents=True)

    def put(name, value):
        path = out / name
        assert path.resolve().is_relative_to(out.resolve())
        path.parent.mkdir(parents=True, exist_ok=True)
        data = value.encode('utf8') if isinstance(value, str) else value
        scan(data, name)
        path.write_bytes(data)

    def put_json(name, value):
        put(name, json.dumps(value, ensure_ascii=False, indent=2) + '\n')

    originals = ROOT / 'output/review/claude-2026-10-24-v2/originals'
    original_copies = []
    for file in sorted(originals.rglob('*')):
        if file.is_file():
            name = 'originals/' + file.relative_to(originals).as_posix()
            data = file.read_bytes()
            put(name, data)
            original_copies.append({'path': name, 'bytes': len(data), 'sha256': sha(data)})
    for row in json.loads((originals / 'competition/原件清单.json').read_text(encoding='utf8')):
        assert sha((out / 'originals/competition' / row['name']).read_bytes()) == row['sha256']
    recent = ROOT / 'docs/reviews/2026-10-24-claude-review-latest-user-quotes.md'
    put('originals/本次新增用户原话.md', recent.read_bytes())

    manifest = json.loads(git('show', source_commit + ':data/published/manifest.json'))
    product_counts = []
    for entry in manifest['fixtures']:
        fixture = json.loads(git('show', source_commit + ':data/published/' + entry['path']))
        network = fixture['industryNetwork']
        product_counts.append({'productId': entry['productId'], 'version': entry['datasetVersion'],
                               'topics': len(network['topics']), 'relations': len(network['relations']),
                               'organizations': len(network['organizations'])})
    fresh = {'checkedAt': datetime.now(SG).isoformat(), 'kind': 'HTTP/API only, not a new browser run', 'checks': []}
    def fetch(path):
        request = urllib.request.Request('http://62.171.148.193' + path, headers={'User-Agent': 'GlobalChain-review-handoff/4'})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
            assert response.status == 200
            return data
    assert json.loads(fetch('/api/health'))['service'] == 'web'
    for entry in manifest['fixtures']:
        data = fetch('/api/products/' + entry['productId'] + '/research-export')
        exported = json.loads(data)
        assert exported['release']['datasetVersion']['version'] == entry['datasetVersion']
        fresh['checks'].append({'productId': entry['productId'], 'version': entry['datasetVersion'],
                                'bytes': len(data), 'sha256': sha(data), 'status': 200})
    put_json('evidence/本次打包时公网API核对.json', fresh)

    kept, supplement, omitted, lfs = [], [], [], []
    source_zip = out / '02-完整源码与发布数据.zip'
    raw_zip = out / '07-原始数据及历史展示附件.zip'
    archive = git('-c', 'filter.lfs.process=', '-c', 'filter.lfs.smudge=', '-c',
                  'filter.lfs.required=false', 'archive', '--format=tar', source_commit)
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:') as tar, \
         zipfile.ZipFile(source_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as small, \
         zipfile.ZipFile(raw_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as large:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            name = member.name
            parts = PurePosixPath(name).parts
            data = tar.extractfile(member).read()
            if (parts[0] not in ROOTS and name not in TOP) or any(p in FORBIDDEN for p in parts) or any(p.startswith('.env') and p != '.env.example' for p in parts):
                omitted.append({'path': name, 'reason': 'outside project source/data/docs allowlist or private/generated state'})
                continue
            committed_sha = sha(data)
            if data.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
                oid = re.search(rb'oid sha256:([a-f0-9]{64})', data).group(1).decode()
                expected_size = int(re.search(rb'size ([0-9]+)', data).group(1))
                local = (ROOT / name).read_bytes()
                assert sha(local) == oid and len(local) == expected_size, 'Missing verified LFS original: ' + name
                data = local
                lfs.append({'path': name, 'committedPointerSha256': committed_sha, 'originalSha256': oid, 'bytes': len(data)})
            scan(data, name)
            item = {'path': name, 'bytes': len(data), 'sha256': sha(data)}
            bulky = name.startswith(('data/raw/', 'data/published/raw/', 'data/research/')) or (name.startswith('docs/submission/') and PurePosixPath(name).suffix.lower() in {'.png', '.pdf', '.pptx'})
            (large if bulky else small).writestr(name, data)
            (supplement if bulky else kept).append(item)
    for path, rows in [(source_zip, kept), (raw_zip, supplement)]:
        with zipfile.ZipFile(path) as zipped:
            assert zipped.testzip() is None
            for row in rows:
                assert sha(zipped.read(row['path'])) == row['sha256']
    put_json('02-源码与原始数据清单.json', {'sourceCommit': source_commit, 'deployedApplicationCommit': live_commit,
             'appDataDifferencesFromLive': app_diff, 'sourceFiles': kept, 'supplementFiles': supplement,
             'lfsOriginalsHydratedFromLocalVerifiedBytes': lfs, 'omittedTrackedPaths': omitted,
             'uncommittedFilesIncluded': False, 'runtimeDependenciesAndBuildsIncluded': False,
             'supplementExtraction': 'Extract both inner ZIPs into the same project directory for the full raw-source environment; the smaller upload alone contains all application code and published releases.'})

    evidence = []
    groups = [('output/qa/2026-10-24-industry-public', '当前公网-产业'),
              ('output/qa/2026-10-24-industry-public-self-host', '当前公网-地图与导出'),
              ('output/qa/2026-10-24-industry-public-onboarding', '当前公网-首次引导'),
              ('output/deploy/e7c09af-evidence', '当前服务器-发布记录')]
    for relative, label in groups:
        folder = ROOT / relative
        for file in sorted(folder.iterdir()):
            if file.is_file() and file.suffix in {'.png', '.json', '.log'}:
                name = 'evidence/' + label + '/' + file.name
                data = file.read_bytes(); put(name, data)
                evidence.append({'path': name, 'originalPath': relative + '/' + file.name,
                                 'sha256': sha(data), 'sourceModifiedAt': datetime.fromtimestamp(file.stat().st_mtime, SG).isoformat(),
                                 'newlyCapturedDuringPackaging': False, 'applicationCommit': live_commit})
    put_json('03-截图与证据索引.json', evidence)
    reports = ['2026-10-22-claude-partial-review.txt', '2026-10-23-independent-review-original.md',
               '2026-10-23-independent-review-implementation.md', '2026-10-23-claude-completion.md',
               '2026-10-24-current-standard-audit.md', '2026-10-24-booth-first-visit.md',
               '2026-10-24-industry-server-sync.md', '2026-10-23-collaboration-and-classification-discussion.md']
    for name in reports:
        put('reviews/' + name, git('show', source_commit + ':docs/reviews/' + name))
    put('reviews/2026-10-24-industry-content-expansion.md', git('show', source_commit + ':docs/data-review/2026-10-24-industry-content-expansion.md'))
    put_json('04-当前版本与覆盖.json', {'createdAt': datetime.now(SG).isoformat(), 'sourceCommit': source_commit,
             'deployedApplicationCommit': live_commit, 'deploymentReceipt': receipt, 'products': product_counts,
             'chinaMap': {'roles': 18, 'representativeConnections': 12, 'expandedByLatestIndustryBatch': False},
             'newIndustryTopics': 214, 'newIndustryRelations': 225, 'newlySurfacedOrganizations': 6,
             'siteAccountsApplicationsModerationImplemented': False, 'personaScope': 'Browsing preferences, recommendations, navigation and guide destinations; not separate account systems',
             'originalCopies': original_copies, 'freshApiCheck': fresh,
             'validationScope': 'Existing 53-file 266-pass/1-skip run plus a separately run new source-preservation test; not a single claimed 54-file full rerun. Latest Linux build and browser evidence supplied; hosted CI not independently checked.',
             'credentialsIncluded': False, 'sentToClaude': False})
    put('00-给Claude的任务.md', TASK)
    put('README-先读.md', README)
    put('05-本地启动与检查.md', RUN)
    put('06-资料来源与限制.md', LIMITS)
    for bundle, include_raw in [(upload, False), (full, True)]:
        files = [p for p in sorted(out.rglob('*')) if p.is_file() and (include_raw or p != raw_zip)]
        entries = [{'path': p.relative_to(out).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in files]
        delivery = json.dumps({'createdAt': datetime.now(SG).isoformat(), 'sourceCommit': source_commit,
                              'deployedApplicationCommit': live_commit, 'rawSupplementIncluded': include_raw,
                              'sourceFileCount': len(kept), 'supplementFileCount': len(supplement),
                              'screenshots': sum(row['path'].endswith('.png') for row in evidence),
                              'credentialSelectedPatternScan': 'No selected pattern matched; allowlisted files only, not a comprehensive security audit',
                              'files': entries}, ensure_ascii=False, indent=2).encode('utf8')
        with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as target:
            for file in files:
                target.write(file, file.relative_to(out).as_posix(), compress_type=zipfile.ZIP_STORED if file.suffix == '.zip' else zipfile.ZIP_DEFLATED)
            target.writestr('交付校验.json', delivery)
        with zipfile.ZipFile(bundle) as target:
            assert target.testzip() is None
            for item in entries:
                assert sha(target.read(item['path'])) == item['sha256']
        checksum = sha(bundle.read_bytes())
        Path(str(bundle) + '.sha256').write_text(checksum + '  ' + bundle.name + '\n', encoding='utf8', newline='\n')
        print(json.dumps({'bundle': str(bundle), 'bytes': bundle.stat().st_size, 'sha256': checksum,
                          'sourceFiles': len(kept), 'supplementFiles': len(supplement), 'rawIncluded': include_raw,
                          'zipVerified': True}, ensure_ascii=False), flush=True)


TASK = '''# Global Chain V4 独立评审任务

请用中文评审，先报告实际读取/运行/操作的范围及不能验证的事项，再给结论。只评审，不修改代码、提交数据或部署。所有者会把你的反馈交给Codex核实与修复。不要尝试获取SSH、账号凭据、购买或向外联系。

## 阅读与版本

1. 先读originals/用户原文.md、近期用户原话节选.md、本次新增用户原话.md与competition内原件/提取文本。导师材料是用户转述与其粘贴的会议摘要，没有导师逐字稿；不要补造。产品名称以用户明确的Global Chain为准，旧GlobeChain和内部ID不是用户最新命名。
2. 再读04-当前版本与覆盖.json、06-资料来源与限制.md及历次reviews。Codex自述和旧Claude结论均是待核查材料，不是必须接受的结论。历史“未上线”“无首次引导”“demo独立模块”不能直接套用到新版。
3. 公网http://62.171.148.193/，当前应用e7c09af2de182905ac9808385b81689a3515d833。完整源码内的sourceCommit较新仅含文档/打包差异，应用、内容和发布数据与部署版本一致。实际访问若已变化请注明。
4. 有网页操作工具就真实访问；不能访问时使用源码/截图并标注推断。不能把图片阅读称为实际交互，也不能把旧报告测试数字当成你重新运行。

## 重点与操作任务

- 从陌生评委扫码首次进入开始，体验引导的兴趣、质感、长度、跳过/退出/重开和三个角色目的地；检查/demo已退役、首页地图主视觉，以及390手机、1440桌面与键盘使用。重新体验首次访问可用无痕窗口或清理站点存储，不要把完成后的不弹出误判为缺失。
- 世界地图：点击有资料和无资料国家、缩放/平移/选中、高亮轮廓、拖动后误触、贸易箭头粗细与图例、商品/部件/年份切换与后退。中国地图：五商品逐一试、城市选中和筛选URL分享/刷新/前后退；检查能否自然进入产业页面。
- 数据深度是本轮最高关注项。五商品分别查商品拆解、世界/中国地图、供应链、工序设备、产业上下游、企业和来源。新增214主题/225关系是由已有工序投入产出/设备需求转成网络，原地理层仍18角色/12代表连接。请判断是否只是内容重复计数，是否提供了新的探索价值、链条能否连续、是否存在断头入口或过度泛化；不能把技术网络当成真实国别/城市流量。
- 手机69环节/63关系/6企业，棉T40/42/0，大豆油37/41/0，电自27/39/0，空调86/107/18。请独立统计，并查至少每商品一条“材料→工序→设备/应用”的来源链，追到原始资料/期间/转换审计；具体发现须列记录ID和路径。不要为填满内容建议捏造交易或供应商关系。
- 角色效果：公众是否看得懂世界商业连接，产业人员是否能查到实际可用上下游及官方入口，研究者是否更容易读数据/来源。区分“换入口/推荐”与“真正不同的内容工作流”；申请、审核、协作者编辑和管理后台目前没有实现，请评估最小可行方案与优先级，不写成已完成。
- 国家账本、材料、历史版本/下载、部分覆盖指南、搜索与分类：检查单位/年份/统计口径、unknown与0、HS分类与“终端产品/组装件/材料”等用途层级是否合理；同一物料可能在不同产业链扮演不同角色，不应把T1/T2直接当全球统一产品类型。
- 对历次Claude原始问题做完整矩阵：已解决/部分/未解决/不成立/无法验证，附当前证据。尤其区分界面修复与资料覆盖、托管CI配置与实际运行、企业能力与真实供货、技术关系与地理网络。
- 从项目最初愿景和比赛真实用户价值出发指出最影响展示/实用性的三个问题；不要只加防御文案，给能执行、能验收的改法。近期可修问题、需研究补数、长期平台建设分别标注。

## 输出格式

交付CLAUDE-REVIEW-V4.md：①实际版本、工具/访问限制、已读文件与已操作路线；②主要结论；③P0/P1/P2发现（复现步骤、预期/实际、截图或文件:行/数据ID、影响、建议、验收）；④旧报告逐项复核矩阵；⑤五商品内容覆盖/证据抽样表；⑥三身份与未来协作审核建议；⑦建议Codex下一轮最多5项具体动作。区分亲验、静态证据、推断，不凑问题数量。
'''

README = '''# Global Chain 当前版 Claude 评审包

把本包交给Claude，先读00-给Claude的任务.md。尚未发送或获得新评审。

- originals：初衷、导师转述/会议摘要、近期原话、两份赛事PDF与既有提取文本。用户原话与AI总结分开。
- 02-完整源码与发布数据.zip：完整应用、领域/契约/数据加载、配置、脚本、测试、文档和所有已发布历史版本。解压后可检查/安装运行，依赖与构建产物不附带。
- 07-原始数据及历史展示附件.zip：完整包附带，包含原始数据采集批次、PDF等及历史展示附件；解压到同一源码根目录。上传版仅为体积省略此附件，完整文件/哈希清单照样保留；不能称上传版具有全部离线数据重建输入。
- evidence：最近一次真实公网浏览器证据及本次打包HTTP/API版本核对，两者时间与方式明确区分。源码docs/submission里的旧截图是历史物料，不是当前站点截图。
- reviews：Claude原报告及Codex实施/审计记录，均须独立核实。04给出准确版本与仍未实现的范围。

公网：http://62.171.148.193/。二维码仍指向此地址。中国/世界地图与技术产业网络是不同层，数字增长不代表地域覆盖增长。三身份是浏览偏好，不是账户、权限或审核后台。

本次只整理评审包，没有修改产品或再次部署。交付校验.json记录逐文件SHA256，外层ZIP及两层内包均完整性校验。旧包保持原样；本包不含Git历史、凭据、本机配置、用户录音/视频和无关输出。
'''

RUN = '''# 本地检查

解压02到一个新目录；完整包还可将07解压到同一目录。使用Node 24 LTS、pnpm 11.19.0，从项目根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run start --hostname 127.0.0.1 --port 3000
```

然后访问http://127.0.0.1:3000/。运行环境须允许安装依赖；发布页面不依赖运行时外部AI/API。不要强制改用其他包管理器。当前服务器Node v24.22.1。

scripts/verify-industry-content-expansion.mjs、verify-booth-onboarding.mjs、verify-self-host.mjs提供真实Chrome检查；REVIEW_BASE_URL指定站点，REVIEW_OUTPUT_DIR指定独立结果目录。检查脚本需要本机Chrome，Linux可按脚本说明配置Playwright；没有浏览器就如实记录。CI配置不等于已取得托管CI成功记录。

原始数据重建另需07附件及来源可用性。打包保留Git中的历史发布字节；其中smartphone-2023.3存在历史LF/CRLF校验不一致，生产打包脚本仅在匹配原哈希时恢复CRLF；不要修改旧不可变release或借此误判全部现行数据失败。参见scripts/package-self-host.mjs与ops/self-host/README.md。
'''

LIMITS = '''# 资料来源与限制

1. 用户愿景：originals/用户原文.md及原始消息.json沿用已保存历史聊天选段，保留原文、时间和来源标识；不是全量聊天导出。近期两份选段来自当前聊天，分组标题为整理者添加。导师只有用户转述和会议摘要，没有录音/逐字稿，不补造。问答包装中只有answer是用户回答。
2. 赛事：两份PDF逐字节复用、哈希核对，文本提取件沿用既有结果，本次没有重新核验主办方网站、赛程变化或用户所在赛道。历史08:00自动开发截止不适用于当前用户新发起的评审包请求。
3. 版本：sourceCommit为明确Git快照；已部署应用为e7c09af。应用/数据差异断言为空，源码较新只含文档与打包工具。其他聊天未提交历史未纳入。
4. 新数据：复用已有来源，不是本次独立采集的214条新事实。工艺/投入产出/设备转为可浏览关系；原期间、来源、方法和unknown保持。259主题/292关系/24企业是网络规模，不是覆盖全球完整供应商网络。中国层18角色/12代表连接未被该批扩充。
5. 测试：已有53文件266通过/1跳过，新增源保留测试另行1通过；不是本次重新全量运行267测试。最新候选27基础检查和12:37—12:39公网三组浏览器检查有JSON/截图；本次仅新增HTTP/API核对，不假称重跑全站。
6. 当前差距：注册/企业申请/用户本人审核/可信协作者授权未实现；三身份不是独立工作台；政策与地区覆盖部分；其他四商品企业深度不均衡。旧Claude列出问题已修的自述不替代其新评审。外链能否连接和真实资料内容应在可访问时独立抽查，不提交外部表单。
7. 完整性：完整包包含allowlist内所有跟踪源码/数据/文档及已取得原始资料，不包含Git历史、依赖、构建、私有状态和无关输出。若Git LFS指针存在，只从本地取哈希和大小匹配的原件，不联网下载；清单会记录原指针和原件哈希。上传版明确省略07，不冒称完整离线研究环境。
'''


if __name__ == '__main__':
    main()
