import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';

const _subjects = [
  '수학',
  '물리',
  '화학',
  '생물',
  '지구과학',
  '정보',
  'AI/ML',
  '프로그래밍',
  '영어',
  '국어',
  '기타',
];

class _StudyPost {
  _StudyPost({
    required this.id,
    required this.userId,
    required this.subject,
    required this.title,
    required this.description,
    required this.tags,
    required this.maxMembers,
    required this.isOpen,
  });
  final String id;
  final String userId;
  final String subject;
  final String title;
  final String description;
  final List<String> tags;
  final int maxMembers;
  final bool isOpen;

  factory _StudyPost.fromRow(Map<String, dynamic> r) => _StudyPost(
    id: r['id'] as String,
    userId: r['user_id'] as String,
    subject: r['subject'] as String? ?? '',
    title: r['title'] as String? ?? '',
    description: r['description'] as String? ?? '',
    tags: (r['tags'] as List?)?.map((e) => e.toString()).toList() ?? [],
    maxMembers: r['max_members'] as int? ?? 4,
    isOpen: r['is_open'] as bool? ?? true,
  );
}

class _Member {
  _Member(this.postId, this.userId);
  final String postId;
  final String userId;
}

class _Profile {
  _Profile(this.fullName, this.avatarUrl);
  final String? fullName;
  final String? avatarUrl;
}

class MatchScreen extends StatefulWidget {
  const MatchScreen({super.key});
  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen> {
  List<_StudyPost> _posts = [];
  List<_Member> _members = [];
  Map<String, _Profile> _profiles = {};
  String _tab = 'all';
  String _filter = '';
  bool _loading = true;
  bool _dbMissing = false;
  RealtimeChannel? _channel;

  String? get _myId => Supabase.instance.client.auth.currentUser?.id;

  @override
  void initState() {
    super.initState();
    _load();
    _channel = Supabase.instance.client
        .channel('study-rt')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'study_posts',
          callback: (_) => _load(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'study_members',
          callback: (_) => _load(),
        )
        .subscribe();
  }

  @override
  void dispose() {
    if (_channel != null) Supabase.instance.client.removeChannel(_channel!);
    super.dispose();
  }

  Future<void> _load() async {
    final client = Supabase.instance.client;
    try {
      final postsRaw = await client
          .from('study_posts')
          .select('*')
          .order('created_at', ascending: false)
          .limit(500);
      final membersRaw = await client
          .from('study_members')
          .select('post_id, user_id, joined_at')
          .limit(2000);

      final posts = (postsRaw as List)
          .map((r) => _StudyPost.fromRow(r as Map<String, dynamic>))
          .toList();
      final members = (membersRaw as List)
          .map((r) => _Member(r['post_id'] as String, r['user_id'] as String))
          .toList();

      final ids = {
        ...members.map((m) => m.userId),
        ...posts.map((p) => p.userId),
      }.toList();
      var profiles = <String, _Profile>{};
      if (ids.isNotEmpty) {
        final profsRaw = await client
            .from('profiles')
            .select('id, full_name, avatar_url')
            .inFilter('id', ids);
        profiles = {
          for (final r in profsRaw as List)
            r['id'] as String: _Profile(
              r['full_name'] as String?,
              r['avatar_url'] as String?,
            ),
        };
      }

      if (!mounted) return;
      setState(() {
        _posts = posts;
        _members = members;
        _profiles = profiles;
        _loading = false;
      });
    } catch (e) {
      if (e.toString().contains('does not exist')) {
        if (mounted) {
          setState(() {
            _dbMissing = true;
            _loading = false;
          });
        }
        return;
      }
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _join(String postId) async {
    try {
      await Supabase.instance.client.from('study_members').insert({
        'post_id': postId,
        'user_id': _myId,
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('참여했습니다!')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _leave(String postId) async {
    await Supabase.instance.client
        .from('study_members')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', _myId as Object);
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('탈퇴했습니다.')));
    }
    _load();
  }

  Future<void> _delete(String postId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('삭제하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('삭제', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await Supabase.instance.client
        .from('study_posts')
        .delete()
        .eq('id', postId);
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('삭제됐습니다.')));
    }
    _load();
  }

  Future<void> _close(String postId) async {
    await Supabase.instance.client
        .from('study_posts')
        .update({'is_open': false})
        .eq('id', postId);
    _load();
  }

  Future<void> _openCreateForm() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => const _CreateStudyDialog(),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_dbMissing) {
      return const AmbientBackground(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('⚠️', style: TextStyle(fontSize: 40)),
                SizedBox(height: 8),
                Text(
                  'DB 설정 필요',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
                SizedBox(height: 4),
                Text(
                  'supabase_notes_study_migration.sql을 실행해 주세요.',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    final myPostIds = _posts
        .where((p) => p.userId == _myId)
        .map((p) => p.id)
        .toSet();
    final myJoined = _members
        .where((m) => m.userId == _myId)
        .map((m) => m.postId)
        .toSet();
    final shown = _posts
        .where(
          (p) =>
              _tab == 'all' ||
              myPostIds.contains(p.id) ||
              myJoined.contains(p.id),
        )
        .where(
          (p) =>
              _filter.isEmpty ||
              p.subject == _filter ||
              p.title.contains(_filter) ||
              p.tags.any((t) => t.contains(_filter)),
        )
        .toList();

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 704),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 112),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '스터디 매칭',
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            letterSpacing: -0.8,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '같이 공부할 사람 구하기',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.grey,
                            fontSize: 12,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_myId != null)
                    ElevatedButton.icon(
                      onPressed: _openCreateForm,
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('만들기'),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  ChoiceChip(
                    label: const Text('전체'),
                    selected: _tab == 'all',
                    onSelected: (_) => setState(() => _tab = 'all'),
                  ),
                  const SizedBox(width: 6),
                  ChoiceChip(
                    label: const Text('참여 중'),
                    selected: _tab == 'mine',
                    onSelected: (_) => setState(() => _tab = 'mine'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: [
                  _filterChip('전체', ''),
                  for (final s in _subjects) _filterChip(s, s),
                ],
              ),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 64),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (shown.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Text(
                      '스터디 그룹이 없습니다.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                for (final post in shown) ...[
                  _PostCard(
                    post: post,
                    members: _members,
                    myUserId: _myId ?? '',
                    profiles: _profiles,
                    onJoin: () => _join(post.id),
                    onLeave: () => _leave(post.id),
                    onDelete: () => _delete(post.id),
                    onClose: () => _close(post.id),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    return ChoiceChip(
      label: Text(
        label,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900),
      ),
      selected: _filter == value,
      onSelected: (_) =>
          setState(() => _filter = _filter == value ? '' : value),
    );
  }
}

class _PostCard extends StatefulWidget {
  const _PostCard({
    required this.post,
    required this.members,
    required this.myUserId,
    required this.profiles,
    required this.onJoin,
    required this.onLeave,
    required this.onDelete,
    required this.onClose,
  });
  final _StudyPost post;
  final List<_Member> members;
  final String myUserId;
  final Map<String, _Profile> profiles;
  final VoidCallback onJoin;
  final VoidCallback onLeave;
  final VoidCallback onDelete;
  final VoidCallback onClose;

  @override
  State<_PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<_PostCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final postMembers = widget.members
        .where((m) => m.postId == post.id)
        .map((m) => m.userId)
        .toList();
    final allMemberIds = [
      post.userId,
      ...postMembers.where((id) => id != post.userId),
    ];
    final cnt = allMemberIds.length;
    final joined = allMemberIds.contains(widget.myUserId);
    final isOwner = post.userId == widget.myUserId;
    final full = cnt >= post.maxMembers;

    return GlassCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => setState(() => _open = !_open),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            _badge(
                              post.subject,
                              Theme.of(
                                context,
                              ).colorScheme.primary.withValues(alpha: 0.12),
                              Theme.of(context).colorScheme.primary,
                            ),
                            if (!post.isOpen)
                              _badge(
                                '마감',
                                Colors.grey.withValues(alpha: 0.15),
                                Colors.grey,
                              ),
                            if (joined)
                              _badge(
                                '참여 중',
                                Colors.green.withValues(alpha: 0.15),
                                Colors.green,
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          post.title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                          ),
                        ),
                        if (post.description.isNotEmpty)
                          Text(
                            post.description,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.grey,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      const Icon(
                        Icons.people_outline,
                        size: 14,
                        color: Colors.grey,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        '$cnt/${post.maxMembers}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                  if (isOwner) ...[
                    if (post.isOpen)
                      IconButton(
                        icon: const Icon(Icons.lock_outline, size: 15),
                        onPressed: widget.onClose,
                        visualDensity: VisualDensity.compact,
                      ),
                    IconButton(
                      icon: const Icon(
                        Icons.delete_outline,
                        size: 15,
                        color: Colors.red,
                      ),
                      onPressed: widget.onDelete,
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ],
              ),
              if (post.tags.isNotEmpty) ...[
                const SizedBox(height: 6),
                Wrap(
                  spacing: 4,
                  children: [
                    for (final t in post.tags)
                      _badge(
                        t,
                        Colors.grey.withValues(alpha: 0.1),
                        Colors.grey,
                      ),
                  ],
                ),
              ],
              if (_open) ...[
                const Divider(height: 20),
                Text(
                  '참여 멤버 ($cnt/${post.maxMembers})',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final id in allMemberIds)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.grey.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (widget.profiles[id]?.avatarUrl != null)
                              ClipOval(
                                child: Image.network(
                                  widget.profiles[id]!.avatarUrl!,
                                  width: 18,
                                  height: 18,
                                  fit: BoxFit.cover,
                                ),
                              )
                            else
                              const CircleAvatar(
                                radius: 9,
                                backgroundColor: Colors.grey,
                              ),
                            const SizedBox(width: 6),
                            Text(
                              widget.profiles[id]?.fullName ?? '익명',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (id == post.userId)
                              Padding(
                                padding: const EdgeInsets.only(left: 4),
                                child: Text(
                                  '장',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
                if (post.isOpen && !isOwner) ...[
                  const SizedBox(height: 10),
                  joined
                      ? OutlinedButton.icon(
                          onPressed: widget.onLeave,
                          icon: const Icon(Icons.close, size: 14),
                          label: const Text('탈퇴'),
                        )
                      : ElevatedButton.icon(
                          onPressed: full ? null : widget.onJoin,
                          icon: const Icon(Icons.add, size: 14),
                          label: Text(full ? '정원 초과' : '참여하기'),
                        ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: fg),
      ),
    );
  }
}

class _CreateStudyDialog extends StatefulWidget {
  const _CreateStudyDialog();
  @override
  State<_CreateStudyDialog> createState() => _CreateStudyDialogState();
}

class _CreateStudyDialogState extends State<_CreateStudyDialog> {
  String _subject = '수학';
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _tagController = TextEditingController();
  final List<String> _tags = [];
  int _max = 4;
  bool _saving = false;

  void _addTag() {
    final t = _tagController.text.trim();
    if (t.isNotEmpty && !_tags.contains(t) && _tags.length < 5) {
      setState(() => _tags.add(t));
    }
    _tagController.clear();
  }

  Future<void> _submit() async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('제목을 입력하세요')));
      return;
    }
    setState(() => _saving = true);
    try {
      await Supabase.instance.client.from('study_posts').insert({
        'user_id': Supabase.instance.client.auth.currentUser!.id,
        'subject': _subject,
        'title': _titleController.text.trim(),
        'description': _descController.text.trim(),
        'tags': _tags,
        'max_members': _max,
        'is_open': true,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _tagController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '새 스터디 만들기',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: [
                  for (final s in _subjects)
                    ChoiceChip(
                      label: Text(
                        s,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      selected: _subject == s,
                      onSelected: (_) => setState(() => _subject = s),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _titleController,
                style: const TextStyle(fontWeight: FontWeight.bold),
                decoration: const InputDecoration(hintText: '스터디 제목 *'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _descController,
                maxLines: 3,
                decoration: const InputDecoration(hintText: '설명 (선택)'),
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '최대 인원',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: Colors.grey,
                          ),
                        ),
                        TextField(
                          keyboardType: TextInputType.number,
                          controller: TextEditingController(text: '$_max'),
                          onChanged: (v) => _max = int.tryParse(v) ?? _max,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '태그 (최대 5개)',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: Colors.grey,
                          ),
                        ),
                        TextField(
                          controller: _tagController,
                          decoration: const InputDecoration(
                            hintText: 'Enter로 추가',
                          ),
                          onSubmitted: (_) => _addTag(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (_tags.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 4,
                  children: [
                    for (final t in _tags)
                      Chip(
                        label: Text(t, style: const TextStyle(fontSize: 10)),
                        onDeleted: () => setState(() => _tags.remove(t)),
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  child: Text(_saving ? '만드는 중...' : '스터디 만들기'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
