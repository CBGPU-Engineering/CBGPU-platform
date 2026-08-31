import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/glass.dart';

const _statusLabels = {'pending': '승인 대기', 'accepted': '대기중', 'in_progress': '작업 중', 'done': '완료', 'rejected': '거절됨', 'canceled': '취소됨'};
const _statusColors = {'pending': Colors.amber, 'accepted': Colors.blue, 'in_progress': Colors.green, 'done': Colors.green, 'rejected': Colors.red, 'canceled': Colors.grey};

class LaserDetailScreen extends StatefulWidget {
  const LaserDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<LaserDetailScreen> createState() => _LaserDetailScreenState();
}

class _LaserDetailScreenState extends State<LaserDetailScreen> {
  Map<String, dynamic>? _job;
  Map<String, dynamic>? _requester;
  bool _loading = true;
  String? _downloadUrl;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final row = await Supabase.instance.client.from('laser_jobs').select('*, manager:manager_id(full_name, student_id)').eq('id', widget.id).single();
      final userId = Supabase.instance.client.auth.currentUser?.id;
      String? url;
      if (row['file_path'] != null) {
        url = await Supabase.instance.client.storage.from('manufacturing').createSignedUrl(row['file_path'], 3600);
      }
      Map<String, dynamic>? requester;
      if (row['user_id'] != userId) {
        requester = await Supabase.instance.client.from('profiles').select('full_name, student_id').eq('id', row['user_id']).maybeSingle();
      }
      if (mounted) setState(() { _job = row; _downloadUrl = url; _requester = requester; _loading = false; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('신청 내역을 찾을 수 없습니다.')));
        context.go('/manufacturing');
      }
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('신청 취소'),
        content: const Text('이 레이저 커팅 신청을 취소합니다. 되돌릴 수 없습니다.'),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('돌아가기')), TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('취소하기', style: TextStyle(color: Colors.red)))],
      ),
    );
    if (confirmed != true) return;
    try {
      await Supabase.instance.client.from('laser_jobs').update({'status': 'canceled'}).eq('id', _job!['id']);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('신청이 취소됐습니다.')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('취소 실패: $e')));
    }
  }

  Future<void> _markDelivered() async {
    try {
      await Supabase.instance.client.from('laser_jobs').update({'delivered_at': DateTime.now().toIso8601String(), 'file_path': null, 'file_name': null}).eq('id', _job!['id']);
      if (_job!['file_path'] != null) {
        await Supabase.instance.client.storage.from('manufacturing').remove([_job!['file_path']]);
      }
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('전달 완료로 표시했습니다.')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('처리 실패: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AmbientBackground(child: Center(child: CircularProgressIndicator()));
    final job = _job;
    if (job == null) return const AmbientBackground(child: SizedBox.shrink());

    final userId = Supabase.instance.client.auth.currentUser?.id;
    final isOwner = userId == job['user_id'];
    final status = job['status'] as String;
    final manager = job['manager'] as Map<String, dynamic>?;

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          TextButton.icon(onPressed: () => context.go('/manufacturing'), icon: const Icon(Icons.arrow_back, size: 14), label: const Text('Back', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900))),
          const SizedBox(height: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                const Text('레이저 커팅 신청', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: (_statusColors[status] ?? Colors.grey).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Text(_statusLabels[status] ?? status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: _statusColors[status] ?? Colors.grey))),
                if (status == 'done' && job['delivered_at'] != null) _badge('전달 완료', Colors.green),
              ]),
              Text(job['file_name'] as String? ?? '파일 없음', style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
          const SizedBox(height: 10),
          if (isOwner && status == 'pending') OutlinedButton.icon(style: OutlinedButton.styleFrom(foregroundColor: Colors.red), onPressed: _cancel, icon: const Icon(Icons.cancel_outlined, size: 14), label: const Text('신청 취소')),
          if (!isOwner && status == 'done' && job['delivered_at'] == null)
            ElevatedButton.icon(style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white), onPressed: _markDelivered, icon: const Icon(Icons.check, size: 14), label: const Text('가져다 줌')),
          const SizedBox(height: 16),
          if (_downloadUrl != null && (job['file_name'] as String? ?? '').toLowerCase().endsWith('.dxf'))
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                const Icon(Icons.design_services_outlined, color: Colors.grey),
                const SizedBox(width: 10),
                const Expanded(child: Text('도면 미리보기는 앱에서 지원하지 않습니다 — 파일을 다운로드해 확인하세요.', style: TextStyle(fontSize: 11, color: Colors.grey))),
              ]),
            ),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Details', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey.shade600, letterSpacing: 1)),
                const Divider(),
                if (_requester != null) _row('신청자', '${_requester!['full_name'] ?? 'Unknown'} ${_requester!['student_id'] != null ? '(${_requester!['student_id']})' : ''}'),
                Row(children: [
                  Expanded(child: _row('재질', job['material'] == 'mdf' ? 'MDF' : '아크릴')),
                  Expanded(child: _row('두께', job['thickness_mm'] != null ? '${job['thickness_mm']}mm' : '—')),
                  Expanded(child: _row('수량', '${job['quantity']}')),
                ]),
                if (job['purpose'] != null) _row('사용 목적', job['purpose'] as String),
                if (manager?['full_name'] != null) _row('담당자', '${manager!['full_name']} ${manager['student_id'] != null ? '(${manager['student_id']})' : ''}'),
                if (status == 'rejected' && job['reject_reason'] != null) _row('거절 사유', job['reject_reason'] as String, color: Colors.red),
                if (_downloadUrl != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: InkWell(
                      onTap: () => launchUrl(Uri.parse(_downloadUrl!), mode: LaunchMode.externalApplication),
                      child: Row(children: [
                        const Icon(Icons.download, size: 14, color: Colors.blue),
                        const SizedBox(width: 6),
                        Expanded(child: Text(job['file_name'] as String? ?? '', style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold, fontSize: 12))),
                      ]),
                    ),
                  ),
                if (job['notes'] != null && (job['notes'] as String).isNotEmpty) _row('메모', job['notes'] as String),
                const Divider(),
                Row(children: [
                  Expanded(child: _row('신청일', DateTime.parse(job['created_at']).toLocal().toString().substring(0, 16))),
                  if (job['completed_at'] != null) Expanded(child: _row('완료일', DateTime.parse(job['completed_at']).toLocal().toString().substring(0, 16))),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(String label, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color)));

  Widget _row(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey.shade500)),
          Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
