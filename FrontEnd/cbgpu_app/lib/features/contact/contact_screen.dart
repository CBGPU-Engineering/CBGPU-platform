import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/api_config.dart';
import '../../core/glass.dart';
import '../../core/theme.dart';

const _categories = ['예약 문의', '계정 문제', '기술 지원', '기타'];

class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});

  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _messageController = TextEditingController();
  String _category = '';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final user = Supabase.instance.client.auth.currentUser;
    _emailController.text = user?.email ?? '';
    _loadProfileName(user?.id);
  }

  Future<void> _loadProfileName(String? userId) async {
    if (userId == null) return;
    final data = await Supabase.instance.client.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    final name = data?['full_name'] as String?;
    if (mounted && name != null) setState(() => _nameController.text = name);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty || _emailController.text.trim().isEmpty || _messageController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('이름, 이메일, 내용은 필수입니다.')));
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/contact'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': _nameController.text.trim(),
          'email': _emailController.text.trim(),
          'category': _category,
          'message': _messageController.text.trim(),
        }),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) throw Exception(body['error'] ?? '전송 실패');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('문의가 전송되었습니다. 빠른 시일 내에 답변 드리겠습니다.')));
      setState(() {
        _category = '';
        _messageController.clear();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('전송 실패: ${e.toString().replaceFirst('Exception: ', '')}')));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          TextButton.icon(
            onPressed: () => context.go('/'),
            icon: const Icon(Icons.arrow_back, size: 16),
            label: const Text('Contact', style: TextStyle(fontWeight: FontWeight.w900)),
          ),
          const SizedBox(height: 8),
          const Text('문의사항을 남겨주시면 담당자가 이메일로 답변 드립니다', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
          const SizedBox(height: 20),
          GlassCard(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('이름 *'),
                          TextField(controller: _nameController, style: const TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('이메일 *'),
                          TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, style: const TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const FieldLabel('분류'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final cat in _categories)
                      ChoiceChip(
                        label: Text(cat, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11)),
                        selected: _category == cat,
                        onSelected: (selected) => setState(() => _category = selected ? cat : ''),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                const FieldLabel('내용 *'),
                TextField(
                  controller: _messageController,
                  maxLines: 6,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(hintText: '문의 내용을 자세히 작성해 주세요.'),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _submit,
                  icon: const Icon(Icons.send, size: 16),
                  label: Text(_isSubmitting ? '전송 중...' : '문의 보내기'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
