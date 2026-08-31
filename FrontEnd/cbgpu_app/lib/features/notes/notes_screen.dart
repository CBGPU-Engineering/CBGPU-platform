import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';

class _Note {
  _Note({
    required this.id,
    required this.userId,
    required this.title,
    required this.content,
    required this.tags,
    required this.isShared,
    required this.updatedAt,
  });
  final String id;
  final String userId;
  final String title;
  final String content;
  final List<String> tags;
  final bool isShared;
  final DateTime updatedAt;

  factory _Note.fromRow(Map<String, dynamic> r) => _Note(
    id: r['id'] as String,
    userId: r['user_id'] as String,
    title: r['title'] as String? ?? '',
    content: r['content'] as String? ?? '',
    tags: (r['tags'] as List?)?.map((e) => e.toString()).toList() ?? [],
    isShared: r['is_shared'] as bool? ?? false,
    updatedAt: DateTime.parse(r['updated_at'] as String),
  );
}

class NotesScreen extends StatefulWidget {
  const NotesScreen({super.key});
  @override
  State<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends State<NotesScreen> {
  // null = list view; a _Note = editing existing; the sentinel _newNote = new note.
  static final _newNoteSentinel = _Note(
    id: '__new__',
    userId: '',
    title: '',
    content: '',
    tags: [],
    isShared: false,
    updatedAt: DateTime.now(),
  );
  _Note? _editing;

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      return const AmbientBackground(
        child: Center(
          child: Text(
            '로그인이 필요합니다',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
          ),
        ),
      );
    }

    if (_editing != null) {
      return _NoteEditorScreen(
        note: identical(_editing, _newNoteSentinel) ? null : _editing,
        onBack: () => setState(() => _editing = null),
        onSaved: (n) => setState(() => _editing = n),
      );
    }

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 112),
            children: [
              const Text(
                '연구노트',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  fontStyle: FontStyle.italic,
                  letterSpacing: -0.8,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                '마크다운 지원 · 자동 저장 · 공유 가능',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                  fontSize: 12,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 24),
              _NoteList(
                onOpen: (n) => setState(() => _editing = n ?? _newNoteSentinel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoteList extends StatefulWidget {
  const _NoteList({required this.onOpen});
  final void Function(_Note? note) onOpen;
  @override
  State<_NoteList> createState() => _NoteListState();
}

class _NoteListState extends State<_NoteList> {
  List<_Note> _mine = [];
  List<_Note> _shared = [];
  String _tab = 'mine';
  String _search = '';
  bool _loading = true;
  bool _dbMissing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final mineRaw = await Supabase.instance.client
          .from('research_notes')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', ascending: false)
          .limit(500);
      final sharedRaw = await Supabase.instance.client
          .from('research_notes')
          .select('*')
          .eq('is_shared', true)
          .neq('user_id', user.id)
          .order('updated_at', ascending: false)
          .limit(500);
      if (!mounted) return;
      setState(() {
        _mine = (mineRaw as List)
            .map((r) => _Note.fromRow(r as Map<String, dynamic>))
            .toList();
        _shared = (sharedRaw as List)
            .map((r) => _Note.fromRow(r as Map<String, dynamic>))
            .toList();
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

  Future<void> _delete(String id) async {
    await Supabase.instance.client.from('research_notes').delete().eq('id', id);
    if (mounted) {
      setState(() => _mine = _mine.where((n) => n.id != id).toList());
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('삭제됐습니다.')));
    }
  }

  Future<void> _confirmDelete(String id) async {
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
    if (confirmed == true) _delete(id);
  }

  @override
  Widget build(BuildContext context) {
    if (_dbMissing) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Column(
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
      );
    }

    final list = _tab == 'mine' ? _mine : _shared;
    final shown = list
        .where(
          (n) =>
              n.title.toLowerCase().contains(_search.toLowerCase()) ||
              n.tags.any((t) => t.contains(_search)),
        )
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            ChoiceChip(
              label: Text('내 노트 (${_mine.length})'),
              selected: _tab == 'mine',
              onSelected: (_) => setState(() => _tab = 'mine'),
            ),
            const SizedBox(width: 6),
            ChoiceChip(
              label: Text('공유됨 (${_shared.length})'),
              selected: _tab == 'shared',
              onSelected: (_) => setState(() => _tab = 'shared'),
            ),
            const Spacer(),
            if (_tab == 'mine')
              IconButton.filled(
                onPressed: () => widget.onOpen(null),
                icon: const Icon(Icons.add, size: 18),
              ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          decoration: const InputDecoration(
            hintText: '검색...',
            prefixIcon: Icon(Icons.search, size: 18),
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 16),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (shown.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Center(
              child: Text(
                _tab == 'mine' ? '노트를 만들어 보세요.' : '공유된 노트가 없습니다.',
                style: const TextStyle(color: Colors.grey),
              ),
            ),
          )
        else
          for (final note in shown) ...[
            _NoteCard(
              note: note,
              isMine: _tab == 'mine',
              onTap: () => widget.onOpen(note),
              onDelete: () => _confirmDelete(note.id),
            ),
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({
    required this.note,
    required this.isMine,
    required this.onTap,
    required this.onDelete,
  });
  final _Note note;
  final bool isMine;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final preview = note.content.length > 100
        ? note.content.substring(0, 100)
        : note.content;
    final cleaned = preview.replaceAll(RegExp(r'[#*`>-]'), '');
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    note.title.isEmpty ? '제목 없음' : note.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                ),
                if (isMine)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 16),
                    color: Colors.grey,
                    onPressed: onDelete,
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            Text(
              cleaned.isEmpty ? '(내용 없음)' : cleaned,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                for (final t in note.tags.take(3))
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Theme.of(
                          context,
                        ).colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        t,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                  ),
                const Spacer(),
                if (note.isShared) ...[
                  const Icon(Icons.share, size: 10, color: Colors.grey),
                  const SizedBox(width: 2),
                  const Text(
                    '공개',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                Text(
                  '${note.updatedAt.year}.${note.updatedAt.month}.${note.updatedAt.day}',
                  style: const TextStyle(fontSize: 9, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Editor ─────────────────────────────────────────────────────────────────

enum _SaveState { idle, saving, saved }

class _NoteEditorScreen extends StatefulWidget {
  const _NoteEditorScreen({
    required this.note,
    required this.onBack,
    required this.onSaved,
  });
  final _Note? note;
  final VoidCallback onBack;
  final void Function(_Note note) onSaved;

  @override
  State<_NoteEditorScreen> createState() => _NoteEditorScreenState();
}

class _NoteEditorScreenState extends State<_NoteEditorScreen> {
  late final _titleController = TextEditingController(
    text: widget.note?.title ?? '',
  );
  late final _contentController = TextEditingController(
    text: widget.note?.content ?? '',
  );
  late List<String> _tags = List.of(widget.note?.tags ?? []);
  late bool _shared = widget.note?.isShared ?? false;
  final _tagController = TextEditingController();
  _SaveState _saveState = _SaveState.idle;
  String _view = 'edit';
  Timer? _autoSaveTimer;
  Timer? _savedFlashTimer;
  String? _noteId;

  bool get _isOwner =>
      widget.note == null ||
      widget.note!.userId == Supabase.instance.client.auth.currentUser?.id;

  @override
  void initState() {
    super.initState();
    _noteId = widget.note?.id;
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    _savedFlashTimer?.cancel();
    _titleController.dispose();
    _contentController.dispose();
    _tagController.dispose();
    super.dispose();
  }

  void _scheduleAutoSave() {
    _autoSaveTimer?.cancel();
    _autoSaveTimer = Timer(const Duration(seconds: 2), _save);
  }

  Future<void> _saveNow() async {
    _autoSaveTimer?.cancel();
    await _save();
  }

  Future<void> _save() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    setState(() => _saveState = _SaveState.saving);
    final payload = {
      'title': _titleController.text.isEmpty ? '제목 없음' : _titleController.text,
      'content': _contentController.text,
      'tags': _tags,
      'is_shared': _shared,
      'updated_at': DateTime.now().toIso8601String(),
      'user_id': user.id,
    };
    try {
      final Map<String, dynamic> row;
      if (_noteId != null) {
        row = await Supabase.instance.client
            .from('research_notes')
            .update(payload)
            .eq('id', _noteId!)
            .select()
            .single();
      } else {
        row = await Supabase.instance.client
            .from('research_notes')
            .insert(payload)
            .select()
            .single();
      }
      _noteId = row['id'] as String;
      if (!mounted) return;
      setState(() => _saveState = _SaveState.saved);
      _savedFlashTimer?.cancel();
      _savedFlashTimer = Timer(const Duration(milliseconds: 1500), () {
        if (mounted) setState(() => _saveState = _SaveState.idle);
      });
      widget.onSaved(_Note.fromRow(row));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saveState = _SaveState.idle);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  void _addTag() {
    final t = _tagController.text.trim();
    if (t.isNotEmpty && !_tags.contains(t)) {
      setState(() => _tags = [..._tags, t]);
      _scheduleAutoSave();
    }
    _tagController.clear();
  }

  void _removeTag(String t) {
    setState(() => _tags = _tags.where((x) => x != t).toList());
    _saveNow();
  }

  void _toggleShared() {
    setState(() => _shared = !_shared);
    _saveNow();
  }

  void _wrapSelection(String before, [String? after]) {
    after ??= before;
    final sel = _contentController.selection;
    final text = _contentController.text;
    final start = sel.start < 0 ? text.length : sel.start;
    final end = sel.end < 0 ? text.length : sel.end;
    final next = text.replaceRange(
      start,
      end,
      '$before${text.substring(start, end)}$after',
    );
    _contentController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(
        offset: start + before.length + (end - start),
      ),
    );
    _scheduleAutoSave();
  }

  void _prefixCurrentLine(String prefix) {
    final sel = _contentController.selection;
    final text = _contentController.text;
    final pos = sel.start < 0 ? text.length : sel.start;
    final lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    final next = text.replaceRange(lineStart, lineStart, prefix);
    _contentController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: pos + prefix.length),
    );
    _scheduleAutoSave();
  }

  void _appendDivider() {
    _contentController.text += '\n---\n';
    _contentController.selection = TextSelection.collapsed(
      offset: _contentController.text.length,
    );
    _scheduleAutoSave();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isOwner) {
      return Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back),
                      onPressed: widget.onBack,
                    ),
                    Expanded(
                      child: Text(
                        _titleController.text.isEmpty
                            ? '제목 없음'
                            : _titleController.text,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.grey.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        '공개 노트',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _MarkdownView(source: _contentController.text),
                ),
              ),
              if (_tags.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Wrap(
                    spacing: 4,
                    children: [
                      for (final t in _tags)
                        Chip(
                          label: Text(t, style: const TextStyle(fontSize: 10)),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: widget.onBack,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _titleController,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                      decoration: const InputDecoration(
                        hintText: '제목 없음',
                        border: InputBorder.none,
                      ),
                      onChanged: (_) => _scheduleAutoSave(),
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      _shared ? Icons.share : Icons.lock_outline,
                      size: 16,
                      color: _shared
                          ? Theme.of(context).colorScheme.primary
                          : Colors.grey,
                    ),
                    onPressed: _toggleShared,
                    tooltip: _shared ? '공개' : '비공개',
                  ),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'edit', label: Text('편집')),
                      ButtonSegment(value: 'preview', label: Text('미리보기')),
                    ],
                    selected: {_view},
                    onSelectionChanged: (s) => setState(() => _view = s.first),
                    showSelectedIcon: false,
                  ),
                  const SizedBox(width: 4),
                  FilledButton.icon(
                    onPressed: _saveState == _SaveState.saving
                        ? null
                        : _saveNow,
                    icon: _saveState == _SaveState.saving
                        ? const SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            _saveState == _SaveState.saved
                                ? Icons.check
                                : Icons.save,
                            size: 14,
                          ),
                    label: Text(
                      _saveState == _SaveState.saving
                          ? '저장 중...'
                          : (_saveState == _SaveState.saved ? '저장됨' : '저장'),
                    ),
                    style: _saveState == _SaveState.saved
                        ? FilledButton.styleFrom(backgroundColor: Colors.green)
                        : null,
                  ),
                ],
              ),
            ),
            if (_view == 'edit')
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  children: [
                    for (final t in const [
                      ('H1', null),
                      ('H2', null),
                      ('B', null),
                      ('I', null),
                      ('`', null),
                      ('```', null),
                      ('>', null),
                      ('—', null),
                    ])
                      TextButton(
                        onPressed: () => _onToolbar(t.$1),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(32, 32),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        child: Text(
                          t.$1,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            const Divider(height: 1),
            Expanded(
              child: _view == 'edit'
                  ? Padding(
                      padding: const EdgeInsets.all(16),
                      child: TextField(
                        controller: _contentController,
                        maxLines: null,
                        expands: true,
                        textAlignVertical: TextAlignVertical.top,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          height: 1.5,
                        ),
                        decoration: const InputDecoration(
                          hintText: '# 연구 노트 제목\n\n내용을 입력하세요...',
                          border: InputBorder.none,
                        ),
                        onChanged: (_) => _scheduleAutoSave(),
                      ),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: _MarkdownView(source: _contentController.text),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.sell_outlined, size: 14, color: Colors.grey),
                  const SizedBox(width: 6),
                  Wrap(
                    spacing: 4,
                    children: [
                      for (final t in _tags)
                        Chip(
                          label: Text(t, style: const TextStyle(fontSize: 10)),
                          onDeleted: () => _removeTag(t),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                  Expanded(
                    child: TextField(
                      controller: _tagController,
                      style: const TextStyle(fontSize: 11),
                      decoration: const InputDecoration(
                        hintText: '태그 추가 (Enter)',
                        border: InputBorder.none,
                        isDense: true,
                      ),
                      onSubmitted: (_) => _addTag(),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onToolbar(String label) {
    switch (label) {
      case 'H1':
        _prefixCurrentLine('# ');
      case 'H2':
        _prefixCurrentLine('## ');
      case 'B':
        _wrapSelection('**');
      case 'I':
        _wrapSelection('*');
      case '`':
        _wrapSelection('`');
      case '```':
        _wrapSelection('```\n', '\n```');
      case '>':
        _prefixCurrentLine('> ');
      case '—':
        _appendDivider();
    }
  }
}

/// Minimal line-based markdown renderer mirroring the web app's own hand
/// rolled renderMd — headings, blockquote, hr, lists, code fences, and
/// inline bold/italic/strike/code — as Flutter widgets instead of an HTML
/// string (there's no innerHTML sink here, so no XSS-escaping step needed).
class _MarkdownView extends StatelessWidget {
  const _MarkdownView({required this.source});
  final String source;

  @override
  Widget build(BuildContext context) {
    if (source.trim().isEmpty) {
      return const Text(
        '내용이 없습니다.',
        style: TextStyle(color: Colors.grey, fontSize: 13),
      );
    }
    final lines = source.split('\n');
    final widgets = <Widget>[];
    var inCode = false;
    final codeBuffer = StringBuffer();
    List<Widget>? listItems;

    void flushList() {
      if (listItems != null) {
        widgets.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: listItems!,
            ),
          ),
        );
        listItems = null;
      }
    }

    for (final line in lines) {
      if (line.startsWith('```')) {
        if (inCode) {
          widgets.add(
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(vertical: 6),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                codeBuffer.toString(),
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
            ),
          );
          codeBuffer.clear();
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        codeBuffer.writeln(line);
        continue;
      }
      final isBullet = line.startsWith('- ');
      final isNumbered = RegExp(r'^\d+\. ').hasMatch(line);
      if (!isBullet && !isNumbered) flushList();

      if (line.startsWith('### ')) {
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 2),
            child: _inlineText(
              context,
              line.substring(4),
              const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
            ),
          ),
        );
      } else if (line.startsWith('## ')) {
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 3),
            child: _inlineText(
              context,
              line.substring(3),
              const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
            ),
          ),
        );
      } else if (line.startsWith('# ')) {
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 4),
            child: _inlineText(
              context,
              line.substring(2),
              const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
          ),
        );
      } else if (line.startsWith('> ')) {
        widgets.add(
          Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.only(left: 12),
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.4),
                  width: 3,
                ),
              ),
            ),
            child: _inlineText(
              context,
              line.substring(2),
              const TextStyle(fontStyle: FontStyle.italic, color: Colors.grey),
            ),
          ),
        );
      } else if (line.startsWith('---')) {
        widgets.add(
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1),
          ),
        );
      } else if (isBullet) {
        listItems ??= [];
        listItems!.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('•  '),
                Expanded(
                  child: _inlineText(
                    context,
                    line.substring(2),
                    const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        );
      } else if (isNumbered) {
        listItems ??= [];
        listItems!.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: _inlineText(context, line, const TextStyle(fontSize: 13)),
          ),
        );
      } else if (line.trim().isEmpty) {
        widgets.add(const SizedBox(height: 8));
      } else {
        widgets.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: _inlineText(
              context,
              line,
              const TextStyle(fontSize: 13, height: 1.4),
            ),
          ),
        );
      }
    }
    flushList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: widgets,
    );
  }

  Widget _inlineText(BuildContext context, String text, TextStyle base) {
    final spans = <InlineSpan>[];
    final pattern = RegExp(
      r'\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`',
    );
    var last = 0;
    for (final m in pattern.allMatches(text)) {
      if (m.start > last) {
        spans.add(TextSpan(text: text.substring(last, m.start)));
      }
      if (m.group(1) != null) {
        spans.add(
          TextSpan(
            text: m.group(1),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        );
      } else if (m.group(2) != null) {
        spans.add(
          TextSpan(
            text: m.group(2),
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
        );
      } else if (m.group(3) != null) {
        spans.add(
          TextSpan(
            text: m.group(3),
            style: const TextStyle(decoration: TextDecoration.lineThrough),
          ),
        );
      } else if (m.group(4) != null) {
        spans.add(
          TextSpan(
            text: m.group(4),
            style: const TextStyle(
              fontFamily: 'monospace',
              backgroundColor: Color(0x11888888),
            ),
          ),
        );
      }
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return RichText(
      text: TextSpan(
        style: DefaultTextStyle.of(context).style.merge(base),
        children: spans,
      ),
    );
  }
}
