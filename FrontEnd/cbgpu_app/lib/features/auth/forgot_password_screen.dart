import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _submitting = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_emailController.text.trim().isEmpty) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final resetUrl = Uri.base.resolve('/auth/reset-password').toString();
      await Supabase.instance.client.auth.resetPasswordForEmail(
        _emailController.text.trim(),
        redirectTo: resetUrl,
      );
      if (mounted) setState(() => _sent = true);
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = '요청 실패: ${error.message}');
    } catch (_) {
      if (mounted) setState(() => _error = '오류가 발생했습니다.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 120, 16, 112),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: GlassCard(
              radius: 28,
              padding: const EdgeInsets.all(32),
              child: _sent ? _sentContent() : _form(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _sentContent() => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Icon(
        Icons.mark_email_read_outlined,
        size: 48,
        color: AppColors.primary,
      ),
      const SizedBox(height: 16),
      const Text(
        '이메일을 확인해주세요',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w900,
          fontStyle: FontStyle.italic,
          letterSpacing: -0.6,
        ),
      ),
      const SizedBox(height: 16),
      Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: _emailController.text.trim(),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const TextSpan(text: '로 비밀번호 재설정 링크를 보냈습니다.'),
          ],
        ),
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Theme.of(
            context,
          ).colorScheme.onSurface.withValues(alpha: 0.55),
        ),
      ),
      const SizedBox(height: 16),
      TextButton(
        onPressed: () => context.go('/auth/login'),
        child: const Text('로그인으로 이동'),
      ),
    ],
  );

  Widget _form() => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text(
        '비밀번호 찾기',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 30,
          fontWeight: FontWeight.w900,
          fontStyle: FontStyle.italic,
          letterSpacing: -0.8,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        '가입한 이메일로 재설정 링크를 보내드립니다.',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Theme.of(
            context,
          ).colorScheme.onSurface.withValues(alpha: 0.55),
        ),
      ),
      const SizedBox(height: 24),
      const FieldLabel('Email'),
      TextField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        autofocus: true,
        style: const TextStyle(fontWeight: FontWeight.bold),
        decoration: const InputDecoration(hintText: '이메일 주소를 입력하세요'),
        onSubmitted: (_) => _submit(),
      ),
      if (_error != null) ...[
        const SizedBox(height: 12),
        Text(
          _error!,
          style: TextStyle(
            color: Theme.of(context).colorScheme.error,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
      const SizedBox(height: 16),
      ElevatedButton(
        onPressed: _submitting ? null : _submit,
        child: Text(_submitting ? '전송 중...' : '재설정 링크 받기'),
      ),
      const SizedBox(height: 16),
      TextButton(
        onPressed: () => context.go('/auth/login'),
        child: const Text('로그인으로 돌아가기'),
      ),
    ],
  );
}
