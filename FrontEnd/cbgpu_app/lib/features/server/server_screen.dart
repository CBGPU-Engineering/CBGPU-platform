import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/glass.dart';

const _runtimes = [
  ('node20', 'Node.js 20'),
  ('node18', 'Node.js 18'),
  ('python311', 'Python 3.11'),
  ('python39', 'Python 3.9'),
];
const _memoryOpts = ['128m', '256m', '512m', '1g', '2g', '4g'];
const _scopeOpts = [
  ('private', 'Private', Icons.lock_outline, 'Tailscale VPN으로 본인만'),
  ('school', 'School', Icons.school_outlined, '교내 네트워크 + VPN'),
  ('public', 'Public', Icons.public, '인터넷 어디서나 접근'),
];

class _EnvEntry {
  _EnvEntry({this.key = '', this.value = ''});
  String key;
  String value;
}

Future<Map<String, dynamic>?> _fetchOwnProfile() async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return null;
  return Supabase.instance.client
      .from('profiles')
      .select('is_admin, is_approved')
      .eq('id', user.id)
      .maybeSingle();
}

// ─── List ───────────────────────────────────────────────────────────────────

class ServerListScreen extends StatefulWidget {
  const ServerListScreen({super.key});
  @override
  State<ServerListScreen> createState() => _ServerListScreenState();
}

class _ServerListScreenState extends State<ServerListScreen> {
  List<Map<String, dynamic>> _projects = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    try {
      final rows = await Supabase.instance.client
          .from('cpu_projects')
          .select('*')
          .neq('status', 'deleted')
          .order('created_at', ascending: false);
      if (mounted) {
        setState(() => _projects = (rows as List).cast<Map<String, dynamic>>());
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      return AmbientBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.shield_outlined, size: 56, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'Login Required',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
                ),
                const Text(
                  '로그인 후 이용할 수 있습니다.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Login'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 40, 16, 112),
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.end,
            runSpacing: 16,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Server Deploy',
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      fontStyle: FontStyle.italic,
                      letterSpacing: -1.2,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '남는 CPU 자원으로 가벼운 서버를 배포하세요',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.refresh, size: 18),
                    onPressed: _load,
                  ),
                  ElevatedButton.icon(
                    onPressed: () =>
                        context.push('/server/new').then((_) => _load()),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('새 프로젝트'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 40),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 64),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_projects.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.dns_outlined, size: 44, color: Colors.grey),
                    SizedBox(height: 12),
                    Text(
                      '배포된 프로젝트가 없습니다',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            for (final p in _projects) ...[
              _ProjectRow(
                project: p,
                onTap: () =>
                    context.push('/server/${p['id']}').then((_) => _load()),
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}

class _ProjectRow extends StatelessWidget {
  const _ProjectRow({required this.project, required this.onTap});
  final Map<String, dynamic> project;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = project['status'] as String? ?? '';
    final isRunning = status == 'approved' && project['deployed_at'] != null;
    final isDocker = project['deploy_type'] == 'docker';
    final scope = project['access_scope'] as String? ?? 'private';

    final statusColors = {
      'pending': Colors.amber,
      'approved': Colors.green,
      'rejected': Colors.red,
      'deleted': Colors.grey,
    };
    final statusColor = statusColors[status] ?? Colors.grey;

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isRunning
                    ? Colors.green.withValues(alpha: 0.1)
                    : Colors.grey.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isDocker ? Icons.inventory_2_outlined : Icons.merge_type,
                size: 18,
                color: isRunning ? Colors.green : Colors.grey,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          project['name'] as String? ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: statusColor,
                          ),
                        ),
                      ),
                      if (isRunning)
                        Padding(
                          padding: const EdgeInsets.only(left: 4),
                          child: Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${isDocker ? project['docker_image'] : (project['git_url'] as String?)?.replaceFirst('https://', '')} · :${project['host_port']} · $scope',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}

// ─── New project ────────────────────────────────────────────────────────────

class ServerNewScreen extends StatefulWidget {
  const ServerNewScreen({super.key});
  @override
  State<ServerNewScreen> createState() => _ServerNewScreenState();
}

class _ServerNewScreenState extends State<ServerNewScreen> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  String _deployType = 'docker';
  final _dockerImageController = TextEditingController();
  final _gitUrlController = TextEditingController();
  final _gitBranchController = TextEditingController(text: 'main');
  String _runtime = 'node20';
  final _runCommandController = TextEditingController();
  final _containerPortController = TextEditingController(text: '80');
  final _hostPortController = TextEditingController();
  String _accessScope = 'private';
  final _cpuLimitController = TextEditingController(text: '1');
  String _memoryLimit = '512m';
  List<_EnvEntry> _envVars = [];
  bool _submitting = false;

  Future<void> _submit() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    final profile = await _fetchOwnProfile();
    if (profile?['is_approved'] == false) {
      _snack('학번 또는 이름 확인이 필요해 배포할 수 없습니다. 프로필에서 정보를 확인해 주세요.');
      return;
    }
    if (_nameController.text.trim().isEmpty) return _snack('프로젝트 이름을 입력해주세요.');
    if (_deployType == 'docker' && _dockerImageController.text.trim().isEmpty) {
      return _snack('Docker 이미지를 입력해주세요.');
    }
    if (_deployType == 'git' && _gitUrlController.text.trim().isEmpty) {
      return _snack('Git 저장소 URL을 입력해주세요.');
    }
    if (_hostPortController.text.trim().isEmpty) {
      return _snack('호스트 포트를 입력해주세요.');
    }

    final hostPort = int.tryParse(_hostPortController.text.trim());
    final containerPort = int.tryParse(_containerPortController.text.trim());
    if (hostPort == null || hostPort < 1 || hostPort > 65535) {
      return _snack('포트는 1~65535 사이 숫자여야 합니다.');
    }
    if (containerPort == null || containerPort < 1 || containerPort > 65535) {
      return _snack('컨테이너 포트는 1~65535 사이 숫자여야 합니다.');
    }

    final envVarsObj = {
      for (final e in _envVars)
        if (e.key.trim().isNotEmpty) e.key.trim(): e.value,
    };

    setState(() => _submitting = true);
    try {
      await Supabase.instance.client.from('cpu_projects').insert({
        'user_id': user.id,
        'user_email': user.email,
        'name': _nameController.text.trim(),
        'description': _descController.text.trim(),
        'deploy_type': _deployType,
        'docker_image': _deployType == 'docker'
            ? _dockerImageController.text.trim()
            : null,
        'git_url': _deployType == 'git' ? _gitUrlController.text.trim() : null,
        'git_branch': _deployType == 'git'
            ? (_gitBranchController.text.trim().isEmpty
                  ? 'main'
                  : _gitBranchController.text.trim())
            : null,
        'runtime': _deployType == 'git' ? _runtime : null,
        'run_command': _deployType == 'git'
            ? _runCommandController.text.trim()
            : null,
        'container_port': containerPort,
        'host_port': hostPort,
        'access_scope': _accessScope,
        'cpu_limit': _cpuLimitController.text.trim().isEmpty
            ? '1'
            : _cpuLimitController.text.trim(),
        'memory_limit': _memoryLimit,
        'env_vars': envVarsObj,
      });
      _snack('프로젝트가 신청됐습니다. 관리자 승인을 기다려주세요.');
      if (mounted) context.pop();
    } catch (e) {
      if (e.toString().contains('23505')) {
        _snack('이미 사용 중인 포트입니다.');
      } else {
        _snack('프로젝트 생성 실패: $e');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.pop(),
              ),
              const Expanded(
                child: Text(
                  'New Server Project',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
              ),
              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? '신청 중…' : '신청하기'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            '관리자 승인 후 자동으로 배포됩니다',
            style: TextStyle(fontSize: 10, color: Colors.grey),
          ),
          const SizedBox(height: 16),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '프로젝트 기본 정보',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Project Name *',
                    hintText: 'my-web-server',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _descController,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '배포 방식',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _deployTypeCard(
                        'docker',
                        'Docker Image',
                        Icons.inventory_2_outlined,
                        'Docker Hub 이미지로 바로 실행',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _deployTypeCard(
                        'git',
                        'Git Repo',
                        Icons.merge_type,
                        'Git 저장소 클론 후 실행',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_deployType == 'docker')
                  TextField(
                    controller: _dockerImageController,
                    style: const TextStyle(fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      labelText: 'Docker Image *',
                      hintText: 'nginx:latest',
                    ),
                  )
                else ...[
                  TextField(
                    controller: _gitUrlController,
                    style: const TextStyle(fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      labelText: 'Git Repository URL *',
                      hintText: 'https://github.com/user/repo',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _gitBranchController,
                          decoration: const InputDecoration(
                            labelText: 'Branch',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _runtime,
                          decoration: const InputDecoration(
                            labelText: 'Runtime *',
                          ),
                          items: [
                            for (final r in _runtimes)
                              DropdownMenuItem(
                                value: r.$1,
                                child: Text(
                                  r.$2,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                          ],
                          onChanged: (v) => setState(() => _runtime = v!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _runCommandController,
                    style: const TextStyle(fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      labelText: 'Run Command',
                      hintText: 'npm start',
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Environment Variables',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () =>
                          setState(() => _envVars = [..._envVars, _EnvEntry()]),
                      icon: const Icon(Icons.add, size: 14),
                      label: const Text('Add', style: TextStyle(fontSize: 11)),
                    ),
                  ],
                ),
                for (var i = 0; i < _envVars.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            decoration: const InputDecoration(hintText: 'KEY'),
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                            ),
                            onChanged: (v) => _envVars[i].key = v,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: TextField(
                            decoration: const InputDecoration(
                              hintText: 'VALUE',
                            ),
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                            ),
                            onChanged: (v) => _envVars[i].value = v,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 16),
                          onPressed: () => setState(() => _envVars.removeAt(i)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Port Mapping',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _hostPortController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Host Port *',
                          hintText: '9000',
                        ),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        ':',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _containerPortController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Container Port',
                          hintText: '80',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Access Scope',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 8),
                for (final o in _scopeOpts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: _scopeTile(
                      o.$1,
                      o.$2,
                      o.$3,
                      o.$4,
                      _accessScope,
                      (v) => setState(() => _accessScope = v),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Resource Limits',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _cpuLimitController,
                  decoration: const InputDecoration(
                    labelText: 'CPU Cores',
                    hintText: '1',
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _memoryLimit,
                  decoration: const InputDecoration(labelText: 'Memory'),
                  items: [
                    for (final m in _memoryOpts)
                      DropdownMenuItem(
                        value: m,
                        child: Text(
                          m.endsWith('g')
                              ? '${m.substring(0, m.length - 1)} GB'
                              : '${m.substring(0, m.length - 1)} MB',
                        ),
                      ),
                  ],
                  onChanged: (v) => setState(() => _memoryLimit = v!),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _deployTypeCard(
    String value,
    String label,
    IconData icon,
    String desc,
  ) {
    final selected = _deployType == value;
    return InkWell(
      onTap: () => setState(() => _deployType = value),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? Theme.of(context).colorScheme.primary
                : Colors.grey.withValues(alpha: 0.3),
            width: selected ? 2 : 1,
          ),
          color: selected
              ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.06)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              size: 20,
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
            ),
            Text(desc, style: const TextStyle(fontSize: 9, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _scopeTile(
    String value,
    String label,
    IconData icon,
    String desc,
    String selected,
    ValueChanged<String> onChanged,
  ) {
    final isSelected = value == selected;
    return InkWell(
      onTap: () => onChanged(value),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? Theme.of(context).colorScheme.primary
                : Colors.grey.withValues(alpha: 0.3),
            width: isSelected ? 2 : 1,
          ),
          color: isSelected
              ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.06)
              : null,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    desc,
                    style: const TextStyle(fontSize: 9, color: Colors.grey),
                  ),
                ],
              ),
            ),
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              size: 16,
              color: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Detail ─────────────────────────────────────────────────────────────────

class ServerDetailScreen extends StatefulWidget {
  const ServerDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<ServerDetailScreen> createState() => _ServerDetailScreenState();
}

class _ServerDetailScreenState extends State<ServerDetailScreen> {
  Map<String, dynamic>? _project;
  bool _loading = true;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final row = await Supabase.instance.client
          .from('cpu_projects')
          .select('*')
          .eq('id', widget.id)
          .single();
      final profile = await _fetchOwnProfile();
      if (mounted) {
        setState(() {
          _project = row;
          _isAdmin = profile?['is_admin'] == true;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('프로젝트를 찾을 수 없습니다.')));
        context.go('/server');
      }
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('프로젝트 삭제'),
        content: const Text('컨테이너가 종료되고 프로젝트가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('삭제하기', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await Supabase.instance.client
          .from('cpu_projects')
          .update({'status': 'deleted'})
          .eq('id', widget.id);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('프로젝트가 삭제됐습니다.')));
        context.go('/server');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('삭제 실패: $e')));
      }
    }
  }

  Future<void> _openRedeployDialog() async {
    final project = _project!;
    final envEntries = (project['env_vars'] as Map<String, dynamic>? ?? {})
        .entries
        .map((e) => _EnvEntry(key: e.key, value: e.value.toString()))
        .toList();
    final dockerImageController = TextEditingController(
      text: project['docker_image'] as String? ?? '',
    );
    final gitBranchController = TextEditingController(
      text: project['git_branch'] as String? ?? 'main',
    );
    final runCommandController = TextEditingController(
      text: project['run_command'] as String? ?? '',
    );
    final containerPortController = TextEditingController(
      text: '${project['container_port'] ?? 80}',
    );
    final hostPortController = TextEditingController(
      text: '${project['host_port']}',
    );
    final cpuLimitController = TextEditingController(
      text: project['cpu_limit'] as String? ?? '1',
    );
    var runtime = project['runtime'] as String? ?? 'node20';
    var accessScope = project['access_scope'] as String? ?? 'private';
    var memoryLimit = project['memory_limit'] as String? ?? '512m';
    var submitting = false;
    final isDocker = project['deploy_type'] == 'docker';

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Redeploy'),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    '설정을 변경하고 재배포합니다. 잠시 다운타임이 발생합니다.',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  if (isDocker)
                    TextField(
                      controller: dockerImageController,
                      decoration: const InputDecoration(
                        labelText: 'Docker Image',
                      ),
                    )
                  else ...[
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: gitBranchController,
                            decoration: const InputDecoration(
                              labelText: 'Branch',
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: runtime,
                            decoration: const InputDecoration(
                              labelText: 'Runtime',
                            ),
                            items: [
                              for (final r in _runtimes)
                                DropdownMenuItem(
                                  value: r.$1,
                                  child: Text(
                                    r.$2,
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                            ],
                            onChanged: (v) =>
                                setDialogState(() => runtime = v!),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: runCommandController,
                      decoration: const InputDecoration(
                        labelText: 'Run Command',
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: hostPortController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Host Port',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: containerPortController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Container Port',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final o in _scopeOpts)
                        ChoiceChip(
                          label: Text(o.$2),
                          selected: accessScope == o.$1,
                          onSelected: (_) =>
                              setDialogState(() => accessScope = o.$1),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: cpuLimitController,
                          decoration: const InputDecoration(
                            labelText: 'CPU Cores',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: memoryLimit,
                          decoration: const InputDecoration(
                            labelText: 'Memory',
                          ),
                          items: [
                            for (final m in _memoryOpts)
                              DropdownMenuItem(value: m, child: Text(m)),
                          ],
                          onChanged: (v) =>
                              setDialogState(() => memoryLimit = v!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Environment Variables',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () =>
                            setDialogState(() => envEntries.add(_EnvEntry())),
                        icon: const Icon(Icons.add, size: 14),
                        label: const Text(
                          'Add',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                  for (var i = 0; i < envEntries.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: TextEditingController(
                                text: envEntries[i].key,
                              ),
                              decoration: const InputDecoration(
                                hintText: 'KEY',
                              ),
                              style: const TextStyle(fontSize: 12),
                              onChanged: (v) => envEntries[i].key = v,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: TextField(
                              controller: TextEditingController(
                                text: envEntries[i].value,
                              ),
                              decoration: const InputDecoration(
                                hintText: 'VALUE',
                              ),
                              style: const TextStyle(fontSize: 12),
                              onChanged: (v) => envEntries[i].value = v,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 16),
                            onPressed: () =>
                                setDialogState(() => envEntries.removeAt(i)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('취소'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      final profile = await _fetchOwnProfile();
                      if (profile?['is_approved'] == false) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('학번 또는 이름 확인이 필요해 재배포할 수 없습니다.'),
                            ),
                          );
                        }
                        return;
                      }
                      final hostPort = int.tryParse(
                        hostPortController.text.trim(),
                      );
                      final containerPort =
                          int.tryParse(containerPortController.text.trim()) ??
                          80;
                      if (hostPort == null) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('포트는 숫자여야 합니다.')),
                          );
                        }
                        return;
                      }
                      setDialogState(() => submitting = true);
                      final envVarsObj = {
                        for (final e in envEntries)
                          if (e.key.trim().isNotEmpty) e.key.trim(): e.value,
                      };
                      final updates = <String, dynamic>{
                        'container_port': containerPort,
                        'host_port': hostPort,
                        'access_scope': accessScope,
                        'cpu_limit': cpuLimitController.text.trim().isEmpty
                            ? '1'
                            : cpuLimitController.text.trim(),
                        'memory_limit': memoryLimit,
                        'env_vars': envVarsObj,
                        'deploy_requested_at': DateTime.now().toIso8601String(),
                      };
                      if (isDocker) {
                        if (dockerImageController.text.trim().isEmpty) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('이미지를 입력해주세요.')),
                            );
                          }
                          setDialogState(() => submitting = false);
                          return;
                        }
                        updates['docker_image'] = dockerImageController.text
                            .trim();
                      } else {
                        updates['git_branch'] =
                            gitBranchController.text.trim().isEmpty
                            ? 'main'
                            : gitBranchController.text.trim();
                        updates['runtime'] = runtime;
                        updates['run_command'] = runCommandController.text
                            .trim();
                      }
                      try {
                        await Supabase.instance.client
                            .from('cpu_projects')
                            .update(updates)
                            .eq('id', widget.id);
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('재배포가 요청됐습니다. 잠시 후 적용됩니다.'),
                            ),
                          );
                        }
                        _load();
                      } catch (e) {
                        setDialogState(() => submitting = false);
                        final msg = e.toString().contains('23505')
                            ? '이미 사용 중인 포트입니다.'
                            : '재배포 요청 실패: $e';
                        if (context.mounted) {
                          ScaffoldMessenger.of(
                            context,
                          ).showSnackBar(SnackBar(content: Text(msg)));
                        }
                      }
                    },
              child: Text(submitting ? '요청 중...' : '재배포'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const AmbientBackground(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final project = _project;
    if (project == null) {
      return const AmbientBackground(child: SizedBox.shrink());
    }

    final userId = Supabase.instance.client.auth.currentUser?.id;
    final isOwner = userId == project['user_id'];
    final canManage = isOwner || _isAdmin;
    final status = project['status'] as String? ?? '';
    final isRunning = status == 'approved' && project['deployed_at'] != null;
    final serverUrl = 'http://[서버IP]:${project['host_port']}';
    final isDocker = project['deploy_type'] == 'docker';
    final envEntries = (project['env_vars'] as Map<String, dynamic>? ?? {})
        .entries
        .toList();

    final statusInfo =
        {
          'pending': ('Pending — 관리자 승인 대기 중', Colors.amber),
          'approved': (
            isRunning ? 'Running' : 'Approved — 배포 준비 중',
            Colors.green,
          ),
          'rejected': ('Rejected', Colors.red),
          'deleted': ('Deleted', Colors.grey),
        }[status] ??
        (status, Colors.grey);

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          TextButton.icon(
            onPressed: () => context.go('/server'),
            icon: const Icon(Icons.arrow_back, size: 14),
            label: const Text(
              'Back to Projects',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          project['name'] as String? ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: statusInfo.$2.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            statusInfo.$1,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: statusInfo.$2,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if ((project['description'] as String?)?.isNotEmpty ??
                        false)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          project['description'] as String,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (canManage && status != 'deleted') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                if (status == 'approved')
                  OutlinedButton.icon(
                    onPressed: _openRedeployDialog,
                    icon: const Icon(Icons.replay, size: 14),
                    label: const Text('재배포'),
                  ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                  onPressed: _delete,
                  icon: const Icon(Icons.delete_outline, size: 14),
                  label: const Text('삭제'),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          if (isRunning)
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.06),
                border: Border.all(
                  color: Colors.green.withValues(alpha: 0.2),
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Access',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: Colors.green.shade700,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          serverUrl,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w900,
                            color: Colors.green.shade700,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          Icons.open_in_new,
                          size: 16,
                          color: Colors.green.shade700,
                        ),
                        onPressed: () => launchUrl(Uri.parse(serverUrl)),
                      ),
                    ],
                  ),
                  Text(switch (project['access_scope']) {
                    'private' => '※ Tailscale VPN 연결 시에만 접근 가능합니다',
                    'school' => '※ 교내 네트워크 또는 Tailscale VPN에서 접근 가능합니다',
                    _ => '※ 인터넷 어디서나 접근 가능합니다',
                  }, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
            ),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Configuration',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                    letterSpacing: 1,
                  ),
                ),
                const Divider(),
                _row(
                  'Deploy Type',
                  (project['deploy_type'] as String? ?? '').toUpperCase(),
                ),
                if (isDocker)
                  _row('Docker Image', project['docker_image'] as String? ?? '')
                else ...[
                  _row('Git Repository', project['git_url'] as String? ?? ''),
                  Row(
                    children: [
                      Expanded(
                        child: _row(
                          'Branch',
                          project['git_branch'] as String? ?? 'main',
                        ),
                      ),
                      Expanded(
                        child: _row(
                          'Runtime',
                          _runtimes
                              .firstWhere(
                                (r) => r.$1 == project['runtime'],
                                orElse: () =>
                                    ('', project['runtime']?.toString() ?? ''),
                              )
                              .$2,
                        ),
                      ),
                    ],
                  ),
                  _row('Run Command', project['run_command'] as String? ?? '—'),
                ],
                _row(
                  'Port Mapping',
                  '${project['host_port']}:${project['container_port']} (host:container)',
                ),
                _row('Access Scope', project['access_scope'] as String? ?? ''),
                Row(
                  children: [
                    Expanded(
                      child: _row(
                        'CPU Limit',
                        '${project['cpu_limit']} core(s)',
                      ),
                    ),
                    Expanded(
                      child: _row('Memory Limit', '${project['memory_limit']}'),
                    ),
                  ],
                ),
                if (envEntries.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Environment Variables',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  for (final e in envEntries)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.grey.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text.rich(
                          TextSpan(
                            text: e.key,
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w900,
                              color: Theme.of(context).colorScheme.primary,
                              fontSize: 11,
                            ),
                            children: [
                              TextSpan(
                                text: ' = ${e.value}',
                                style: const TextStyle(
                                  color: Colors.grey,
                                  fontWeight: FontWeight.normal,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
                const Divider(),
                Row(
                  children: [
                    Expanded(
                      child: _row(
                        'Created',
                        DateTime.parse(
                          project['created_at'] as String,
                        ).toLocal().toString().substring(0, 16),
                      ),
                    ),
                    if (project['deployed_at'] != null)
                      Expanded(
                        child: _row(
                          'Last Deployed',
                          DateTime.parse(
                            project['deployed_at'] as String,
                          ).toLocal().toString().substring(0, 16),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade500,
              letterSpacing: 0.5,
            ),
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
