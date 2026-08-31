import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/glass.dart';
import 'manufacturing_preview.dart';

const _statusLabels = {
  'pending': '승인 대기',
  'accepted': '대기열',
  'queued': '대기열',
  'printing': '프린팅 중',
  'done': '완료',
  'rejected': '거절됨',
  'canceled': '취소됨',
};
const _statusColors = {
  'pending': Colors.amber,
  'accepted': Colors.blue,
  'queued': Colors.blue,
  'printing': Colors.green,
  'done': Colors.green,
  'rejected': Colors.red,
  'canceled': Colors.grey,
};

class PrintDetailScreen extends StatefulWidget {
  const PrintDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<PrintDetailScreen> createState() => _PrintDetailScreenState();
}

class _PrintDetailScreenState extends State<PrintDetailScreen> {
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
      final row = await Supabase.instance.client
          .from('print_jobs')
          .select(
            '*, manager:manager_id(full_name, student_id), preferred_printer:preferred_printer_id(name)',
          )
          .eq('id', widget.id)
          .single();
      final userId = Supabase.instance.client.auth.currentUser?.id;
      String? url;
      if (row['file_path'] != null) {
        url = await Supabase.instance.client.storage
            .from('manufacturing')
            .createSignedUrl(row['file_path'], 3600);
      }
      Map<String, dynamic>? requester;
      if (row['user_id'] != userId) {
        requester = await Supabase.instance.client
            .from('profiles')
            .select('full_name, student_id')
            .eq('id', row['user_id'])
            .maybeSingle();
      }
      if (mounted) {
        setState(() {
          _job = row;
          _downloadUrl = url;
          _requester = requester;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('신청 내역을 찾을 수 없습니다.')));
        context.go('/manufacturing');
      }
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('신청 취소'),
        content: const Text('이 3D 프린팅 신청을 취소합니다. 되돌릴 수 없습니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('돌아가기'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('취소하기', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await Supabase.instance.client
          .from('print_jobs')
          .update({'status': 'canceled'})
          .eq('id', _job!['id']);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('신청이 취소됐습니다.')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('취소 실패: $e')));
      }
    }
  }

  Future<void> _markDelivered() async {
    try {
      await Supabase.instance.client
          .from('print_jobs')
          .update({
            'delivered_at': DateTime.now().toIso8601String(),
            'file_path': null,
            'file_name': null,
          })
          .eq('id', _job!['id']);
      if (_job!['file_path'] != null) {
        await Supabase.instance.client.storage.from('manufacturing').remove([
          _job!['file_path'],
        ]);
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('전달 완료로 표시했습니다.')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('처리 실패: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const AmbientBackground(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final job = _job;
    if (job == null) return const AmbientBackground(child: SizedBox.shrink());

    final userId = Supabase.instance.client.auth.currentUser?.id;
    final isOwner = userId == job['user_id'];
    final status = job['status'] as String;
    final manager = job['manager'] as Map<String, dynamic>?;
    final preferredPrinter = job['preferred_printer'] as Map<String, dynamic>?;

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          TextButton.icon(
            onPressed: () => context.go('/manufacturing'),
            icon: const Icon(Icons.arrow_back, size: 14),
            label: const Text(
              'Back',
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
                        const Text(
                          '3D 프린팅 신청',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: (_statusColors[status] ?? Colors.grey)
                                .withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _statusLabels[status] ?? status,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: _statusColors[status] ?? Colors.grey,
                            ),
                          ),
                        ),
                        if (status == 'done' && job['delivered_at'] != null)
                          _badge('전달 완료', Colors.green),
                      ],
                    ),
                    Text(
                      job['file_name'] as String? ?? '파일 없음',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (isOwner && status == 'pending')
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              onPressed: _cancel,
              icon: const Icon(Icons.cancel_outlined, size: 14),
              label: const Text('신청 취소'),
            ),
          if (!isOwner && status == 'done' && job['delivered_at'] == null)
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green.shade700,
                foregroundColor: Colors.white,
              ),
              onPressed: _markDelivered,
              icon: const Icon(Icons.check, size: 14),
              label: const Text('가져다 줌'),
            ),
          const SizedBox(height: 16),
          if (_downloadUrl != null &&
              (job['file_name'] as String? ?? '').toLowerCase().endsWith(
                '.3mf',
              ))
            Model3mfPreviewCard(url: _downloadUrl!),
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Details',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade600,
                    letterSpacing: 1,
                  ),
                ),
                const Divider(),
                if (_requester != null)
                  _row(
                    '신청자',
                    '${_requester!['full_name'] ?? 'Unknown'} ${_requester!['student_id'] != null ? '(${_requester!['student_id']})' : ''}',
                  ),
                _row(
                  '모드',
                  job['mode'] == 'beginner'
                      ? '초보자 (담당자가 슬라이싱)'
                      : '고급자 (본인이 직접 슬라이싱)',
                ),
                Row(
                  children: [
                    Expanded(child: _row('수량', '${job['quantity']}개')),
                    Expanded(
                      child: _row(
                        '플레이트 수',
                        '${job['plate_count']}개${(job['plate_count'] as int) > 1 && status == 'printing' ? ' (${job['plates_completed']}개 완료)' : ''}',
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Expanded(
                      child: _row('재질', job['material'] as String? ?? '상관없음'),
                    ),
                    Expanded(
                      child: _row('색상', job['color'] as String? ?? '상관없음'),
                    ),
                  ],
                ),
                if (job['purpose'] != null)
                  _row('사용 목적', job['purpose'] as String),
                if (preferredPrinter?['name'] != null)
                  _row('희망 프린터', preferredPrinter!['name'] as String),
                if (manager?['full_name'] != null)
                  _row(
                    '담당자',
                    '${manager!['full_name']} ${manager['student_id'] != null ? '(${manager['student_id']})' : ''}',
                  ),
                if (status == 'rejected' && job['reject_reason'] != null)
                  _row(
                    '거절 사유',
                    job['reject_reason'] as String,
                    color: Colors.red,
                  ),
                if (_downloadUrl != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: InkWell(
                      onTap: () => launchUrl(
                        Uri.parse(_downloadUrl!),
                        mode: LaunchMode.externalApplication,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.download,
                            size: 14,
                            color: Colors.blue,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              job['file_name'] as String? ?? '',
                              style: const TextStyle(
                                color: Colors.blue,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (job['notes'] != null && (job['notes'] as String).isNotEmpty)
                  _row('메모', job['notes'] as String),
                if (job['printer_id'] != null)
                  _row('프린터', '프린터 ${job['printer_id']}'),
                if (job['estimated_end_at'] != null && status == 'printing')
                  _row(
                    '예상 완료 시각',
                    DateTime.parse(
                      job['estimated_end_at'],
                    ).toLocal().toString().substring(0, 16),
                  ),
                const Divider(),
                Row(
                  children: [
                    Expanded(
                      child: _row(
                        '신청일',
                        DateTime.parse(
                          job['created_at'],
                        ).toLocal().toString().substring(0, 16),
                      ),
                    ),
                    if (job['completed_at'] != null)
                      Expanded(
                        child: _row(
                          '완료일',
                          DateTime.parse(
                            job['completed_at'],
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

  Widget _badge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      label,
      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color),
    ),
  );

  Widget _row(String label, String value, {Color? color}) {
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
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
