import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_config.dart';
import '../../core/glass.dart';

const _officialStudyUrl = 'https://cbsh.edu-set.com';

class AdminStudyTokenScreen extends StatefulWidget {
  const AdminStudyTokenScreen({super.key});
  @override
  State<AdminStudyTokenScreen> createState() => _AdminStudyTokenScreenState();
}

class _AdminStudyTokenScreenState extends State<AdminStudyTokenScreen> {
  final _tokenController = TextEditingController();
  DateTime? _updatedAt;
  bool _statusLoading = true;
  bool _saving = false;
  bool _loading = true;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      setState(() { _loading = false; _statusLoading = false; });
      return;
    }
    final profile = await Supabase.instance.client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    final isAdmin = profile?['is_admin'] == true;
    setState(() { _isAdmin = isAdmin; _loading = false; });
    if (isAdmin) {
      _fetchStatus();
    } else {
      setState(() => _statusLoading = false);
    }
  }

  Future<void> _fetchStatus() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      setState(() => _statusLoading = false);
      return;
    }
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/api/study/admin-token'), headers: {'Authorization': 'Bearer ${session.accessToken}'});
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        if (mounted) setState(() => _updatedAt = body['updatedAt'] != null ? DateTime.tryParse(body['updatedAt'] as String) : null);
      }
    } catch (_) {}
    if (mounted) setState(() => _statusLoading = false);
  }

  Future<void> _submit() async {
    final trimmed = _tokenController.text.trim();
    if (trimmed.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('accessToken을 입력해주세요.')));
      return;
    }
    setState(() => _saving = true);
    try {
      final session = Supabase.instance.client.auth.currentSession;
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/study/admin-token'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${session?.accessToken}'},
        body: jsonEncode({'accessToken': trimmed}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) throw Exception(body['message'] ?? '저장에 실패했습니다.');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('토큰을 저장했습니다. 이제부터 모든 사용자가 이 토큰으로 /study 현황을 조회합니다.')));
      _tokenController.clear();
      _fetchStatus();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AmbientBackground(child: Center(child: CircularProgressIndicator()));
    if (!_isAdmin) {
      return AmbientBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.shield_outlined, size: 56, color: Colors.red),
              const SizedBox(height: 12),
              const Text('Access Denied', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 24)),
              const Text('Administrator privileges required.', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: () => context.go('/'), child: const Text('Return Home')),
            ]),
          ),
        ),
      );
    }

    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          TextButton.icon(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back, size: 16), label: const Text('자습신청 토큰 관리', style: TextStyle(fontWeight: FontWeight.w900))),
          const SizedBox(height: 4),
          const Text('여기서 등록한 토큰으로 모든 사용자가 자습신청 현황을 조회합니다.', style: TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
            child: Text(
              _statusLoading ? '상태 확인 중...' : (_updatedAt != null ? '마지막 갱신: ${_updatedAt!.toLocal()}'.replaceAll('.000', '') : '등록된 토큰이 없습니다. 아래에서 토큰을 등록해주세요.'),
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: Colors.grey.withValues(alpha: 0.25)), borderRadius: BorderRadius.circular(12)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(onTap: () => launchUrl(Uri.parse(_officialStudyUrl), mode: LaunchMode.externalApplication), child: const Text('1. 공식 사이트에서 평소처럼 로그인합니다.', style: TextStyle(fontSize: 11, color: Colors.grey, decoration: TextDecoration.underline))),
                const SizedBox(height: 4),
                const Text('2. F12로 개발자도구를 열고 콘솔(Console) 탭에서 아래 명령을 입력합니다.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 4),
                Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(8)), child: const SelectableText('localStorage.getItem("accessToken")', style: TextStyle(fontFamily: 'monospace', fontSize: 11))),
                const SizedBox(height: 4),
                const Text('3. 따옴표를 제외한 출력된 토큰 값을 복사해 아래에 붙여넣습니다.', style: TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextField(controller: _tokenController, style: const TextStyle(fontFamily: 'monospace', fontSize: 12), decoration: const InputDecoration(hintText: 'accessToken 붙여넣기')),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(onPressed: _saving ? null : _submit, icon: const Icon(Icons.key, size: 16), label: Text(_saving ? '저장 중...' : '토큰 저장')),
          ),
        ],
      ),
    );
  }
}
